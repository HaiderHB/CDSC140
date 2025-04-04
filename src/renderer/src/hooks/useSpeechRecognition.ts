import { useEffect, useRef, useState, useCallback } from 'react'

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

// Helper function to send messages safely
const sendWsMessage = (ws: WebSocket | null, message: object) => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(message))
    } catch (err) {
      console.error('Error sending WebSocket message:', err)
    }
  } else {
    console.warn('WebSocket not open, cannot send message:', message)
  }
}

export const useSpeechRecognition = ({
  onTranscript,
  bulletPoints,
  onMatchFound
}: UseSpeechRecognitionProps) => {
  const [isListening, setIsListening] = useState(false)
  const streamRef = useRef<MediaStream | null>(null)
  const recordingIntervalRef = useRef<number | null>(null)
  const processingRef = useRef(false)
  const pendingChunksRef = useRef<ArrayBuffer[]>([])

  // Wrap onMatchFound in useCallback for stability if needed elsewhere, but not strictly necessary now
  const stableOnMatchFound = useCallback(
    (matchedPoint: string) => {
      onMatchFound(matchedPoint)
    },
    [onMatchFound]
  )

  // WebSocket refs
  const wsRef = useRef<WebSocket | null>(null)
  const connectionAttemptsRef = useRef(0)
  const isConnectingRef = useRef(false)

  // Send bullet points to backend when they change or when WS connects
  useEffect(() => {
    // Function to send bullet points
    const sendBulletPointsToBackend = () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        console.log('🔄 Sending updated bullet points to backend:', bulletPoints)
        sendWsMessage(wsRef.current, {
          type: 'set_bullet_points',
          payload: { points: bulletPoints }
        })
      } else {
        console.warn('Cannot send bullet points - WebSocket not connected.')
        // Optionally retry or wait for connection
      }
    }

    // Send immediately if already connected
    if (isListening) {
      // Only send if actively listening/connected state expected
      sendBulletPointsToBackend()
    }
    // The connectWebSocket function will also call this upon successful connection.
  }, [bulletPoints, isListening]) // Also depend on isListening to send when starting

  // WebSocket connection logic
  const connectWebSocket = () => {
    // Prevent multiple connection attempts at the same time
    if (isConnectingRef.current || wsRef.current) return // Don't reconnect if already connected or connecting

    try {
      isConnectingRef.current = true
      console.log('Connecting to transcription WebSocket server...')

      wsRef.current = new WebSocket('ws://localhost:9876')

      wsRef.current.onopen = () => {
        console.log('WebSocket connection established')
        connectionAttemptsRef.current = 0
        isConnectingRef.current = false

        // Send current bullet points immediately upon connection
        console.log('🔄 Sending initial bullet points to backend:', bulletPoints)
        sendWsMessage(wsRef.current, {
          type: 'set_bullet_points',
          payload: { points: bulletPoints }
        })

        // Start recording process (send start command) if isListening is true
        if (isListening) {
          console.log('WebSocket reconnected while listening, sending start command...')
          sendWsMessage(wsRef.current, {
            type: 'control',
            payload: { command: 'start' }
          })

          // Send a periodic ping to keep the connection alive
          // Clear previous interval if any
          if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current)
          recordingIntervalRef.current = setInterval(() => {
            sendWsMessage(wsRef.current, {
              type: 'control',
              payload: { command: 'ping' }
            })
          }, 30000) as unknown as number // Ping every 30 seconds
        }
      }

      wsRef.current.onclose = (event) => {
        console.log(`WebSocket closed with code: ${event.code}`)
        isConnectingRef.current = false
        wsRef.current = null // Clear the ref
        // Clear ping interval
        if (recordingIntervalRef.current) {
          clearInterval(recordingIntervalRef.current)
          recordingIntervalRef.current = null
        }

        // Only attempt to reconnect if we intended to be listening
        if (isListening) {
          // Exponential backoff for reconnection attempts
          const delay = Math.min(3000 * Math.pow(1.5, connectionAttemptsRef.current), 10000)
          connectionAttemptsRef.current++
          console.log(`WebSocket disconnected, attempting reconnect in ${delay}ms...`)
          // Try to reconnect after a delay
          setTimeout(connectWebSocket, delay)
        }
      }

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error)
        // Consider closing and triggering reconnect on error as well
        if (wsRef.current) {
          wsRef.current.close() // This will trigger onclose handler for reconnect logic
        }
        isConnectingRef.current = false // Ensure connection attempts can proceed
      }

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          switch (data.type) {
            case 'transcription':
              // Directly use the latest transcription from the backend
              onTranscript(data.text)
              break
            case 'match_result':
              // Handle match result from backend
              if (data.match) {
                console.log(`Match found: '${data.match}' (Score: ${data.score.toFixed(2)})`)
                stableOnMatchFound(data.match)
              }
              // Optionally handle cases where match is null (below threshold) if needed
              break
            case 'status':
              // Handle status updates from backend (e.g., connected, started, stopped, bullets_updated)
              console.log(`Received status update: ${data.status}`, data)
              if (data.status === 'bullets_updated') {
                console.log(`Backend confirmed ${data.count} bullet points updated.`)
              } else if (data.status === 'started') {
                console.log('Backend confirmed recording started.')
                // Might sync internal state if needed, though startListening should handle it
              } else if (data.status === 'stopped') {
                console.log('Backend confirmed recording stopped.')
                // Might sync internal state if needed
              }
              break
            case 'control':
              if (data.payload?.command === 'pong') {
                console.log('Received pong from transcription server')
              }
              break
            default:
              console.warn('Received unknown message type from backend:', data.type)
          }
        } catch (err) {
          console.error('Error handling WebSocket message:', err, event.data)
        }
      }

      // Use binary message format for better performance
      wsRef.current.binaryType = 'arraybuffer'
    } catch (err) {
      console.error('WebSocket connection error:', err)
      isConnectingRef.current = false
      wsRef.current = null // Clear the ref

      // Try to reconnect if we're still listening
      if (isListening) {
        const delay = Math.min(3000 * Math.pow(1.5, connectionAttemptsRef.current), 10000)
        connectionAttemptsRef.current++
        console.log(`WebSocket connection failed, attempting reconnect in ${delay}ms...`)
        setTimeout(connectWebSocket, delay)
      }
    }
  }

  const startListening = async () => {
    // Guard against starting if already listening
    if (isListening) {
      console.warn('startListening called while already listening.')
      return
    }
    try {
      console.log('Requesting microphone access...')
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          // Optional: Add constraints for better quality if needed
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      })
      console.log('Microphone access granted')
      streamRef.current = stream

      setIsListening(true) // Set state first

      // Start WebSocket connection (will handle sending bullets/start command onopen)
      connectWebSocket() // This now handles sending bullets and start command on successful connection

      const audioContext = new AudioContext()

      // Use the correct path to the audio processor script
      const processorUrl = '/scripts/audio-processor.js' // Relative path should work if served correctly
      console.log('Loading audio processor from:', processorUrl)

      try {
        await audioContext.audioWorklet.addModule(processorUrl)
        console.log('Audio processor loaded successfully')
      } catch (err) {
        console.error('Failed to load audio processor:', err)
        setIsListening(false) // Reset state on failure
        if (streamRef.current) streamRef.current.getTracks().forEach((track) => track.stop()) // Clean up stream
        throw err // Re-throw error
      }

      const audioWorkletNode = new AudioWorkletNode(audioContext, 'audio-processor')
      const source = audioContext.createMediaStreamSource(stream)
      source.connect(audioWorkletNode)

      // Reset processing state
      processingRef.current = false
      pendingChunksRef.current = []

      audioWorkletNode.port.onmessage = (event) => {
        const audioChunk = event.data
        if (audioChunk.byteLength > 0) {
          // Add to pending chunks instead of processing immediately
          pendingChunksRef.current.push(audioChunk)
        }
      }

      console.log(
        'Speech recognition setup complete, waiting for WebSocket connection to start sending audio.'
      )
      // NOTE: Actual audio sending starts when WebSocket connection is open (handled by useEffect + sendAudioChunk)
    } catch (error) {
      console.error('Error starting audio recording:', error)
      setIsListening(false)
      // Clean up stream if acquired
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
    }
  }

  const stopListening = () => {
    // Guard against stopping if not listening
    if (!isListening) {
      console.warn('stopListening called while not listening.')
      return
    }

    console.log('Stopping speech recognition...')
    setIsListening(false) // Set state immediately

    // Stop WebSocket connection and command
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log('Sending stop command to backend')
      sendWsMessage(wsRef.current, {
        type: 'control',
        payload: { command: 'stop' }
      })

      // Close WebSocket connection gracefully after sending stop command
      // Let the onclose handler manage cleanup and prevent immediate reconnect attempts
      // wsRef.current.close() // Consider delaying close or letting onclose handle state
    } else {
      console.warn('WebSocket not open when trying to send stop command.')
    }

    // Close WebSocket if it exists (will trigger onclose which stops reconnect logic because isListening is false)
    if (wsRef.current) {
      wsRef.current.close(1000, 'Client stopping listening')
      wsRef.current = null // Clear ref immediately
    }

    // Clear pending chunks
    pendingChunksRef.current = []

    // Clear intervals
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current)
      recordingIntervalRef.current = null
    }

    // Stop media stream tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        console.log('Stopping audio track')
        track.stop()
      })
      streamRef.current = null
    }

    console.log('Speech recognition stopped')
  }

  // Add audio processing and WebSocket audio transmission
  useEffect(() => {
    let intervalId: number | null = null
    if (isListening) {
      // Only run interval if listening
      // Process audio chunks at regular intervals
      intervalId = setInterval(() => {
        // Ensure WebSocket is open before attempting to send
        if (
          wsRef.current &&
          wsRef.current.readyState === WebSocket.OPEN &&
          pendingChunksRef.current.length > 0 &&
          !processingRef.current
        ) {
          const chunk = pendingChunksRef.current.shift()
          if (chunk) {
            sendAudioChunk(chunk)
          }
        } else if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          // console.log("WS not open, holding audio chunks...") // Optional logging
        }
      }, 100) as unknown as number // Process chunks every 100ms
    } else {
      // Clear interval if not listening
      if (intervalId) clearInterval(intervalId)
    }

    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [isListening]) // Depend only on isListening state

  const sendAudioChunk = (audioChunk: ArrayBuffer) => {
    // This function remains largely the same, just ensure wsRef.current is checked
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      // If WebSocket is not open, queue the chunk for later (or potentially discard if too old)
      console.warn('WebSocket not open, requeuing audio chunk.')
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
      console.log('Cleaning up useSpeechRecognition hook...')
      // Ensure stopListening is called which handles most cleanup
      stopListening()

      // Explicitly clear interval just in case
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current)
        recordingIntervalRef.current = null
      }
      // Explicitly close WebSocket if stopListening didn't catch it
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounting')
        wsRef.current = null
      }
      // Ensure stream tracks are stopped
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
    }
  }, []) // Empty dependency array ensures this runs only on unmount

  return { isListening, startListening, stopListening }
}
