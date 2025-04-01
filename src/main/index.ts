import { app, shell, BrowserWindow, ipcMain, desktopCapturer, session } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

// Load environment variables from .env file
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootPath = path.resolve(__dirname, '../../..')
const electronAppPath = path.join(rootPath, 'electron-app')
let openaiApiKey: string | undefined

try {
  // Try both potential locations for .env file
  let envFile
  try {
    envFile = readFileSync(path.join(rootPath, '.env'), 'utf8')
    console.log('Found .env file in project root')
  } catch (e) {
    envFile = readFileSync(path.join(electronAppPath, '.env'), 'utf8')
    console.log('Found .env file in electron-app directory')
  }

  const keyMatch = envFile.match(/OPENAI_API_KEY=(.+)/)
  if (keyMatch) {
    openaiApiKey = keyMatch[1].replace(/^"|"$/g, '') // Remove quotes at beginning and end
    console.log('OpenAI API key loaded successfully')
  } else {
    console.error('OpenAI API key not found in .env file')
  }
} catch (error) {
  console.error('Error loading .env file:', error)
  // Create a default .env file in the electron-app directory
  try {
    const defaultEnv = 'OPENAI_API_KEY=your_openai_api_key_here'
    const targetEnvPath = path.join(electronAppPath, '.env')
    console.log('Creating default .env file at:', targetEnvPath)
    const { writeFileSync } = await import('fs')
    writeFileSync(targetEnvPath, defaultEnv)
    console.log('Please update the .env file with your actual OpenAI API key')
  } catch (writeError) {
    console.error('Failed to create default .env file:', writeError)
  }
}

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
      desktopCapturer
        .getSources({
          types: ['screen', 'window'],
          thumbnailSize: { width: 0, height: 0 }
        })
        .then((sources) => {
          console.log(
            'Available sources:',
            sources.map((s) => s.name)
          )
          // Always specify loopback for audio to capture system audio
          if (sources.length > 0) {
            callback({
              video: sources[0],
              audio: 'loopback'
            })
          } else {
            // No sources available - handle gracefully
            console.error('No screen sources found')
            callback({ video: undefined, audio: undefined })
          }
        })
        .catch((err) => {
          console.error('Error getting sources:', err)
          callback({ video: undefined, audio: undefined })
        })
    },
    { useSystemPicker: true }
  )

  // Set Content Security Policy to allow connections to localhost:3000 and inline styles
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; connect-src 'self' http://localhost:3000 https://api.openai.com; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"
        ]
      }
    })
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Open DevTools in development mode
  if (is.dev) {
    mainWindow.webContents.openDevTools()
  }

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
          model: 'gpt-4o-realtime-preview-2024-12-17',
          voice: 'shimmer'
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
        'https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17',
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

  createWindow()

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

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
