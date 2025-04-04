import { ipcMain } from 'electron'

export function setupTranscriptionHandlers(): void {
  // Handle IPC requests for transcription
  ipcMain.handle('start-transcription', async () => {
    try {
      console.log('Starting transcription from main process')
      // This can be expanded later to include more functionality
      return { success: true }
    } catch (error) {
      console.error('Error starting transcription:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('stop-transcription', async () => {
    try {
      console.log('Stopping transcription from main process')
      // This can be expanded later to include more functionality
      return { success: true }
    } catch (error) {
      console.error('Error stopping transcription:', error)
      return { success: false, error: (error as Error).message }
    }
  })
}
