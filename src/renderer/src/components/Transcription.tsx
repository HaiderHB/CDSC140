import { useState, useEffect, useRef } from 'react'
import './Transcription.css'

const Transcription = (): JSX.Element => {
  const [isRecording, setIsRecording] = useState(false)
  const [transcription, setTranscription] = useState('')
  const [status, setStatus] = useState('connecting')
  const ws = useRef<WebSocket | null>(null)
  const [error, setError] = useState<string | null>(null)
  const transcriptionRef = useRef<HTMLDivElement>(null)
  const connectionAttempts = useRef(0)
  const isConnecting = useRef(false)
  // Queue for handling rapid transcription updates
  const pendingUpdates = useRef<string[]>([])
  const processingUpdates = useRef(false)

  useEffect(() => {
    // Connect to WebSocket server
    connectWebSocket()

    // Clean up on unmount
    return () => {
      if (ws.current) {
        ws.current.close()
      }
    }
  }, [])

  useEffect(() => {
    // Auto-scroll to the bottom of the transcription area when content changes
    if (transcriptionRef.current) {
      transcriptionRef.current.scrollTop = transcriptionRef.current.scrollHeight
    }
  }, [transcription])

  // Process transcription updates in batches for better performance
  const processTranscriptionQueue = () => {
    if (pendingUpdates.current.length === 0 || processingUpdates.current) return

    processingUpdates.current = true
    // Get latest update and clear queue
    const latestUpdate = pendingUpdates.current[pendingUpdates.current.length - 1]
    pendingUpdates.current = []

    // Update state and allow React to render before processing more
    setTranscription(latestUpdate)

    // Allow next update after a short delay (enough time for React to render)
    setTimeout(() => {
      processingUpdates.current = false
      // Process any new updates that came in while we were updating
      if (pendingUpdates.current.length > 0) {
        processTranscriptionQueue()
      }
    }, 10) // Small delay for React to render
  }

  // Add update to queue and trigger processing
  const queueTranscriptionUpdate = (text: string) => {
    pendingUpdates.current.push(text)
    if (!processingUpdates.current) {
      processTranscriptionQueue()
    }
  }

  const connectWebSocket = () => {
    // Prevent multiple connection attempts at the same time
    if (isConnecting.current) return

    try {
      isConnecting.current = true
      setStatus('connecting')
      setError(null)

      ws.current = new WebSocket('ws://localhost:9876')

      ws.current.onopen = () => {
        console.log('WebSocket connection established')
        setStatus('connected')
        setError(null)
        connectionAttempts.current = 0
        isConnecting.current = false
      }

      ws.current.onclose = (event) => {
        console.log(`WebSocket closed with code: ${event.code}`)
        setStatus('disconnected')
        isConnecting.current = false

        // Only show error if we've attempted to connect multiple times
        if (connectionAttempts.current >= 2) {
          setError('Failed to connect to transcription service')
        }

        // Exponential backoff for reconnection attempts
        const delay = Math.min(3000 * Math.pow(1.5, connectionAttempts.current), 10000)
        connectionAttempts.current++

        // Try to reconnect after a delay
        setTimeout(connectWebSocket, delay)
      }

      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error)
        // Don't set error message immediately during initial connection
        if (status !== 'connecting' || connectionAttempts.current >= 2) {
          setError('Failed to connect to transcription service')
        }
      }

      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          if (data.type === 'transcription') {
            // Use our optimized update queue instead of direct state updates
            queueTranscriptionUpdate(data.text)
          } else if (data.type === 'status') {
            if (data.status === 'started') {
              setIsRecording(true)
            } else if (data.status === 'stopped') {
              setIsRecording(false)
            } else if (data.status === 'connected') {
              setStatus('connected')
              setError(null)
            }
          }
        } catch (err) {
          console.error('Error handling WebSocket message:', err)
        }
      }

      // Use binary message format for better performance
      ws.current.binaryType = 'arraybuffer'
    } catch (err) {
      console.error('WebSocket connection error:', err)
      isConnecting.current = false
      setStatus('disconnected')

      // Only show error if not in initial connection phase
      if (status !== 'connecting' || connectionAttempts.current >= 2) {
        setError('Failed to connect to transcription service')
      }
    }
  }

  const startRecording = () => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      // Reset error before starting recording
      setError(null)
      // Clear existing transcription when starting a new recording
      setTranscription('')
      pendingUpdates.current = []
      ws.current.send(JSON.stringify({ command: 'start' }))
    } else {
      setError('WebSocket is not connected')
      // Try to reconnect
      connectWebSocket()
    }
  }

  const stopRecording = () => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ command: 'stop' }))
    } else {
      setError('WebSocket is not connected')
    }
  }

  return (
    <div className="transcription-container">
      <h1>Realtime Speech Transcription</h1>

      <div className="controls">
        <button
          className={`control-button ${isRecording ? 'stop' : 'start'}`}
          onClick={isRecording ? stopRecording : startRecording}
          disabled={status !== 'connected'}
        >
          {isRecording ? 'Stop Recording' : 'Start Recording'}
        </button>

        <div className="status-indicator">
          <div
            className={`status-dot ${
              status === 'connected'
                ? 'connected'
                : status === 'connecting'
                  ? 'connecting'
                  : 'disconnected'
            }`}
          ></div>
          <span>
            {status === 'connected'
              ? 'Connected'
              : status === 'connecting'
                ? 'Connecting...'
                : 'Disconnected'}
          </span>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="transcription-area-container">
        <h2>Transcription</h2>
        <div ref={transcriptionRef} className="transcription-area">
          {transcription || 'Transcription will appear here...'}
        </div>
      </div>
    </div>
  )
}

export default Transcription
