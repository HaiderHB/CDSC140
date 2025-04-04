import { ipcMain, IpcMainInvokeEvent, app } from 'electron'
import { WebSocket } from 'ws'
import { spawn, ChildProcessWithoutNullStreams } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'

let pythonProcess: ChildProcessWithoutNullStreams | null = null
let ws: WebSocket | null = null
let lastTranscription: string = ''
let connected: boolean = false
let serverStartAttempts = 0
const MAX_START_ATTEMPTS = 3

// Helper function to find the Python script in various locations
function findPythonScript(): string | null {
  // Possible locations for the script
  const possiblePaths = [
    // Development paths
    path.join(process.cwd(), 'scripts', 'transcription_server.py'),
    path.join(process.cwd(), '..', 'scripts', 'transcription_server.py'),
    // Production paths
    path.join(app.getAppPath(), 'scripts', 'transcription_server.py'),
    path.join(app.getAppPath(), '..', 'scripts', 'transcription_server.py')
  ]

  // Try all the possible paths
  for (const scriptPath of possiblePaths) {
    console.log(`Checking for script at: ${scriptPath}`)
    if (fs.existsSync(scriptPath)) {
      console.log(`Found script at: ${scriptPath}`)
      return scriptPath
    }
  }

  // If we can't find the regular script, try the test script
  const testScript = path.join(process.cwd(), 'scripts', 'test_websocket.py')
  if (fs.existsSync(testScript)) {
    console.log(`Found test script at: ${testScript}`)
    return testScript
  }

  return null
}

// Function to check if a WebSocket server is already running
async function isWebSocketServerRunning(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const testWs = new WebSocket('ws://localhost:8765')

      const timeout = setTimeout(() => {
        // If we timeout, the server is not running
        testWs.close()
        resolve(false)
      }, 1000)

      testWs.on('open', () => {
        // Server is running
        clearTimeout(timeout)
        console.log('WebSocket server is already running')
        testWs.close()
        resolve(true)
      })

      testWs.on('error', () => {
        // Error connecting
        clearTimeout(timeout)
        resolve(false)
      })
    } catch (error) {
      resolve(false)
    }
  })
}

// Helper function to start the Python server and connect WebSocket
async function startPythonServerAndConnect() {
  // Don't try to restart too many times
  if (serverStartAttempts >= MAX_START_ATTEMPTS) {
    console.log('Max server start attempts reached, giving up')
    return { success: false, error: 'Max restart attempts reached' }
  }

  serverStartAttempts++

  // First check if a WebSocket server is already running
  const serverRunning = await isWebSocketServerRunning()

  // If the server is not running and we don't have a Python process, start one
  if (!serverRunning && !pythonProcess) {
    console.log('Starting Python WebSocket server...')

    // Get the Python executable path
    const pythonPath = 'C:\\Users\\ultim\\AppData\\Local\\Programs\\Python\\Python312\\python.exe'

    // Find the Python script
    const scriptPath = findPythonScript()
    if (!scriptPath) {
      console.error('Could not find Python script')
      serverStartAttempts = MAX_START_ATTEMPTS // Prevent further attempts
      return { success: false, error: 'Python script not found' }
    }

    // Start the process with the script
    console.log(`Starting Python script: ${scriptPath}`)
    pythonProcess = spawn(pythonPath, [scriptPath], {
      // Use shell option on Windows to make sure PATH is properly set
      shell: process.platform === 'win32'
    })

    // Set up logging
    pythonProcess.stdout.on('data', (data) => {
      console.log(`Python stdout: ${data}`)
    })

    pythonProcess.stderr.on('data', (data) => {
      console.error(`Python stderr: ${data}`)
    })

    pythonProcess.on('close', (code) => {
      console.log(`Python process exited with code ${code}`)
      pythonProcess = null
      connected = false

      // If process exited with error, don't keep restarting
      if (code !== 0) {
        serverStartAttempts = MAX_START_ATTEMPTS
      }
    })

    // Wait a bit for Python server to start up
    await new Promise((resolve) => setTimeout(resolve, 1000))
  } else if (serverRunning) {
    console.log('Using existing WebSocket server')
  }

  // Connect to the WebSocket server
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    try {
      connected = false
      ws = new WebSocket('ws://localhost:8765')

      // Wait for connection
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('WebSocket connection timeout'))
        }, 5000)

        ws!.on('open', () => {
          console.log('WebSocket connection opened')
          connected = true
          clearTimeout(timeout)
          resolve(true)
        })

        ws!.on('error', (err) => {
          console.error('WebSocket connection error:', err)
          clearTimeout(timeout)
          reject(err)
        })
      })

      // Setup message handler
      ws.on('message', (message) => {
        const transcription = message.toString()
        console.log('Received from WebSocket:', transcription)
        if (transcription.startsWith('Echo:')) {
          // Test server response, not a real transcription
          console.log('Received echo from test server')
        } else {
          // Real transcription from the transcription server
          lastTranscription = transcription
        }
      })

      ws.on('close', () => {
        console.log('WebSocket connection closed')
        connected = false
        ws = null
      })

      return { success: true }
    } catch (error: any) {
      console.error('Failed to connect to WebSocket server:', error)
      return { success: false, error: error.message }
    }
  }

  return { success: connected }
}

export function setupTranscriptionHandlers() {
  ipcMain.handle('start-python-server', async () => {
    // Reset the attempt counter when explicitly starting
    serverStartAttempts = 0
    return await startPythonServerAndConnect()
  })

  ipcMain.handle('stop-python-server', () => {
    lastTranscription = ''
    serverStartAttempts = MAX_START_ATTEMPTS // Prevent restarts after stopping

    if (ws) {
      ws.close()
      ws = null
      connected = false
    }

    if (pythonProcess) {
      console.log('Stopping Python WebSocket server...')
      pythonProcess.kill()
      pythonProcess = null
    }

    return { success: true }
  })

  ipcMain.handle('transcribe-audio', async (event: IpcMainInvokeEvent, audioData: Uint8Array) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      // Only try to reconnect if we haven't hit the max attempts
      if (serverStartAttempts < MAX_START_ATTEMPTS) {
        console.error('WebSocket is not open, attempting to reconnect...')
        try {
          await startPythonServerAndConnect()
          // Wait a bit more for reconnection
          await new Promise((resolve) => setTimeout(resolve, 500))
        } catch (error: any) {
          console.error('Failed to reconnect:', error)
          return ''
        }
      } else {
        return '' // Don't try to connect if max attempts reached
      }
    }

    try {
      if (ws && ws.readyState === WebSocket.OPEN) {
        // First, save the current last transcription before sending new audio
        const currentTranscription = lastTranscription

        // Send the audio to the Python server
        ws.send(audioData)

        // Wait a bit for processing
        await new Promise((resolve) => setTimeout(resolve, 300))

        // Return the latest transcription
        return lastTranscription || currentTranscription || ''
      } else {
        console.error('WebSocket still not open after reconnection attempt')
        return ''
      }
    } catch (error: any) {
      console.error('Error during transcription:', error)
      return ''
    }
  })
}
