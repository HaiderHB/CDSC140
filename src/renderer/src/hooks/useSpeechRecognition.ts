import { useEffect, useRef, useState } from 'react'
import * as tf from '@tensorflow/tfjs'
import { load as loadEncoder } from '@tensorflow-models/universal-sentence-encoder'

// Add interface for the Python server result
interface PythonServerResult {
  success: boolean
  error?: string
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
  const streamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordingIntervalRef = useRef<number | null>(null)
  const processingRef = useRef(false)
  const lastProcessedTimeRef = useRef(0)
  const pendingChunksRef = useRef<ArrayBuffer[]>([])
  const encoderModelRef = useRef<any>(null)
  const bulletPointEmbeddingsRef = useRef<tf.Tensor | null>(null)

  // WebSocket refs
  const wsRef = useRef<WebSocket | null>(null)
  const connectionAttemptsRef = useRef(0)
  const isConnectingRef = useRef(false)
  const pendingUpdatesRef = useRef<string[]>([])
  const processingUpdatesRef = useRef(false)

  // Load the Universal Sentence Encoder model for semantic matching
  useEffect(() => {
    const loadModel = async () => {
      try {
        console.log('Loading Universal Sentence Encoder model...')
        encoderModelRef.current = await loadEncoder()
        console.log('Model loaded successfully')

        // Only compute embeddings if we have bullet points
        if (bulletPoints && bulletPoints.length > 0 && encoderModelRef.current) {
          console.log('Computing embeddings for bullet points...')
          bulletPointEmbeddingsRef.current = await encoderModelRef.current.embed(bulletPoints)
          console.log('Embeddings computed successfully')
        }
      } catch (error) {
        console.error('Error loading Universal Sentence Encoder model:', error)
      }
    }

    loadModel()

    return () => {
      // Clean up tensors to prevent memory leaks
      if (bulletPointEmbeddingsRef.current) {
        bulletPointEmbeddingsRef.current.dispose()
        bulletPointEmbeddingsRef.current = null
      }
    }
  }, [bulletPoints])

  // Re-compute embeddings when bullet points change
  useEffect(() => {
    const updateEmbeddings = async () => {
      if (encoderModelRef.current && bulletPoints && bulletPoints.length > 0) {
        console.log('Updating embeddings for bullet points...')

        // Clean up previous embeddings
        if (bulletPointEmbeddingsRef.current) {
          bulletPointEmbeddingsRef.current.dispose()
        }

        bulletPointEmbeddingsRef.current = await encoderModelRef.current.embed(bulletPoints)
        console.log('Embeddings updated successfully')
      }
    }

    updateEmbeddings()
  }, [bulletPoints])

  // WebSocket connection logic
  const connectWebSocket = () => {
    // Prevent multiple connection attempts at the same time
    if (isConnectingRef.current) return

    try {
      isConnectingRef.current = true
      console.log('Connecting to transcription WebSocket server...')

      wsRef.current = new WebSocket('ws://localhost:9876')

      wsRef.current.onopen = () => {
        console.log('WebSocket connection established')
        connectionAttemptsRef.current = 0
        isConnectingRef.current = false

        // Start recording once connected
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          console.log('Starting transcription recording')
          pendingUpdatesRef.current = []
          wsRef.current.send(JSON.stringify({ command: 'start' }))
        }
      }

      wsRef.current.onclose = (event) => {
        console.log(`WebSocket closed with code: ${event.code}`)
        isConnectingRef.current = false

        // Only attempt to reconnect if we're still recording
        if (isListening) {
          // Exponential backoff for reconnection attempts
          const delay = Math.min(3000 * Math.pow(1.5, connectionAttemptsRef.current), 10000)
          connectionAttemptsRef.current++

          // Try to reconnect after a delay
          setTimeout(connectWebSocket, delay)
        }
      }

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error)
      }

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          if (data.type === 'transcription') {
            // Process the transcription
            processTranscription(data.text)
          }
        } catch (err) {
          console.error('Error handling WebSocket message:', err)
        }
      }

      // Use binary message format for better performance
      wsRef.current.binaryType = 'arraybuffer'
    } catch (err) {
      console.error('WebSocket connection error:', err)
      isConnectingRef.current = false
    }
  }

  // Process transcription and perform semantic matching
  const processTranscription = async (text: string) => {
    if (!text || text.trim() === '') return

    console.log('Received transcription:', text)
    onTranscript(text)

    // Check for matches with bullet points using semantic search
    if (encoderModelRef.current && bulletPointEmbeddingsRef.current && bulletPoints.length > 0) {
      try {
        // Get embedding for the transcription
        const transcriptionEmbedding = await encoderModelRef.current.embed([text])

        // Compute similarities
        const similarities = tf.matMul(
          transcriptionEmbedding as tf.Tensor2D,
          (bulletPointEmbeddingsRef.current as tf.Tensor2D).transpose()
        )

        // Find the best match
        const values = await similarities.data()
        const maxValue = Math.max(...Array.from(values))

        // If the similarity is high enough, consider it a match
        const SIMILARITY_THRESHOLD = 0.65
        if (maxValue > SIMILARITY_THRESHOLD) {
          const matchIndex = Array.from(values).indexOf(maxValue)
          const matchedPoint = bulletPoints[matchIndex]

          console.log(`Match found with similarity ${maxValue}:`, matchedPoint)
          onMatchFound(matchedPoint)
        }

        // Clean up tensors
        transcriptionEmbedding.dispose()
        similarities.dispose()
      } catch (error) {
        console.error('Error performing semantic matching:', error)
      }
    }
  }

  const startListening = async () => {
    try {
      console.log('Requesting microphone access...')
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      console.log('Microphone access granted')
      streamRef.current = stream

      // Start WebSocket connection for transcription
      connectWebSocket()

      const audioContext = new AudioContext()

      // Use the correct path to the audio processor script
      const processorUrl = window.location.origin + '/scripts/audio-processor.js'
      console.log('Loading audio processor from:', processorUrl)

      try {
        await audioContext.audioWorklet.addModule(processorUrl)
        console.log('Audio processor loaded successfully')
      } catch (err) {
        console.error('Failed to load audio processor:', err)
        throw err
      }

      const audioWorkletNode = new AudioWorkletNode(audioContext, 'audio-processor')
      const source = audioContext.createMediaStreamSource(stream)
      source.connect(audioWorkletNode)

      // Reset processing state
      processingRef.current = false
      lastProcessedTimeRef.current = 0
      pendingChunksRef.current = []

      audioWorkletNode.port.onmessage = (event) => {
        const audioChunk = event.data
        if (audioChunk.byteLength > 0) {
          console.log(`Received audio chunk of size ${audioChunk.byteLength} bytes`)
          // Add to pending chunks instead of processing immediately
          pendingChunksRef.current.push(audioChunk)
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
    // Stop WebSocket connection
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log('Stopping transcription recording')
      wsRef.current.send(JSON.stringify({ command: 'stop' }))
      // Don't close the connection - just stop recording
    }

    // Clear pending chunks
    pendingChunksRef.current = []

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
      setIsListening(false)
      console.log('Speech recognition stopped')
    }
  }

  // Add audio processing and WebSocket audio transmission
  useEffect(() => {
    if (isListening && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      // Process audio chunks at regular intervals
      const intervalId = setInterval(() => {
        if (pendingChunksRef.current.length > 0 && !processingRef.current) {
          const chunk = pendingChunksRef.current.shift()
          if (chunk) {
            sendAudioChunk(chunk)
          }
        }
      }, 100) // Process chunks every 100ms

      return () => clearInterval(intervalId)
    }
  }, [isListening])

  const sendAudioChunk = (audioChunk: ArrayBuffer) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      // If WebSocket is not open, queue the chunk for later
      pendingChunksRef.current.push(audioChunk)
      return
    }

    processingRef.current = true
    try {
      // Send the raw audio data to the WebSocket server
      wsRef.current.send(audioChunk)
    } catch (error) {
      console.error('Error sending audio chunk to WebSocket server:', error)
      // If there was an error, re-queue the chunk
      pendingChunksRef.current.push(audioChunk)
    } finally {
      // Set processingRef to false after a small delay to avoid overwhelming the server
      setTimeout(() => {
        processingRef.current = false
      }, 50)
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
      // Close WebSocket connection
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [])

  return { isListening, startListening, stopListening }
}
