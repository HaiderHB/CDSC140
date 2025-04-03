import { useEffect, useRef, useState } from 'react'
import * as use from '@tensorflow-models/universal-sentence-encoder'
import * as tf from '@tensorflow/tfjs'
import whisper from 'whisper-node'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

// Add Web Speech API type definitions
interface SpeechGrammarList {
  addFromString(string: string, weight?: number): void
  addFromURI(src: string, weight?: number): void
  length: number
  item(index: number): SpeechGrammar
}

interface SpeechGrammar {
  src: string
  weight: number
}

interface WebkitSpeechRecognition extends SpeechRecognition {
  maxAlternatives?: number
  grammars?: SpeechGrammarList | null
  serviceURI?: string
  onstart?: (event: Event) => void
}

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
    if (audioChunksRef.current.length === 0) return

    try {
      // Create a single blob from all chunks
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' })

      // Convert blob to buffer
      const arrayBuffer = await audioBlob.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      // Create a temporary file path
      const tempFilePath = join(tmpdir(), `recording-${Date.now()}.wav`)

      // Write the buffer to a temporary file
      await writeFile(tempFilePath, buffer)

      // Transcribe using whisper-node
      const transcript = await whisper(tempFilePath, {
        modelName: 'base.en',
        whisperOptions: {
          language: 'en',
          word_timestamps: true
        }
      })

      // Combine all speech segments into a single transcript
      const fullTranscript = transcript.map((segment) => segment.speech).join(' ')

      console.log('Full transcript:', fullTranscript)
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

      // Clean up the temporary file
      await writeFile(tempFilePath, '')
    } catch (error) {
      console.error('Error processing audio chunks:', error)
    }
  }

  const startListening = async () => {
    try {
      console.log('Starting audio recording...')
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      // Process audio chunks every 5 seconds
      recordingIntervalRef.current = setInterval(processAudioChunks, 5000)

      mediaRecorder.start(1000) // Collect data every second
      setIsListening(true)
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
        streamRef.current.getTracks().forEach((track) => track.stop())

        if (recordingIntervalRef.current) {
          clearInterval(recordingIntervalRef.current)
          recordingIntervalRef.current = null
        }

        // Process any remaining audio chunks
        processAudioChunks()

        setIsListening(false)
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
