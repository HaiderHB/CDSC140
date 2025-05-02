import { app, shell, BrowserWindow, ipcMain, session, globalShortcut } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'
import {
  initStorage,
  loadSessions,
  loadResumesMetadata,
  saveSessions,
  saveResumesMetadata,
  saveResumeFile,
  deleteResumeFile
} from './storage'
import { setupTranscriptionHandlers } from './transcription'
import spawn from 'cross-spawn'
import { ChildProcess } from 'child_process'
import fs from 'fs'
import { initialize, enable } from '@electron/remote/main/index.js'

// Initialize remote module
initialize()

// Reference to the Python process
let pythonProcess: ChildProcess | null = null

// State variables for window controls
let windowVisible = false
let windowOpacity = 0
let moveStep = 20
let mainWindow: BrowserWindow | null = null

function startPythonScript() {
  // Check if we're in development or production
  const scriptPath = is.dev
    ? join(process.cwd(), 'scripts', 'transcription.py')
    : join(process.resourcesPath, 'scripts', 'transcription.py')

  // Use Python 3.12 specifically
  const pythonCommand = process.platform === 'win32' ? 'py' : 'python3.12'
  const pythonArgs = process.platform === 'win32' ? ['-3.12', scriptPath] : [scriptPath]

  // Spawn the Python process
  try {
    console.log(`Spawning Python process...`)

    pythonProcess = spawn(pythonCommand, pythonArgs, {
      stdio: 'inherit'
    })

    if (pythonProcess) {
      pythonProcess.on('error', (err) => {
        console.error('Failed to start Python process:', err)
      })

      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          console.log(`Python process exited with code ${code}`)
        }
        pythonProcess = null
      })
    }
  } catch (error) {
    console.error('Error starting Python script:', error)
  }
}

const originalStderrWrite = process.stderr.write
process.stderr.write = (msg, ...args) => {
  if (
    msg.includes('dxgi_duplicator_controller') ||
    msg.includes('Autofill') ||
    msg.includes('DxgiDuplicatorController')
  )
    return true
  return originalStderrWrite(msg, ...args)
}

// Load environment variables from .env file
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootPath = path.resolve(__dirname, '../../..')

// Initialize the storage system
initStorage()

// Load saved window state
let savedWindowState = { position: [100, 100], opacity: 0.8 }
try {
  const savedState = readFileSync(join(rootPath, 'window-state.json'), 'utf8')
  savedWindowState = JSON.parse(savedState)
  console.log('Loaded saved window state:', savedWindowState)
} catch (error) {
  console.error('Error loading saved window state:', error)
}

// Toggle window visibility
function toggleWindowVisibility() {
  if (!mainWindow) return

  const MIN_OPACITY = 0.2
  windowVisible = !windowVisible

  if (windowVisible) {
    // Make window visible
    windowOpacity = savedWindowState.opacity
    mainWindow.setOpacity(windowOpacity)
    mainWindow.setIgnoreMouseEvents(false, { forward: true })
  } else {
    // Make window invisible but not completely
    windowOpacity = MIN_OPACITY
    mainWindow.setOpacity(windowOpacity)
    mainWindow.setIgnoreMouseEvents(true, { forward: true })
  }
}

function handleAppClose() {
  // Save window state before quitting
  if (mainWindow) {
    const position = mainWindow.getPosition()
    const state = { position, opacity: windowOpacity }
    try {
      writeFileSync(join(rootPath, 'window-state.json'), JSON.stringify(state))
      console.log('Saved window state:', state)
    } catch (error) {
      console.error('Error saving window state:', error)
    }
  }

  // Unregister all global shortcuts
  globalShortcut.unregisterAll()

  // Properly shut down the Python transcription server
  if (pythonProcess) {
    try {
      console.log('Properly shutting down transcription server...')

      // On Windows, we need to use taskkill to ensure the process and its children are terminated
      if (process.platform === 'win32') {
        const { exec } = require('child_process')
        exec(`taskkill /pid ${pythonProcess.pid} /T /F`, (error) => {
          if (error) {
            console.error('Error killing Python process:', error)
          } else {
            console.log('Successfully terminated Python process and its children')
          }
        })
      } else {
        // For non-Windows platforms, use SIGTERM first
        pythonProcess.kill('SIGTERM')
        console.log(`Sent termination signal to Python process ${pythonProcess.pid}`)

        // Wait a short time for graceful shutdown
        setTimeout(() => {
          if (pythonProcess) {
            pythonProcess.kill('SIGKILL')
          }
        }, 1000)
      }
    } catch (error) {
      console.error('Error shutting down transcription server:', error)
    }
  }

  // Close the main window if it exists
  if (mainWindow) {
    mainWindow.close()
    mainWindow = null
  }

  // Finally quit the app
  app.quit()
}

// Adjust window opacity
function adjustOpacity(increase: boolean) {
  if (!mainWindow) return

  const MIN_OPACITY = 0.2

  if (increase) {
    windowOpacity = Math.min(1, windowOpacity + 0.1)
  } else {
    windowOpacity = Math.max(MIN_OPACITY, windowOpacity - 0.1)
  }

  mainWindow.setOpacity(windowOpacity)

  // Update mouse events based on opacity
  if (windowOpacity <= MIN_OPACITY) {
    mainWindow.setIgnoreMouseEvents(true, { forward: true })
  } else {
    mainWindow.setIgnoreMouseEvents(false, { forward: true })
  }
}

// Move window
function moveWindow(direction: 'left' | 'right' | 'up' | 'down') {
  if (!mainWindow) return

  const [x, y] = mainWindow.getPosition()

  switch (direction) {
    case 'left':
      mainWindow.setPosition(x - moveStep, y, true)
      break
    case 'right':
      mainWindow.setPosition(x + moveStep, y, true)
      break
    case 'up':
      mainWindow.setPosition(x, y - moveStep, true)
      break
    case 'down':
      mainWindow.setPosition(x, y + moveStep, true)
      break
  }
}

// Protocol registration
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('interviewspeaker', process.execPath, [
      path.resolve(process.argv[1])
    ])
  }
} else {
  app.setAsDefaultProtocolClient('interviewspeaker')
}

// Handle the protocol callback
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', (event, argv) => {
    console.log('second-instance', argv)
    const deepLink = argv.find((arg) => arg.startsWith('interviewspeaker://'))
    if (deepLink && mainWindow) {
      console.log('Deep link received in second-instance:', deepLink)
      mainWindow.webContents.send('auth-callback', deepLink)
      mainWindow.focus()
    }
  })

  // Handle protocol for dev mode
  app.on('open-url', (event, url) => {
    console.log('open-url', url)
    event.preventDefault()
    if (mainWindow) {
      console.log('Deep link received on open-url:', url)
      mainWindow.webContents.send('auth-callback', url)
    }
  })
}

function createWindow(): void {
  // Create the browser window with anti-screen-capture properties
  mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: true, // Start visible
    autoHideMenuBar: true,
    transparent: true,
    backgroundColor: '#00000000', // Fully transparent background
    type: 'panel', // Special window type with capture-resistant properties
    frame: false, // Remove all window chrome and borders
    skipTaskbar: true, // Hide from taskbar/dock
    fullscreenable: false, // Prevent accidental full-screen
    paintWhenInitiallyHidden: true, // Ensure rendering even when hidden
    hasShadow: false, // Hide shadow
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      devTools: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // Enable remote module for this window
  enable(mainWindow.webContents)

  // Set advanced window attributes
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  // Enable content protection to prevent screen capture
  mainWindow.setContentProtection(true)

  // Set always on top with screen-saver priority
  mainWindow.setAlwaysOnTop(true, 'screen-saver', 1)

  // Start with saved position and opacity
  mainWindow.setPosition(savedWindowState.position[0], savedWindowState.position[1], true)
  mainWindow.setOpacity(savedWindowState.opacity)
  windowOpacity = savedWindowState.opacity
  windowVisible = true
  mainWindow.setIgnoreMouseEvents(false, { forward: true })

  // For macOS, hide during mission control
  if (process.platform === 'darwin') {
    mainWindow.setHiddenInMissionControl(true)
  }

  // Register keyboard shortcuts for window control

  // Toggle visibility (Ctrl+H)
  // globalShortcut.register('CommandOrControl+H', toggleWindowVisibility);

  // Adjust opacity (Ctrl+[ and Ctrl+])
  globalShortcut.register('CommandOrControl+[', () => adjustOpacity(false))
  globalShortcut.register('CommandOrControl+]', () => adjustOpacity(true))

  // Move window with arrow keys
  globalShortcut.register('CommandOrControl+Left', () => moveWindow('left'))
  globalShortcut.register('CommandOrControl+Right', () => moveWindow('right'))
  globalShortcut.register('CommandOrControl+Up', () => moveWindow('up'))
  globalShortcut.register('CommandOrControl+Down', () => moveWindow('down'))

  // // Reset view
  // globalShortcut.register('CommandOrControl+R', () => {
  //   if (!mainWindow) return;
  //   mainWindow.setPosition(100, 100, true);
  //   windowOpacity = 0.8;
  //   mainWindow.setOpacity(windowOpacity);
  //   windowVisible = true;
  //   mainWindow.setIgnoreMouseEvents(false, { forward: true });
  // });

  // Quit app
  globalShortcut.register('CommandOrControl+Q', () => {
    handleAppClose()
  })

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) return
    // Start hidden but technically "shown" to the system
    mainWindow.show()
    mainWindow.setOpacity(savedWindowState.opacity)
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Set up screen capture handler for audio and video
  session.defaultSession.setDisplayMediaRequestHandler(
    (_, callback) => {
      try {
        console.log('Setting up audio capture')
        // Skip video capture completely
        callback({
          video: undefined,
          audio: 'loopback' // <- this enables system audio capture
        })
        console.log('Audio capture setup complete')
      } catch (error) {
        console.error('Error setting up audio capture:', error)
      }
    },
    // @ts-ignore
    { useSystemPicker: true }
  )

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Set up IPC handlers for data persistence
  setupIpcHandlers()

  // Handle app control events
  ipcMain.on('close-app', () => {
    handleAppClose()
  })

  // Handle IPC requests for OpenAI token
  ipcMain.handle('get-ai-session', async (event) => {
    try {
      // Get access token through IPC
      const accessToken = await event.sender.executeJavaScript(`
        (() => {
          const authState = localStorage.getItem('authState');
          return authState ? JSON.parse(authState).accessToken : null;
        })()
      `)

      if (!accessToken) {
        throw new Error('No access token available')
      }

      const response = await fetch('https://interviewspeaker.co/api/create-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        }
      })

      if (!response.ok) {
        throw new Error(`Backend Error: ${response.statusText}`)
      }

      const data = await response.json()

      return data
    } catch (error) {
      console.error('Error getting ai session from backend:', error)
      throw error
    }
  })

  // Handle IPC requests for WebRTC SDP exchange
  ipcMain.handle('ai-webrtc-sdp', async (event, sdp: string) => {
    try {
      // Get access token through IPC
      const accessToken = await event.sender.executeJavaScript(`
        (() => {
          const authState = localStorage.getItem('authState');
          return authState ? JSON.parse(authState).accessToken : null;
        })()
      `)

      if (!accessToken) {
        throw new Error('No access token available')
      }

      const response = await fetch('https://interviewspeaker.co/api/webrtc-sdp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ sdp })
      })

      if (!response.ok) {
        throw new Error(`Backend Error: ${response.statusText}`)
      }

      const data = await response.text()
      return data
    } catch (error) {
      console.error('Error in WebRTC SDP exchange:', error)
      throw error
    }
  })

  // Handle window close event to prevent errors
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Add IPC handlers for auth
  ipcMain.handle('open-external', async (event, url) => {
    await shell.openExternal(url)
  })
}

function setupIpcHandlers(): void {
  // Get sessions
  ipcMain.handle('get-sessions', async () => {
    try {
      return loadSessions()
    } catch (error) {
      console.error('Error loading sessions:', error)
      throw error
    }
  })

  // Save sessions
  ipcMain.handle('save-sessions', async (_, sessions) => {
    try {
      return saveSessions(sessions)
    } catch (error) {
      console.error('Error saving sessions:', error)
      throw error
    }
  })

  // Get resumes metadata
  ipcMain.handle('get-resumes', async () => {
    try {
      return loadResumesMetadata()
    } catch (error) {
      console.error('Error loading resumes metadata:', error)
      throw error
    }
  })

  // Save resumes metadata
  ipcMain.handle('save-resumes', async (_, resumes) => {
    try {
      return saveResumesMetadata(resumes)
    } catch (error) {
      console.error('Error saving resumes metadata:', error)
      throw error
    }
  })

  // Save resume file
  ipcMain.handle('save-resume-file', async (_, id, fileData, fileExtension) => {
    try {
      const buffer = Buffer.from(fileData)
      const filePath = await saveResumeFile(id, buffer, fileExtension)
      return filePath
    } catch (error) {
      console.error('Error saving resume file:', error)
      throw error
    }
  })

  // Read resume file
  ipcMain.handle('read-resume-file', async (_, filePath) => {
    try {
      const pdfParse = require('pdf-parse')
      const fileBuffer = fs.readFileSync(filePath)
      const data = await pdfParse(fileBuffer)
      console.log('PARSED RESUME DATA', data.text)
      return data.text
    } catch (error) {
      console.error('Error reading resume file:', error)
      throw error
    }
  })

  // Read docx file
  ipcMain.handle('read-docx-file', async (_, filePath) => {
    try {
      const mammoth = require('mammoth')
      const result = await mammoth.extractRawText({ path: filePath })
      console.log('PARSED DOCX DATA', result.value)
      return result.value
    } catch (error) {
      console.error('Error reading docx file:', error)
      throw error
    }
  })

  // Read txt file
  ipcMain.handle('read-txt-file', async (_, filePath) => {
    try {
      const text = fs.readFileSync(filePath, 'utf8')
      console.log('READ TXT FILE', text)
      return text
    } catch (error) {
      console.error('Error reading txt file:', error)
      throw error
    }
  })

  // Delete resume
  ipcMain.handle('delete-resume', async (_, filePath) => {
    try {
      return deleteResumeFile(filePath)
    } catch (error) {
      console.error('Error deleting resume file:', error)
      throw error
    }
  })

  // Handle Ctrl+M command
  ipcMain.on('ctrl-m-pressed', () => {
    if (mainWindow) {
      mainWindow.webContents.send('ctrl-m-event')
    }
  })

  // Handle Ctrl+N command
  ipcMain.on('ctrl-n-pressed', () => {
    if (mainWindow) {
      mainWindow.webContents.send('ctrl-n-event')
    }
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.

app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.interviewspeaker.app')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Register Ctrl+M global shortcut
  globalShortcut.register('CommandOrControl+M', () => {
    ipcMain.emit('ctrl-m-pressed')
  })

  globalShortcut.register('CommandOrControl+N', () => {
    ipcMain.emit('ctrl-n-pressed')
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  // Set up app-wide security policies
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; connect-src 'self' http://localhost:3000 ws://localhost:9876 https://api.openai.com https://storage.googleapis.com https://fonts.googleapis.com https://tfhub.dev https://interviewspeaker.co https://www.interviewspeaker.co https://www.kaggle.com; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline';"
        ]
      }
    })
  })

  // Set up transcription handlers
  setupTranscriptionHandlers()

  // Create the browser window
  createWindow()

  // Start the Python transcription script
  startPythonScript()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    handleAppClose()
  }
})

// Save window state before quitting
app.on('before-quit', () => {
  if (mainWindow) {
    const position = mainWindow.getPosition()
    const state = { position, opacity: windowOpacity }
    try {
      writeFileSync(join(rootPath, 'window-state.json'), JSON.stringify(state))
      console.log('Saved window state:', state)
    } catch (error) {
      console.error('Error saving window state:', error)
    }
  }
})

// Clean up global shortcuts when the app is about to quit
app.on('will-quit', () => {
  // Unregister the shortcut
  globalShortcut.unregisterAll()

  if (pythonProcess) {
    try {
      console.log('Properly shutting down transcription server...')

      // Send a termination signal to the Python process
      pythonProcess.kill('SIGTERM')
      console.log(`Sent termination signal to Python process ${pythonProcess.pid}`)
    } catch (error) {
      console.error('Error shutting down transcription server:', error)
    }
  }

  if (mainWindow) {
    const position = mainWindow.getPosition()
    const state = { position, opacity: windowOpacity }
    try {
      writeFileSync(join(rootPath, 'window-state.json'), JSON.stringify(state))
      console.log('Saved window state:', state)
    } catch (error) {
      console.error('Error saving window state:', error)
    }
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
