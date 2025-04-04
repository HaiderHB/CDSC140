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
        // Send the transcription back to the renderer process
        return message.toString()
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

  ipcMain.handle('transcribe-audio', async (event, audioData: Uint8Array) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(audioData)
        // Wait for the response from the WebSocket server
        const response = await new Promise((resolve) => {
          ws.once('message', (message) => {
            resolve(message.toString())
          })
        })
        return response
      } catch (error) {
        console.error('Error during transcription:', error)
        return undefined
      }
    } else {
      console.error('WebSocket is not open')
      return undefined
    }
  })
}
