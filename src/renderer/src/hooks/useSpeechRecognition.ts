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
  const audioChunksRef = useRef<Blob[]>([])
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

  const processAudioChunks = async () => {
    if (audioChunksRef.current.length === 0) {
      console.log('No audio chunks to process')
      return
    }

    try {
      console.log(`Processing ${audioChunksRef.current.length} audio chunks...`)
      // Create a single blob from all chunks
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' })
      console.log(`Created audio blob of size ${audioBlob.size} bytes`)

      // Convert blob to ArrayBuffer
      const arrayBuffer = await audioBlob.arrayBuffer()
      console.log('Converted audio blob to ArrayBuffer')

      // Convert to Uint8Array for transmission
      const uint8Array = new Uint8Array(arrayBuffer)
      console.log(`Converted to Uint8Array of length ${uint8Array.length}`)

      if (uint8Array.length === 0) {
        console.warn('No audio data to transcribe')
        return
      }

      console.log('Sending audio data for transcription, size:', uint8Array.length, 'bytes')
      console.time('transcription')

      // Send to main process for transcription using exposed IPC
      const fullTranscript = await window.api.transcribeAudio(uint8Array)
      console.timeEnd('transcription')
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
    } catch (error) {
      console.error('Error processing audio chunks:', error)
    }
  }

  const startListening = async () => {
    try {
      console.log('Requesting microphone access...')
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      console.log('Microphone access granted')
      streamRef.current = stream

      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log(`Received audio chunk of size ${event.data.size} bytes`)
          audioChunksRef.current.push(event.data)
        }
      }

      // Process audio chunks every 5 seconds
      console.log('Setting up audio processing interval (every 5 seconds)')
      recordingIntervalRef.current = setInterval(processAudioChunks, 5000)

      console.log('Starting MediaRecorder with 1-second timeslices')
      mediaRecorder.start(1000) // Collect data every second
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

        if (recordingIntervalRef.current) {
          console.log('Clearing audio processing interval')
          clearInterval(recordingIntervalRef.current)
          recordingIntervalRef.current = null
        }

        console.log('Processing final audio chunks...')
        // Process any remaining audio chunks
        processAudioChunks()

        setIsListening(false)
        console.log('Speech recognition stopped')
      } catch (error) {
        console.error('Error stopping audio recording:', error)
      }
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

// Helper function to calculate cosine similarity between two vectors
function cosineSimilarity(vec1: number[], vec2: number[]): number {
  const dotProduct = vec1.reduce((sum, val, i) => sum + val * vec2[i], 0)
  const norm1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0))
  const norm2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0))
  return dotProduct / (norm1 * norm2)
}
