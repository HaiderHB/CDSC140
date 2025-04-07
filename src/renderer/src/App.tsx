import { useEffect, useRef, useState } from 'react'
import {
  Box,
  CircularProgress,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Paper,
  Snackbar,
  Alert,
  Tab,
  Tabs,
  Typography
  
} from '@mui/material'
import './App.css'
import SetupConfigPage from './components/SetupConfigPage'
import SessionList from './components/SessionList'
import ResumeManager from './components/ResumeManager'
// import Transcription from './components/Transcription'
import { useDataPersistence } from './hooks/useDataPersistence'
import { useSpeechRecognition } from './hooks/useSpeechRecognition'
import Fuse from 'fuse.js'

// Use Session type from useDataPersistence for all session-related data
interface CurrentSession {
  id: string
  name: string
  date?: string
  resumeId?: string
  resumeName?: string
  jobDescription: string
}

const TEST_MODE = false

function App(): JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const micCanvasRef = useRef<HTMLCanvasElement>(null)
  const [isCapturing, setIsCapturing] = useState(false)
  const [isClickThrough, setIsClickThrough] = useState(false)
  const streamRef = useRef<MediaStream | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const micAudioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const micAnalyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const micAnimationFrameRef = useRef<number | null>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const dataChannelRef = useRef<RTCDataChannel | null>(null)
  const [responseText, setResponseText] = useState('')
  const [bulletPoints, setBulletPoints] = useState<string[]>([])
  const [currentBulletPoint, setCurrentBulletPoint] = useState('')
  const [currentPage, setCurrentPage] = useState('main')
  const [homeTab, setHomeTab] = useState(0)
  const [currentSession, setCurrentSession] = useState<CurrentSession | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [transcriptText, setTranscriptText] = useState<string>('')
  const [wsStatus, setWsStatus] = useState('disconnected')
  const [wsError, setWsError] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const connectionAttemptsRef = useRef(0)
  const isConnectingRef = useRef(false)
  const pendingUpdatesRef = useRef<string[]>([])
  const processingUpdatesRef = useRef(false)
  const bulletPointsRef = useRef<string[]>([])
  const bulletPointsInitializedRef = useRef(false)

  const {
    sessions,
    resumes,
    loadingSessions,
    loadingResumes,
    loadSessionsError,
    loadResumesError,
    addSession,
    deleteSession,
    addResume,
    deleteResume
  } = useDataPersistence()

  // Use the ref when bulletPoints change
  useEffect(() => {
    bulletPointsRef.current = bulletPoints
    console.log('📋 Bullet points updated in App component:', bulletPoints)
  }, [bulletPoints])

  // Define the match found handler function
  const handleMatchFound = (matchedPoint: string) => {
    console.log('🎯 Matched bullet point:', matchedPoint)

    // Use the ref value to avoid stale closure
    const currentBulletPoints = bulletPointsRef.current
    console.log('🔍 Current bullet points in state:', currentBulletPoints)

    // Check if this exact bullet point exists in our list
    const exactMatch = currentBulletPoints.includes(matchedPoint)

    if (exactMatch) {
      console.log('✅ Exact match found in bullet points, removing:', matchedPoint)

      // Remove the exact match
      setBulletPoints((prev) => {
        const newPoints = prev.filter((point) => point !== matchedPoint)
        console.log(`✅ Removed bullet point. Remaining bullet points: ${newPoints.length}`)
        return newPoints
      })
    } else {
      console.log(
        '⚠️ No exact match in bullet points, using Fuse.js for fuzzy matching:',
        matchedPoint
      )

      // Configure Fuse.js with appropriate options
      const fuseOptions = {
        includeScore: true,
        threshold: 0.4, // Lower threshold means more strict matching
        keys: ['.'] // Search the whole string
      }

      // Initialize Fuse with current bullet points
      const fuse = new Fuse(currentBulletPoints, fuseOptions)

      // Perform the search
      const searchResult = fuse.search(matchedPoint)

      if (searchResult.length > 0) {
        // Get the best match
        const bestMatch = searchResult[0]
        console.log(
          `✅ Found fuzzy match with Fuse.js: "${bestMatch.item}" (Score: ${bestMatch.score?.toFixed(4)})`
        )

        // Remove the best match from bullet points
        setBulletPoints((prev) => {
          const newPoints = prev.filter((point) => point !== bestMatch.item)
          console.log(
            `✅ Removed fuzzy-matched bullet point. Remaining bullet points: ${newPoints.length}`
          )
          return newPoints
        })
      } else {
        console.log('❌ No match found with Fuse.js among current bullet points')

        // Last resort approach - force remove bullet point at index 0 if available
        if (currentBulletPoints.length > 0) {
          const pointToRemove = currentBulletPoints[0]
          console.log('⚠️ Force removing first bullet point as fallback:', pointToRemove)
          setBulletPoints((prev) => prev.filter((_, i) => i !== 0))
        }
      }
    }
  }

  const { isListening, startListening, stopListening } = useSpeechRecognition({
    onTranscript: (text) => {
      console.log('User speech transcript:', text)
      if (text) {
        setTranscriptText(text)
      }
    },
    bulletPoints,
    onMatchFound: handleMatchFound
  })

  // Test mode effect - set test bullet points only once
  useEffect(() => {
    if (TEST_MODE && bulletPoints.length === 0 && !bulletPointsInitializedRef.current) {
      const testBulletPoints = [
        'I have 5 years of experience in software development',
        "I'm proficient in Python and JavaScript",
        "I've worked on large-scale distributed systems",
        'I have experience with cloud platforms like AWS',
        "I'm familiar with agile development methodologies"
      ]
      console.log('🔄 Test mode: Setting bullet points for semantic matching:', testBulletPoints)
      setBulletPoints(testBulletPoints)
      bulletPointsInitializedRef.current = true
      console.log('✅ Initial bullet points set for semantic matching')
    }
  }, [bulletPoints.length]) // Only run when bulletPoints.length changes

  // Effect to send bullet points to the backend when they change
  useEffect(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && bulletPoints.length > 0) {
      console.log('🔄 Sending updated bullet points to backend:', bulletPoints)
      wsRef.current.send(
        JSON.stringify({
          type: 'set_bullet_points',
          payload: { points: bulletPoints }
        })
      )
    }
  }, [bulletPoints]) // Run whenever bulletPoints change

  // Also send bullet points right after WebSocket connects
  useEffect(() => {
    if (wsStatus === 'connected' && bulletPoints.length > 0) {
      console.log('🔄 Sending bullet points after WS connection:', bulletPoints)
      if (wsRef.current) {
        wsRef.current.send(
          JSON.stringify({
            type: 'set_bullet_points',
            payload: { points: bulletPoints }
          })
        )
      }
    }
  }, [wsStatus, bulletPoints]) // Run when WebSocket status changes to connected

  // Display error messages from data loading
  useEffect(() => {
    if (loadSessionsError) {
      setError(`Failed to load sessions: ${loadSessionsError.message}`)
    } else if (loadResumesError) {
      setError(`Failed to load resumes: ${loadResumesError.message}`)
    }
  }, [loadSessionsError, loadResumesError])

  // Effect to listen for click-through toggle events
  useEffect(() => {
    const handleClickThroughToggle = (event: CustomEvent) => {
      setIsClickThrough(event.detail.enabled)
    }

    window.addEventListener('clickThroughToggled', handleClickThroughToggle as EventListener)

    return () => {
      window.removeEventListener('clickThroughToggled', handleClickThroughToggle as EventListener)
    }
  }, [])

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
              if (data.match) {
                console.log(
                  `🎯 Match found from backend: '${data.match}' (Score: ${data.score.toFixed(2)})`
                )
                // Use the same handler we pass to useSpeechRecognition
                console.log('Calling handleMatchFound with match:', data.match)
                handleMatchFound(data.match)
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

  // Add these helper functions for processing transcription updates
  const processTranscriptionQueue = () => {
    if (pendingUpdatesRef.current.length === 0 || processingUpdatesRef.current) return

    processingUpdatesRef.current = true
    // Get latest update and clear queue
    const latestUpdate = pendingUpdatesRef.current[pendingUpdatesRef.current.length - 1]
    pendingUpdatesRef.current = []

    // Update state and allow React to render before processing more
    setTranscriptText(latestUpdate)

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

  const startCapture = async (): Promise<void> => {
    try {
      // Get desktop audio stream
      const desktopStream = await navigator.mediaDevices.getDisplayMedia({
        audio: true,
        video: false
      })

      // Get microphone stream
      console.log('Requesting microphone access...')
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      })
      console.log('Microphone access granted')

      // Check if we got audio tracks
      const desktopAudioTracks = desktopStream.getAudioTracks()
      if (desktopAudioTracks.length === 0) {
        console.warn('No desktop audio track found in the stream')
      } else {
        console.log('Desktop audio track found:', desktopAudioTracks[0].label)
      }

      const micAudioTracks = micStream.getAudioTracks()
      if (micAudioTracks.length === 0) {
        console.warn('No microphone audio track found')
      } else {
        console.log('Microphone audio track found:', micAudioTracks[0].label)
      }

      streamRef.current = desktopStream
      micStreamRef.current = micStream

      if (videoRef.current) {
        videoRef.current.srcObject = desktopStream
        videoRef.current.onloadedmetadata = () => videoRef.current?.play()
      }

      // Set up audio analysis for desktop audio
      audioContextRef.current = new AudioContext()
      analyserRef.current = audioContextRef.current.createAnalyser()
      const source = audioContextRef.current.createMediaStreamSource(desktopStream)
      source.connect(analyserRef.current)
      analyserRef.current.fftSize = 256

      // Set up audio analysis for microphone
      micAudioContextRef.current = new AudioContext()
      micAnalyserRef.current = micAudioContextRef.current.createAnalyser()
      const micSource = micAudioContextRef.current.createMediaStreamSource(micStream)
      micSource.connect(micAnalyserRef.current)
      micAnalyserRef.current.fftSize = 256

      setIsCapturing(true)
      startVisualization()
      startMicVisualization()

      // Start speech recognition
      console.log('Starting speech recognition...')
      startListening()

      // Start WebSocket connection for transcription
      console.log('Connecting to transcription WebSocket...')
      connectWebSocket()

      // Start recording transcription once connected
      const startRecording = () => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          console.log('Starting transcription recording')
          setWsError(null)
          setTranscriptText('')
          pendingUpdatesRef.current = []

          // Send current bullet points right before starting recording
          if (bulletPointsRef.current.length > 0) {
            console.log('Sending bullet points before starting recording:', bulletPointsRef.current)
            wsRef.current.send(
              JSON.stringify({
                type: 'set_bullet_points',
                payload: { points: bulletPointsRef.current }
              })
            )
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

      // Start a timer to wait for connection before starting recording
      setTimeout(startRecording, 1000)

      if (TEST_MODE) {
        console.log('🔄 Test mode enabled: bullet points should be set by useEffect')
      } else {
        // Connect to OpenAI WebRTC with only desktop audio
        await connectToOpenAI(desktopStream)
      }
    } catch (error: any) {
      console.error('Error starting capture:', error)
      setError(`Failed to start capture: ${error?.message || 'Unknown error'}`)
    }
  }

  const connectToOpenAI = async (stream: MediaStream): Promise<void> => {
    try {
      // Get ephemeral token via IPC handler
      const sessionData = await window.api.getOpenAISession()

      if (!sessionData.client_secret?.value) {
        console.error('Failed to get token:', sessionData)
        return
      }

      console.log('Received OpenAI session token')

      // Create RTC peer connection
      const pc = new RTCPeerConnection()
      peerConnectionRef.current = pc

      // Add desktop audio track to the connection
      stream.getAudioTracks().forEach((track) => {
        pc.addTrack(track, stream)
      })

      // Setup data channel to send/receive events
      const dc = pc.createDataChannel('oai-events')
      dataChannelRef.current = dc

      // Include session information in the automatic response
      const sessionInfo = currentSession
        ? `Use the following job description and resume to help answer the questions. Job Description: ${currentSession.jobDescription}, Resume: ${currentSession.resumeName}`
        : ''

      const prompt = `You are a meeting assistant to help during a meeting.
        The user is being asked questions by an interviewer and you must help them answer the questions.

        Start with a short core answer, then expand if needed
        Seperate each new point with a "-".

        ${sessionInfo}`

      dc.addEventListener('open', () => {
        console.log('Data channel open, sending session.update')

        const update = {
          type: 'session.update',
          session: {
            instructions: prompt
            // output_audio: false
          }
        }
        dataChannelRef.current?.send(JSON.stringify(update))
      })

      dc.addEventListener('message', (event) => {
        try {
          const msg = JSON.parse(event.data)

          // Log the event type for all messages
          // console.log('OpenAI WebRTC event:', msg.type, msg)

          if (msg.type === 'response.audio_transcript.delta') {
            // console.log('Delta text received:', msg.delta)
            const delta = msg.delta || ''

            setResponseText((prev) => {
              if (prev.endsWith(delta)) {
                return prev
              }
              return prev + delta
            })

            // Handle bullet point parsing
            setCurrentBulletPoint((prev) => {
              const newText = prev + delta

              // If we encounter a bullet point separator
              if (delta.includes('-')) {
                const parts = newText.split('-')

                // Add completed bullet points to the list
                if (parts.length > 1) {
                  setBulletPoints((prevPoints) => {
                    const newPoints = [...prevPoints]
                    // Add all complete points except the last one
                    for (let i = 0; i < parts.length - 1; i++) {
                      const point = parts[i].trim()
                      if (point && !newPoints.includes(point)) {
                        newPoints.push(point)
                      }
                    }
                    return newPoints
                  })
                  // Keep the incomplete part
                  return parts[parts.length - 1]
                }
              }
              return newText
            })
          } else if (msg.type === 'response.text.done') {
            // Add the final bullet point if there is one
            if (currentBulletPoint.trim()) {
              setBulletPoints((prev) => [...prev, currentBulletPoint.trim()])
              setCurrentBulletPoint('')
            }
            const responseRequest = {
              type: 'response.create',
              response: {
                modalities: ['text']
              }
            }

            if (dataChannelRef.current) {
              console.log('Sending automatic response request:', responseRequest)
              dataChannelRef.current.send(JSON.stringify(responseRequest))
            } else {
              console.error(
                'No WebRTC data channel available when sending automatic response request'
              )
            }
          }
        } catch (error) {
          console.error('Error parsing WebRTC message:', error)
        }
      })

      // Create WebRTC offer and send to OpenAI
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      console.log('Created WebRTC offer')

      try {
        // Use IPC handler for SDP exchange
        const sdp = offer.sdp
        if (!sdp) {
          throw new Error('Failed to create SDP offer')
        }

        const sdpResponse = await window.api.openAIWebRtcSdp(sdp)

        const answer = {
          type: 'answer' as RTCSdpType,
          sdp: sdpResponse
        }
        await pc.setRemoteDescription(answer)
        console.log('Successfully connected to OpenAI WebRTC')
      } catch (error) {
        console.error('Error in WebRTC SDP exchange:', error)
      }
    } catch (error) {
      console.error('Error setting up WebRTC:', error)
    }
  }

  const stopCapture = (): void => {
    // Stop transcription recording first
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log('Stopping transcription recording')
      wsRef.current.send(
        JSON.stringify({
          type: 'control',
          payload: { command: 'stop' }
        })
      )
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop())
      micStreamRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    if (micAudioContextRef.current) {
      micAudioContextRef.current.close()
      micAudioContextRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    if (micAnimationFrameRef.current) {
      cancelAnimationFrame(micAnimationFrameRef.current)
      micAnimationFrameRef.current = null
    }

    // Stop speech recognition
    stopListening()

    // Close WebRTC connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }
    if (dataChannelRef.current) {
      dataChannelRef.current.close()
      dataChannelRef.current = null
    }

    setIsCapturing(false)
    setResponseText('')
    setBulletPoints([])
    setCurrentBulletPoint('')

    // Reset the initialization flag to allow bullet points to be set again in future sessions
    bulletPointsInitializedRef.current = false

    // Clear canvas
    if (canvasRef.current) {
      const canvasCtx = canvasRef.current.getContext('2d')
      if (canvasCtx) {
        canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
      }
    }
    if (micCanvasRef.current) {
      const micCanvasCtx = micCanvasRef.current.getContext('2d')
      if (micCanvasCtx) {
        micCanvasCtx.clearRect(0, 0, micCanvasRef.current.width, micCanvasRef.current.height)
      }
    }

    // Don't clear transcript - keep it visible after stopping
  }

  const startVisualization = (): void => {
    if (!analyserRef.current || !canvasRef.current) return

    const canvasCtx = canvasRef.current.getContext('2d')
    if (!canvasCtx) return

    const bufferLength = analyserRef.current.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw)

      if (!analyserRef.current || !canvasRef.current) return

      analyserRef.current.getByteFrequencyData(dataArray)

      canvasCtx.fillStyle = '#f8f8f8'
      canvasCtx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height)

      const barWidth = (canvasRef.current.width / bufferLength) * 2.5
      let barHeight
      let x = 0

      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] / 2

        canvasCtx.fillStyle = `rgb(${barHeight + 100}, 50, 50)`
        canvasCtx.fillRect(x, canvasRef.current.height - barHeight, barWidth, barHeight)

        x += barWidth + 1
      }
    }

    draw()
  }

  const startMicVisualization = (): void => {
    if (!micAnalyserRef.current || !micCanvasRef.current) return

    const canvasCtx = micCanvasRef.current.getContext('2d')
    if (!canvasCtx) return

    const bufferLength = micAnalyserRef.current.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    const draw = () => {
      micAnimationFrameRef.current = requestAnimationFrame(draw)

      if (!micAnalyserRef.current || !micCanvasRef.current) return

      micAnalyserRef.current.getByteFrequencyData(dataArray)

      canvasCtx.fillStyle = '#f8f8f8'
      canvasCtx.fillRect(0, 0, micCanvasRef.current.width, micCanvasRef.current.height)

      const barWidth = (micCanvasRef.current.width / bufferLength) * 2.5
      let barHeight
      let x = 0

      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] / 2

        canvasCtx.fillStyle = `rgb(50, ${barHeight + 100}, 50)`
        canvasCtx.fillRect(x, micCanvasRef.current.height - barHeight, barWidth, barHeight)

        x += barWidth + 1
      }
    }

    draw()
  }

  // Set canvas dimensions when component mounts
  useEffect(() => {
    if (canvasRef.current) {
      canvasRef.current.width = 320
      canvasRef.current.height = 80
    }
    if (micCanvasRef.current) {
      micCanvasRef.current.width = 320
      micCanvasRef.current.height = 80
    }
  }, [])

  const handleTabChange = (_, newValue) => {
    setHomeTab(newValue)
  }

  const handleNewSession = () => {
    setCurrentPage('setup')
  }

  const handleLoadSession = (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId)
    if (session) {
      setCurrentSession({
        id: session.id,
        name: session.name,
        date: session.date,
        jobDescription: session.jobDescription,
        resumeId: session.resumeId,
        resumeName: session.resumeName
      })
      setCurrentPage('capture')
    }
  }

  const handleSaveConfig = async (config: { jobDescription: string; selectedResume: string }) => {
    try {
      // Find the selected resume
      const selectedResume = resumes.find((r) => r.id === config.selectedResume)

      // Create a new session
      const newSession = await addSession({
        name: `Interview Session - ${new Date().toLocaleDateString()}`,
        jobDescription: config.jobDescription,
        resumeId: selectedResume?.id,
        resumeName: selectedResume?.name
      })

      // Set as current session
      setCurrentSession({
        id: newSession.id,
        name: newSession.name,
        date: newSession.date,
        jobDescription: newSession.jobDescription,
        resumeId: newSession.resumeId,
        resumeName: newSession.resumeName
      })

      // Navigate to capture page
      setCurrentPage('capture')
    } catch (error) {
      console.error('Error saving session:', error)
      setError('Failed to save session. Please try again.')
    }
  }

  const handleAddResume = async (resume: { name: string; file: File }) => {
    try {
      await addResume(resume.name, resume.file)
      // If we're on the setup page, go back to main with resumes tab active
      if (currentPage === 'setup') {
        setCurrentPage('main')
        setHomeTab(1) // Switch to resumes tab
      }
    } catch (error) {
      console.error('Error adding resume:', error)
      setError('Failed to add resume. Please try again.')
    }
  }

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await deleteSession(sessionId)
    } catch (error) {
      console.error('Error deleting session:', error)
      setError('Failed to delete session. Please try again.')
    }
  }

  const handleDeleteResume = async (resumeId: string) => {
    try {
      await deleteResume(resumeId)
    } catch (error) {
      console.error('Error deleting resume:', error)
      setError('Failed to delete resume. Please try again.')
    }
  }

  // Close the error snackbar
  const handleCloseError = () => {
    setError(null)
  }

  // Replace the response-output div with this new component
  const renderResponseOutput = () => (
    <Box className="response-output" sx={{ mt: 3 }}>
      <h3>OpenAI Response:</h3>
      {bulletPoints.length === 0 && !currentBulletPoint ? (
        <Paper
          sx={{
            p: 2,
            bgcolor: 'rgba(15, 23, 42, 0.3)',
            color: 'text.secondary'
          }}
        >
          <span className="no-response">No response yet. Click "Start Capture" to begin.</span>
        </Paper>
      ) : (
        <Paper
          sx={{
            bgcolor: 'rgba(15, 23, 42, 0.3)',
            maxHeight: 400,
            overflow: 'auto'
          }}
        >
          <List>
            {bulletPoints.map((point, index) => (
              <ListItem
                key={index}
                sx={{
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                  py: 1
                }}
              >
                <ListItemText primary={point} />
              </ListItem>
            ))}
            {currentBulletPoint && (
              <ListItem
                sx={{
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                  py: 1
                }}
              >
                <ListItemText primary={currentBulletPoint} />
              </ListItem>
            )}
          </List>
        </Paper>
      )}
    </Box>
  )

  const renderTranscriptionDisplay = () => (
    <Box
      className="transcription-container"
      sx={{
        mt: 3,
        p: 2,
        borderRadius: 2,
        bgcolor: 'rgba(30, 41, 59, 0.3)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
        maxWidth: '800px',
        margin: '0 auto',
        display: isCapturing || transcriptText ? 'block' : 'none'
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="h6" sx={{ color: '#4ade80' }}>
          Transcription
        </Typography>

        {/* Show WebSocket connection status */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor:
                wsStatus === 'connected'
                  ? '#10b981'
                  : wsStatus === 'connecting'
                    ? '#f59e0b'
                    : '#ef4444',
              boxShadow: wsStatus === 'connected' ? '0 0 0 3px rgba(16, 185, 129, 0.2)' : 'none'
            }}
          />
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {wsStatus === 'connected'
              ? 'Transcription Service Connected'
              : wsStatus === 'connecting'
                ? 'Connecting...'
                : 'Transcription Service Disconnected'}
          </Typography>
        </Box>
      </Box>

      {wsError && (
        <Box
          sx={{
            bgcolor: 'rgba(239, 68, 68, 0.1)',
            borderLeft: '3px solid #ef4444',
            color: '#ef4444',
            borderRadius: '4px',
            p: 1,
            mb: 2,
            fontSize: '0.9rem'
          }}
        >
          {wsError}
        </Box>
      )}

      <Typography
        variant="body1"
        sx={{
          color: 'white',
          fontWeight: transcriptText ? 'normal' : 'light',
          fontStyle: transcriptText ? 'normal' : 'italic',
          maxHeight: '200px',
          overflowY: 'auto',
          p: 1
        }}
      >
        {transcriptText || 'Waiting for speech...'}
      </Typography>
    </Box>
  )

  const renderMainPage = () => (
    <>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={homeTab} onChange={handleTabChange} aria-label="main navigation tabs">
          <Tab label="Sessions" />
          <Tab label="Resumes" />
        </Tabs>
      </Box>

      {/* Sessions Tab */}
      {homeTab === 0 && (
        <SessionList
          sessions={sessions}
          onNewSession={handleNewSession}
          onSelectSession={handleLoadSession}
          onDeleteSession={handleDeleteSession}
        />
      )}

      {/* Resumes Tab */}
      {homeTab === 1 && (
        <ResumeManager
          resumes={resumes}
          onAddResume={handleAddResume}
          onDeleteResume={handleDeleteResume}
        />
      )}
    </>
  )

  // Add a function to handle window close
  const handleCloseApp = () => {
    window.api.closeApp?.()
  }

  return (
    <Box
      className="app-container"
      sx={{
        minHeight: '100vh',
        background: isClickThrough
          ? 'transparent'
          : 'linear-gradient(to bottom right, rgba(15, 23, 42, 0.4), rgba(30, 41, 59, 0.4))',
        backdropFilter: 'blur(2px)',
        p: 3
      }}
    >
      {/* Custom title bar */}
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          height: '28px',
          backgroundColor: isClickThrough ? 'transparent' : 'rgba(15, 23, 42, 0.6)',
          WebkitAppRegion: 'drag', // Make draggable on macOS and Windows
          zIndex: 9999,
          paddingX: 2
        }}
      >
        <Typography variant="subtitle2" sx={{ color: isClickThrough ? 'transparent' : 'white' }}>
          Interview Assistant
        </Typography>
        <Box sx={{ display: 'flex', WebkitAppRegion: 'no-drag' }}>
          {' '}
          {/* Ensure buttons are clickable */}
          <IconButton
            onClick={handleCloseApp}
            size="small"
            sx={{
              color: isClickThrough ? 'transparent' : 'white',
              '&:hover': {
                color: 'red',
                backgroundColor: 'rgba(255,255,255,0.1)'
              }
            }}
          >
            ✕
          </IconButton>
        </Box>
      </Box>

      {/* Click-through indicator */}
      {isClickThrough ? (
        <Box
          sx={{
            position: 'fixed',
            top: 30,
            right: 10,
            backgroundColor: 'rgba(255, 0, 0, 0.5)',
            color: 'white',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '10px',
            opacity: 0.7,
            zIndex: 9999
          }}
        >
          Press Ctrl+Alt+T
        </Box>
      ) : (
        <Box
          sx={{
            position: 'fixed',
            top: 30,
            right: 10,
            backgroundColor: 'rgba(0, 255, 0, 0.2)',
            color: 'white',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '10px',
            zIndex: 9999
          }}
        >
          Interactive Mode
        </Box>
      )}

      {/* Add top margin to account for title bar */}
      <Box sx={{ pt: 3 }}>
        {/* Loading indicator */}
        {(loadingSessions || loadingResumes) && (
          <Box
            sx={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'rgba(15, 23, 42, 0.3)',
              zIndex: 9999
            }}
          >
            <CircularProgress color="primary" size={60} />
          </Box>
        )}

        {currentPage === 'main' && renderMainPage()}

        {currentPage === 'setup' && (
          <Box
            sx={{
              maxWidth: 'md',
              mx: 'auto',
              borderRadius: 2,
              overflow: 'hidden',
              boxShadow: '0 0 40px rgba(99, 102, 241, 0.2)'
            }}
          >
            <SetupConfigPage
              onSave={handleSaveConfig}
              resumes={resumes}
              onAddResume={() => {
                setCurrentPage('main')
                setHomeTab(1) // Switch to resumes tab
              }}
              onBack={() => setCurrentPage('main')}
            />
          </Box>
        )}

        {currentPage === 'capture' && (
          <Box
            sx={{
              maxWidth: 'lg',
              mx: 'auto',
              borderRadius: 2,
              overflow: 'hidden',
              boxShadow: '0 0 40px rgba(236, 72, 153, 0.2)'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', p: 2 }}>
              <Box
                onClick={() => setCurrentPage('main')}
                sx={{
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  color: '#6366f1',
                  '&:hover': { color: '#818cf8' }
                }}
              >
                ← Back to Home
              </Box>
            </Box>

            <h1>Screen Capture with OpenAI Realtime</h1>

            <div className="controls">
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
                {!isCapturing ? (
                  <button onClick={startCapture} className="capture-button">
                    Start Capture
                  </button>
                ) : (
                  <button onClick={stopCapture} className="stop-button">
                    Stop Capture
                  </button>
                )}
              </Box>
              {isListening && (
                <Box
                  sx={{ color: '#4ade80', mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}
                >
                  <CircularProgress size={16} sx={{ color: '#4ade80' }} />
                  Listening for speech...
                </Box>
              )}
            </div>

            <div className="audio-container">
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 1 }}>
                  Desktop Audio
                </Typography>
                <canvas ref={canvasRef} className="audio-canvas"></canvas>
              </Box>
              <Box>
                <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 1 }}>
                  Microphone Audio
                </Typography>
                <canvas ref={micCanvasRef} className="audio-canvas"></canvas>
              </Box>
            </div>

            {renderTranscriptionDisplay()}

            {renderResponseOutput()}
          </Box>
        )}

        {/* Error Snackbar */}
        <Snackbar
          open={!!error}
          autoHideDuration={6000}
          onClose={handleCloseError}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <Alert onClose={handleCloseError} severity="error" sx={{ width: '100%' }}>
            {error}
          </Alert>
        </Snackbar>
      </Box>
    </Box>
  )
}

export default App
