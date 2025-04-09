import { useEffect, useRef, useState, useCallback } from 'react'

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
    if (isConnectingRef.current || wsRef.current) return

    try {
      console.log('🔄 [useSpeechRecognition] Starting WebSocket connection...')
      isConnectingRef.current = true

      wsRef.current = new WebSocket('ws://localhost:9876')

      wsRef.current.onopen = () => {
        console.log('✅ [useSpeechRecognition] WebSocket connection established')
        connectionAttemptsRef.current = 0
        isConnectingRef.current = false

        // Send current bullet points immediately upon connection
        console.log(
          '🔄 [useSpeechRecognition] Sending initial bullet points to backend:',
          bulletPoints
        )
        sendWsMessage(wsRef.current, {
          type: 'set_bullet_points',
          payload: { points: bulletPoints }
        })

        // Start recording process if isListening is true
        if (isListening) {
          console.log(
            '🔄 [useSpeechRecognition] WebSocket reconnected while listening, sending start command...'
          )
          sendWsMessage(wsRef.current, {
            type: 'control',
            payload: { command: 'start' }
          })

          // Set up ping interval
          if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current)
          recordingIntervalRef.current = setInterval(() => {
            console.log('🔄 [useSpeechRecognition] Sending ping to keep connection alive...')
            sendWsMessage(wsRef.current, {
              type: 'control',
              payload: { command: 'ping' }
            })
          }, 30000) as unknown as number
        }
      }

      wsRef.current.onclose = (event) => {
        console.log(`❌ [useSpeechRecognition] WebSocket closed with code: ${event.code}`)
        isConnectingRef.current = false
        wsRef.current = null

        if (isListening) {
          const delay = Math.min(3000 * Math.pow(1.5, connectionAttemptsRef.current), 10000)
          connectionAttemptsRef.current++
          console.log(`🔄 [useSpeechRecognition] Attempting reconnect in ${delay}ms...`)
          setTimeout(connectWebSocket, delay)
        }
      }

      wsRef.current.onerror = (error) => {
        console.error('❌ [useSpeechRecognition] WebSocket error:', error)
        isConnectingRef.current = false
        wsRef.current = null
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
      console.warn('⚠️ [useSpeechRecognition] startListening called while already listening')
      return
    }
    try {
      console.log('🎤 [useSpeechRecognition] Requesting microphone access...')
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      })
      console.log('✅ [useSpeechRecognition] Microphone access granted')
      streamRef.current = stream

      setIsListening(true) // Set state first
      console.log('🔄 [useSpeechRecognition] Starting WebSocket connection for audio streaming...')
      connectWebSocket() // This now handles sending bullets and start command on successful connection

      const audioContext = new AudioContext()
      console.log('🎵 [useSpeechRecognition] Setting up audio processing...')

      // Use the correct path to the audio processor script
      const processorUrl = '/scripts/audio-processor.js'
      console.log('📥 [useSpeechRecognition] Loading audio processor from:', processorUrl)

      try {
        await audioContext.audioWorklet.addModule(processorUrl)
        console.log('✅ [useSpeechRecognition] Audio processor loaded successfully')
      } catch (err) {
        console.error('❌ [useSpeechRecognition] Failed to load audio processor:', err)
        setIsListening(false)
        if (streamRef.current) streamRef.current.getTracks().forEach((track) => track.stop())
        throw err
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
          pendingChunksRef.current.push(audioChunk)
        }
      }

      console.log('✅ [useSpeechRecognition] Audio processing setup complete')
    } catch (error) {
      console.error('❌ [useSpeechRecognition] Error starting audio recording:', error)
      setIsListening(false)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
    }
  }

  const stopListening = () => {
    if (!isListening) {
      console.warn('⚠️ [useSpeechRecognition] stopListening called while not listening')
      return
    }

    console.log('⏹️ [useSpeechRecognition] Stopping speech recognition...')
    setIsListening(false)

    // Stop WebSocket connection and command
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log('🛑 [useSpeechRecognition] Sending stop command to backend')
      sendWsMessage(wsRef.current, {
        type: 'control',
        payload: { command: 'stop' }
      })
    } else {
      console.warn('⚠️ [useSpeechRecognition] WebSocket not open when trying to send stop command')
    }

    // Close WebSocket if it exists
    if (wsRef.current) {
      console.log('🔌 [useSpeechRecognition] Closing WebSocket connection')
      wsRef.current.close(1000, 'Client stopping listening')
      wsRef.current = null
    }

    // Clear pending chunks
    pendingChunksRef.current = []

    // Clear intervals
    if (recordingIntervalRef.current) {
      console.log('⏱️ [useSpeechRecognition] Clearing recording interval')
      clearInterval(recordingIntervalRef.current)
      recordingIntervalRef.current = null
    }

    // Stop media stream tracks
    if (streamRef.current) {
      console.log('🎤 [useSpeechRecognition] Stopping audio tracks')
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    console.log('✅ [useSpeechRecognition] Speech recognition stopped')
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
