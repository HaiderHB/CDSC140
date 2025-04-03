import { ipcMain } from 'electron'
import { nodewhisper } from 'nodejs-whisper'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

export function setupTranscriptionHandlers() {
  ipcMain.handle('transcribe-audio', async (_, audioData: Uint8Array) => {
    console.log(
      '------------Starting transcription with audio data length:',
      audioData.length,
      'bytes'
    )

    try {
      // Create a temporary file to store the audio data
      const tempFilePath = join(tmpdir(), `audio-${Date.now()}.wav`)
      await writeFile(tempFilePath, Buffer.from(audioData))

      // Transcribe the audio file using nodejs-whisper
      const transcribedText = await nodewhisper(tempFilePath, {
        modelName: 'base.en',
        removeWavFileAfterTranscription: true,
        whisperOptions: {
          outputInCsv: false, // get output result in csv file
          outputInJson: false, // get output result in json file
          outputInJsonFull: false, // get output result in json file including more information
          outputInLrc: false, // get output result in lrc file
          outputInSrt: false, // get output result in srt file
          outputInText: true, // get output result in txt file
          outputInVtt: false, // get output result in vtt file
          outputInWords: false, // get output result in wts file for karaoke
          translateToEnglish: false, // translate from source language to english
          wordTimestamps: true, // word-level timestamps
          timestamps_length: 20, // amount of dialogue per timestamp pair
          splitOnWord: true // split on word rather than on token
        }
      })

      console.log('-------------------------------------Transcription complete:', transcribedText)

      return {
        success: true,
        text: transcribedText
      }
    } catch (error) {
      console.error('Transcription error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  })
}
