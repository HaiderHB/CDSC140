import { ipcMain } from 'electron'
import { WebSocket } from 'ws'
import { spawn, ChildProcessWithoutNullStreams } from 'child_process'

let pythonProcess: ChildProcessWithoutNullStreams | null = null
let ws: WebSocket | null = null

export function setupTranscriptionHandlers() {
  ipcMain.handle('start-python-server', () => {
    if (!pythonProcess) {
      console.log('Starting Python WebSocket server...')
      // TODO: Make this path dynamic
      const pythonPath = 'C:\\Users\\ultim\\AppData\\Local\\Programs\\Python\\Python312\\python.exe'
      pythonProcess = spawn(pythonPath, ['../scripts/transcription_server.py'])

      pythonProcess.stdout.on('data', (data) => {
        console.log(`Python stdout: ${data}`)
      })

      pythonProcess.stderr.on('data', (data) => {
        console.error(`Python stderr: ${data}`)
      })

      pythonProcess.on('close', (code) => {
        console.log(`Python process exited with code ${code}`)
        pythonProcess = null
      })
    }

    if (!ws) {
      ws = new WebSocket('ws://localhost:8765')

      ws.on('open', () => {
        console.log('WebSocket connection opened')
      })

      ws.on('message', (message) => {
        console.log('Received transcription:', message)
        // Handle the received transcription
      })

      ws.on('error', (error) => {
        console.error('WebSocket error:', error)
      })

      ws.on('close', () => {
        console.log('WebSocket connection closed')
        ws = null
      })
    }
  })

  ipcMain.handle('stop-python-server', () => {
    if (pythonProcess) {
      console.log('Stopping Python WebSocket server...')
      pythonProcess.kill()
      pythonProcess = null
    }

    if (ws) {
      ws.close()
      ws = null
    }
  })

  ipcMain.handle('transcribe-audio', async (_, audioData: Uint8Array) => {
    console.log('Starting transcription with audio data length:', audioData.length, 'bytes')

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(audioData)
    } else {
      console.error('WebSocket is not open')
    }
  })
}
