import { useEffect, useRef, useState, useCallback } from 'react'
import SemanticMatcher from '../utils/semanticMatching'

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

  // Create a ref for the semantic matcher
  const semanticMatcherRef = useRef<SemanticMatcher | null>(null)

  // Wrap onMatchFound in useCallback to prevent it from changing on each render
  const stableOnMatchFound = useCallback((matchedPoint: string) => {
    console.log('🔍 Match found in semantic matcher, calling onMatchFound...')
    onMatchFound(matchedPoint)
  }, [])

  // WebSocket refs
  const wsRef = useRef<WebSocket | null>(null)
  const connectionAttemptsRef = useRef(0)
  const isConnectingRef = useRef(false)
  const pendingUpdatesRef = useRef<string[]>([])

  // Initialize semantic matcher on component mount - only ONCE
  useEffect(() => {
    if (!semanticMatcherRef.current) {
      console.log('Initializing semantic matcher')
      semanticMatcherRef.current = new SemanticMatcher(stableOnMatchFound)
    }

    return () => {
      if (semanticMatcherRef.current) {
        semanticMatcherRef.current.dispose()
        semanticMatcherRef.current = null
      }
    }
  }, []) // Empty dependency array - run only once

  // Update bullet points when they change
  useEffect(() => {
    const updateBulletPoints = async () => {
      if (semanticMatcherRef.current) {
        if (bulletPoints.length > 0) {
          console.log('🔄 Updating bullet points in semantic matcher:', bulletPoints)
          await semanticMatcherRef.current.setBulletPoints(bulletPoints)
          console.log('✅ Bullet points updated successfully in semantic matcher')
        } else {
          console.log('⚠️ No bullet points to set in semantic matcher')
        }
      } else {
        console.error('❌ Cannot update bullet points - semantic matcher not initialized')
      }
    }

    updateBulletPoints()
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

          // Send a periodic ping to keep the connection alive
          const pingInterval = setInterval(() => {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ command: 'ping' }))
            } else {
              clearInterval(pingInterval)
            }
          }, 30000) // Ping every 30 seconds

          // Store the interval reference for cleanup
          recordingIntervalRef.current = pingInterval as unknown as number
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
          } else if (data.type === 'pong') {
            // Received pong response from server
            console.log('Received pong from transcription server')
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

      // Try to reconnect if we're still listening
      if (isListening) {
        const delay = Math.min(3000 * Math.pow(1.5, connectionAttemptsRef.current), 10000)
        connectionAttemptsRef.current++
        setTimeout(connectWebSocket, delay)
      }
    }
  }

  // Process transcription using the semantic matcher
  const processTranscription = async (text: string) => {
    if (!text || text.trim() === '') return

    console.log('Received transcription:', text)
    onTranscript(text)

    // Use semantic matcher to find matches
    if (semanticMatcherRef.current) {
      await semanticMatcherRef.current.processTranscription(text)
    } else {
      console.error('Semantic matcher not initialized')
    }
  }

  const startListening = async () => {
    try {
      // Reset the semantic matcher
      if (semanticMatcherRef.current) {
        semanticMatcherRef.current.reset()

        // Make sure the matcher has the latest bullet points
        if (bulletPoints.length > 0) {
          await semanticMatcherRef.current.setBulletPoints(bulletPoints)
        }
      }

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

      // Close WebSocket connection
      try {
        wsRef.current.close()
        wsRef.current = null
      } catch (err) {
        console.error('Error closing WebSocket:', err)
      }
    }

    // Clear pending chunks
    pendingChunksRef.current = []

    // Clear intervals
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current)
      recordingIntervalRef.current = null
    }

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
      setIsListening(false)
      console.log('Speech recognition stopped')
    }

    // Reset semantic matcher state
    if (semanticMatcherRef.current) {
      semanticMatcherRef.current.reset()
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
      // Dispose semantic matcher
      if (semanticMatcherRef.current) {
        semanticMatcherRef.current.dispose()
        semanticMatcherRef.current = null
      }
    }
  }, [])

  return { isListening, startListening, stopListening }
}
