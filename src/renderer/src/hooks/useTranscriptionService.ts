import { useState, useRef, useEffect } from 'react'

export type WsStatus = 'disconnected' | 'connecting' | 'connected'

interface UseTranscriptionServiceProps {
  isCapturing: boolean
  onTranscriptionUpdate?: (text: string) => void
  onMatchFound?: (matchedText: string) => void
  bulletPoints: string[]
}

interface UseTranscriptionServiceResult {
  transcriptText: string
  wsStatus: WsStatus
  wsError: string | null
  connectWebSocket: () => void
  sendBulletPoints: (points: string[]) => void
  startRecording: () => void
  stopRecording: () => void
}

export const useTranscriptionService = ({
  isCapturing,
  onTranscriptionUpdate,
  onMatchFound,
  bulletPoints
}: UseTranscriptionServiceProps): UseTranscriptionServiceResult => {
  const [transcriptText, setTranscriptText] = useState<string>('')
  const [wsStatus, setWsStatus] = useState<WsStatus>('disconnected')
  const [wsError, setWsError] = useState<string | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const connectionAttemptsRef = useRef(0)
  const isConnectingRef = useRef(false)
  const pendingUpdatesRef = useRef<string[]>([])
  const processingUpdatesRef = useRef(false)
  const bulletPointsRef = useRef<string[]>(bulletPoints)

  // Update bullet points ref when they change
  useEffect(() => {
    bulletPointsRef.current = bulletPoints
  }, [bulletPoints])

  // Helper functions for processing transcription updates
  const processTranscriptionQueue = () => {
    if (pendingUpdatesRef.current.length === 0 || processingUpdatesRef.current) return

    processingUpdatesRef.current = true
    // Get latest update and clear queue
    const latestUpdate = pendingUpdatesRef.current[pendingUpdatesRef.current.length - 1]
    pendingUpdatesRef.current = []

    // Update state and allow React to render before processing more
    setTranscriptText(latestUpdate)

    // Call the onTranscriptionUpdate callback if provided
    if (onTranscriptionUpdate) {
      onTranscriptionUpdate(latestUpdate)
    }

    // Allow next update after a short delay (enough time for React to render)
    setTimeout(() => {
      processingUpdatesRef.current = false
      // Process any new updates that came in while we were updating
      if (pendingUpdatesRef.current.length > 0) {
        processTranscriptionQueue()
      }
    }, 10) // Small delay for React to render
  }

  const queueTranscriptionUpdate = (text: string) => {
    pendingUpdatesRef.current.push(text)
    if (!processingUpdatesRef.current) {
      processTranscriptionQueue()
    }
  }

  const connectWebSocket = () => {
    // Prevent multiple connection attempts at the same time
    if (isConnectingRef.current) return

    try {
      isConnectingRef.current = true
      setWsStatus('connecting')
      setWsError(null)

      wsRef.current = new WebSocket('ws://localhost:9876')

      wsRef.current.onopen = () => {
        console.log('WebSocket connection established')
        setWsStatus('connected')
        setWsError(null)
        connectionAttemptsRef.current = 0
        isConnectingRef.current = false

        // Send current bullet points once connected
        sendBulletPoints(bulletPointsRef.current)
      }

      wsRef.current.onclose = (event) => {
        console.log(`WebSocket closed with code: ${event.code}`)
        setWsStatus('disconnected')
        isConnectingRef.current = false

        // Only show error if we've attempted to connect multiple times
        if (connectionAttemptsRef.current >= 2) {
          setWsError('Failed to connect to transcription service')
        }

        // Only attempt to reconnect if we're still capturing
        if (isCapturing) {
          // Exponential backoff for reconnection attempts
          const delay = Math.min(3000 * Math.pow(1.5, connectionAttemptsRef.current), 10000)
          connectionAttemptsRef.current++

          // Try to reconnect after a delay
          setTimeout(connectWebSocket, delay)
        }
      }

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error)
        // Don't set error message immediately during initial connection
        if (wsStatus !== 'connecting' || connectionAttemptsRef.current >= 2) {
          setWsError('Failed to connect to transcription service')
        }
      }

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          switch (data.type) {
            case 'transcription':
              // Queue transcription update
              queueTranscriptionUpdate(data.text)
              break
            case 'match_result':
              // Handle match result from backend
              if (data.match && onMatchFound) {
                console.log(
                  `🎯 Match found from backend: '${data.match}' (Score: ${data.score.toFixed(2)})`
                )
                // Use the match handler if provided
                onMatchFound(data.match)
              } else {
                console.log(
                  `No match found from backend (Score: ${data.score?.toFixed(2) || 'unknown'})`
                )
              }
              break
            case 'status':
              console.log(`Received status update: ${data.status}`, data)
              if (data.status === 'connected') {
                setWsStatus('connected')
                setWsError(null)
              } else if (data.status === 'bullets_updated') {
                console.log(`Backend confirmed ${data.count} bullet points updated.`)
              } else if (data.status === 'started') {
                console.log('Backend confirmed recording started.')
              } else if (data.status === 'stopped') {
                console.log('Backend confirmed recording stopped.')
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
      setWsStatus('disconnected')

      // Only show error if not in initial connection phase
      if (wsStatus !== 'connecting' || connectionAttemptsRef.current >= 2) {
        setWsError('Failed to connect to transcription service')
      }
    }
  }

  const sendBulletPoints = (points: string[]) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && points.length > 0) {
      console.log('🔄 Sending updated bullet points to backend:', points)
      wsRef.current.send(
        JSON.stringify({
          type: 'set_bullet_points',
          payload: { points: points }
        })
      )
    }
  }

  const startRecording = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log('Starting transcription recording')
      setWsError(null)
      setTranscriptText('')
      pendingUpdatesRef.current = []

      // Send current bullet points right before starting recording
      if (bulletPointsRef.current.length > 0) {
        sendBulletPoints(bulletPointsRef.current)
      }

      // Wait a short moment for bullet points to be processed
      setTimeout(() => {
        // Then start recording
        wsRef.current?.send(
          JSON.stringify({
            type: 'control',
            payload: { command: 'start' }
          })
        )
      }, 200) // Small delay to ensure bullet points are processed first
    } else if (wsStatus === 'connecting') {
      // If still connecting, try again shortly
      setTimeout(startRecording, 500)
    } else {
      console.error('WebSocket is not connected, cannot start recording')
      connectWebSocket() // Try to reconnect
      setTimeout(startRecording, 1000) // Try again shortly
    }
  }

  const stopRecording = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log('Stopping transcription recording')
      wsRef.current.send(
        JSON.stringify({
          type: 'control',
          payload: { command: 'stop' }
        })
      )
    }
  }

  // Clean up WebSocket connection when unmounting or when isCapturing changes to false
  useEffect(() => {
    if (!isCapturing && wsRef.current) {
      wsRef.current.close(1000, 'Capture stopped')
    }

    // Clean up function
    return () => {
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounted')
        wsRef.current = null
      }
    }
  }, [isCapturing])

  // Effect to send bullet points to the backend when they change
  useEffect(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && bulletPoints.length > 0) {
      sendBulletPoints(bulletPoints)
    }
  }, [bulletPoints])

  return {
    transcriptText,
    wsStatus,
    wsError,
    connectWebSocket,
    sendBulletPoints,
    startRecording,
    stopRecording
  }
}
