import { app, shell, BrowserWindow, ipcMain, session } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'
import {
  initStorage,
  loadSessions,
  loadResumesMetadata,
  saveSessions,
  saveResumesMetadata,
  saveResumeFile,
  readResumeFile,
  deleteResumeFile
} from './storage'
import { setupTranscriptionHandlers } from './transcription'
import spawn from 'cross-spawn'
import { ChildProcess } from 'child_process'

// Reference to the Python process
let pythonProcess: ChildProcess | null = null

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
    console.log(`Starting Python transcription server...`)

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
let openaiApiKey: string | undefined
const model = 'gpt-4o-mini-realtime-preview-2024-12-17'

const envFilePath = path.join(rootPath, 'whisper-node-test', '.env')

try {
  const envFile = readFileSync(envFilePath, 'utf8')
  console.log('Found .env file in whisper-node-test directory')

  const keyMatch = envFile.match(/OPENAI_API_KEY=(.+)/)
  if (keyMatch) {
    openaiApiKey = keyMatch[1].replace(/^"|"$/g, '') // Remove quotes at beginning and end
    console.log('OpenAI API key loaded successfully')
  } else {
    console.error('OpenAI API key not found in .env file')
  }
} catch (error) {
  console.error('Error loading .env file:', error)
}

// Initialize the storage system
initStorage()

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
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

  // Handle IPC requests for OpenAI token
  ipcMain.handle('get-openai-session', async () => {
    try {
      if (!openaiApiKey) {
        throw new Error('OpenAI API key not found in .env file')
      }

      const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          modalities: ['text']
        })
      })

      return await response.json()
    } catch (error) {
      console.error('Error getting OpenAI session:', error)
      throw error
    }
  })

  // Handle IPC requests for WebRTC SDP exchange
  ipcMain.handle('openai-webrtc-sdp', async (_, sdp: string) => {
    try {
      if (!openaiApiKey) {
        throw new Error('OpenAI API key not found in .env file')
      }

      const response = await fetch(
        `https://api.openai.com/v1/realtime?model=${model}&modalities=text`,
        {
          method: 'POST',
          body: sdp,
          headers: {
            Authorization: `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/sdp'
          }
        }
      )

      return await response.text()
    } catch (error) {
      console.error('Error in WebRTC SDP exchange:', error)
      throw error
    }
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
      const buffer = readResumeFile(filePath)
      return buffer.toString('base64')
    } catch (error) {
      console.error('Error reading resume file:', error)
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
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.

app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  // Set up app-wide security policies
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; connect-src 'self' http://localhost:3000 ws://localhost:9876 https://api.openai.com https://storage.googleapis.com https://fonts.googleapis.com https://tfhub.dev https://www.kaggle.com; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline';"
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
    app.quit()
  }
})

// Clean up the Python process when the app is about to quit
app.on('will-quit', () => {
  if (pythonProcess) {
    // On Windows, sending SIGTERM might not work, so just kill it
    if (process.platform === 'win32') {
      pythonProcess.pid && process.kill(pythonProcess.pid)
    } else {
      pythonProcess.kill('SIGTERM')
    }
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
