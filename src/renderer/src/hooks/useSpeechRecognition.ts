import { useEffect, useRef, useState } from 'react'
import * as use from '@tensorflow-models/universal-sentence-encoder'
import * as tf from '@tensorflow/tfjs'

interface UseSpeechRecognitionProps {
  onTranscript: (text: string) => void
  bulletPoints: string[]
  onMatchFound: (matchedPoint: string) => void
}

export const useSpeechRecognition = ({
  onTranscript,
  bulletPoints,
  onMatchFound
}: UseSpeechRecognitionProps) => {
  const [isListening, setIsListening] = useState(false)
  const modelRef = useRef<any>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Initialize Universal Sentence Encoder
  useEffect(() => {
    let isMounted = true

    const loadModel = async () => {
      try {
        if (isMounted) {
          console.log('Loading Universal Sentence Encoder model...')
          modelRef.current = await use.load()
          console.log('Universal Sentence Encoder model loaded successfully')
        }
      } catch (error) {
        console.error('Error loading Universal Sentence Encoder:', error)
      }
    }
    loadModel()

    // Cleanup function
    return () => {
      isMounted = false
      if (modelRef.current) {
        // Clean up any tensors and model resources
        tf.dispose(modelRef.current)
      }
    }
  }, [])

  const processAudioChunk = async (audioChunk: Blob | ArrayBuffer) => {
    try {
      // Handle both Blob and ArrayBuffer inputs
      let arrayBuffer: ArrayBuffer
      if (audioChunk instanceof Blob) {
        arrayBuffer = await audioChunk.arrayBuffer()
      } else {
        arrayBuffer = audioChunk
      }
      console.log('Processing audio data')

      // For Int16Buffer input, which is what the audio processor sends
      // The server expects Int16Array data
      const uint8Array = new Uint8Array(arrayBuffer)
      console.log(`Converted to Uint8Array of length ${uint8Array.length}`)

      if (uint8Array.length === 0) {
        console.warn('No audio data to transcribe')
        return
      }

      // Ensure the WebSocket server is started
      console.log('Sending audio data for transcription, size:', uint8Array.length, 'bytes')
      console.time('transcription')

      try {
        // Send the audio data to main process for transcription
        const fullTranscript = await window.api.transcribeAudio(uint8Array)
        console.timeEnd('transcription')

        if (fullTranscript) {
          console.log('Received transcription from Whisper:', fullTranscript)
          onTranscript(fullTranscript)

          // Compare with bullet points if we have the model loaded
          if (modelRef.current && bulletPoints.length > 0) {
            try {
              console.log('Comparing transcript with bullet points:', bulletPoints)
              // Get embeddings for the transcript and bullet points
              const transcriptEmbedding = await modelRef.current.embed([fullTranscript])
              const bulletPointEmbeddings = await modelRef.current.embed(bulletPoints)

              // Calculate cosine similarity between transcript and each bullet point
              const transcriptTensor = transcriptEmbedding as tf.Tensor
              const bulletPointTensor = bulletPointEmbeddings as tf.Tensor

              // Use tensor operations for better performance
              const scores = tf.matMul(transcriptTensor, bulletPointTensor, false, true)
              const similarities = scores.dataSync()

              // Log similarities for each bullet point
              similarities.forEach((score, index) => {
                console.log(`Similarity with "${bulletPoints[index]}": ${score.toFixed(3)}`)
              })

              // Clean up tensors
              tf.dispose([transcriptTensor, bulletPointTensor, scores])

              // Check similarities against threshold
              for (let i = 0; i < similarities.length; i++) {
                if (similarities[i] > 0.7) {
                  console.log(`Match found! Removing bullet point: ${bulletPoints[i]}`)
                  onMatchFound(bulletPoints[i])
                }
              }
            } catch (error) {
              console.error('Error comparing embeddings:', error)
            }
          }
        } else {
          console.warn('No transcription received')
        }
      } catch (error) {
        console.error('Error from transcription service:', error)
      }
    } catch (error) {
      console.error('Error processing audio chunk:', error)
    }
  }

  const startListening = async () => {
    try {
      console.log('Requesting microphone access...')
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      console.log('Microphone access granted')
      streamRef.current = stream

      // Start the Python WebSocket server via IPC
      console.log('Requesting main process to start Python WebSocket server...')
      await window.api.startPythonServer()
      console.log('Python WebSocket server started')

      const audioContext = new AudioContext()

      await audioContext.audioWorklet.addModule('/scripts/audio-processor.js')

      const audioWorkletNode = new AudioWorkletNode(audioContext, 'audio-processor')
      const source = audioContext.createMediaStreamSource(stream)
      source.connect(audioWorkletNode)

      audioWorkletNode.port.onmessage = (event) => {
        const audioChunk = event.data
        if (audioChunk.byteLength > 0) {
          console.log(`Received audio chunk of size ${audioChunk.byteLength} bytes`)
          // Directly send the audio chunk for transcription
          processAudioChunk(audioChunk)
        }
      }

      setIsListening(true)
      console.log('Speech recognition is now active')
    } catch (error) {
      console.error('Error starting audio recording:', error)
      setIsListening(false)
    }
  }

  const stopListening = () => {
    if (mediaRecorderRef.current && streamRef.current) {
      try {
        console.log('Stopping audio recording...')
        mediaRecorderRef.current.stop()
        console.log('MediaRecorder stopped')

        streamRef.current.getTracks().forEach((track) => {
          console.log('Stopping audio track')
          track.stop()
        })
        streamRef.current = null

        if (recordingIntervalRef.current) {
          console.log('Clearing audio processing interval')
          clearInterval(recordingIntervalRef.current)
          recordingIntervalRef.current = null
        }

        // Stop the Python WebSocket server via IPC
        console.log('Requesting main process to stop Python WebSocket server...')
        window.api.stopPythonServer()

        setIsListening(false)
        console.log('Speech recognition stopped')
      } catch (error) {
        console.error('Error stopping audio recording:', error)
      }
    } else {
      // Even if there's no mediaRecorder, we should still clean up
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current)
        recordingIntervalRef.current = null
      }
      // Stop the Python WebSocket server via IPC
      window.api.stopPythonServer()
      setIsListening(false)
      console.log('Speech recognition stopped')
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening()
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current)
      }
    }
  }, [])

  return { isListening, startListening, stopListening }
}
