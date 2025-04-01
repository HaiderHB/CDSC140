import { useEffect, useRef, useState } from 'react'
import { Box, Tabs, Tab, Snackbar, Alert, CircularProgress } from '@mui/material'
import './App.css'
import MainPage from './components/MainPage'
import SetupConfigPage from './components/SetupConfigPage'
import SessionList from './components/SessionList'
import ResumeManager, { Resume as ResumeType } from './components/ResumeManager'
import theme from './theme'
import { useDataPersistence, Session } from './hooks/useDataPersistence'

// Use Session type from useDataPersistence for all session-related data
interface CurrentSession {
  id: string
  name: string
  date?: string
  resumeId?: string
  resumeName?: string
  jobDescription: string
}

function App(): JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isCapturing, setIsCapturing] = useState(false)
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const dataChannelRef = useRef<RTCDataChannel | null>(null)
  const [responseText, setResponseText] = useState('')
  const [currentPage, setCurrentPage] = useState('main')
  const [homeTab, setHomeTab] = useState(0)
  const [currentSession, setCurrentSession] = useState<CurrentSession | null>(null)
  const [error, setError] = useState<string | null>(null)

  const {
    sessions,
    resumes,
    loadingSessions,
    loadingResumes,
    loadSessionsError,
    loadResumesError,
    addSession,
    updateSession,
    deleteSession,
    addResume,
    deleteResume
  } = useDataPersistence()

  // Display error messages from data loading
  useEffect(() => {
    if (loadSessionsError) {
      setError(`Failed to load sessions: ${loadSessionsError.message}`)
    } else if (loadResumesError) {
      setError(`Failed to load resumes: ${loadResumesError.message}`)
    }
  }, [loadSessionsError, loadResumesError])

  const startCapture = async (): Promise<void> => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        audio: true,
        video: {
          width: 1280,
          height: 720,
          frameRate: 30
        }
      })

      // Check if we got audio tracks
      const audioTracks = stream.getAudioTracks()
      if (audioTracks.length === 0) {
        console.warn('No audio track found in the stream')
      } else {
        console.log('Audio track found:', audioTracks[0].label)
      }

      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => videoRef.current?.play()
      }

      // Set up audio analysis
      audioContextRef.current = new AudioContext()
      analyserRef.current = audioContextRef.current.createAnalyser()
      const source = audioContextRef.current.createMediaStreamSource(stream)
      source.connect(analyserRef.current)
      analyserRef.current.fftSize = 256

      setIsCapturing(true)
      startVisualization()

      // Connect to OpenAI WebRTC
      await connectToOpenAI(stream)
    } catch (error) {
      console.error('Error starting capture:', error)
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

      dc.addEventListener('message', (event) => {
        try {
          const msg = JSON.parse(event.data)

          // Log the event type for all messages
          // console.log('OpenAI WebRTC event:', msg.type, msg)

          if (msg.type === 'response.audio_transcript.delta') {
            console.log('Delta text received:', msg.delta)
            setResponseText((prev) => {
              const delta = msg.delta || ''
              if (prev.endsWith(delta)) {
                // Already added this delta, skip update
                return prev
              }
              const newText = prev + delta
              console.log('Updated response text:', newText)
              return newText
            })
          } else if (msg.type === 'response.text.done') {
            console.log('Final response text:', msg.text)
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

  const triggerManualResponse = (): void => {
    if (!dataChannelRef.current) {
      console.error('No WebRTC data channel available')
      return
    }

    console.log('Manually triggering OpenAI response')

    // Clear the previous response
    setResponseText('')

    // Manually trigger a response
    const conversationItem = {
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: 'Summarize what was just said.'
          }
        ]
      }
    }

    console.log('Sending conversation item:', conversationItem)
    dataChannelRef.current.send(JSON.stringify(conversationItem))

    // Wait a short time to ensure the conversation item is processed
    setTimeout(() => {
      if (!dataChannelRef.current) {
        console.error('No WebRTC data channel available when sending response request')
        return
      }

      const responseRequest = {
        type: 'response.create',
        response: {
          modalities: ['text']
        }
      }

      console.log('Sending response request:', responseRequest)
      dataChannelRef.current.send(JSON.stringify(responseRequest))
      console.log('Manual response request sent to OpenAI')
    }, 500)
  }

  const stopCapture = (): void => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

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

    // Clear canvas
    if (canvasRef.current) {
      const canvasCtx = canvasRef.current.getContext('2d')
      if (canvasCtx) {
        canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
      }
    }
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

  // Set canvas dimensions when component mounts
  useEffect(() => {
    if (canvasRef.current) {
      canvasRef.current.width = 320
      canvasRef.current.height = 80
    }
  }, [])

  const handleTabChange = (event, newValue) => {
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

  return (
    <Box
      className="app-container"
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(to bottom right, #0f172a, #1e293b)',
        p: 3
      }}
    >
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
            bgcolor: 'rgba(15, 23, 42, 0.7)',
            zIndex: 9999
          }}
        >
          <CircularProgress color="primary" size={60} />
        </Box>
      )}

      {currentPage === 'main' && (
        <Box
          sx={{
            maxWidth: 'lg',
            mx: 'auto',
            borderRadius: 2,
            overflow: 'hidden',
            boxShadow: '0 0 40px rgba(99, 102, 241, 0.2)'
          }}
        >
          <MainPage onNewSession={handleNewSession} onLoadSession={() => {}} />

          <Box sx={{ mt: 4, borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={homeTab} onChange={handleTabChange} aria-label="home tabs">
              <Tab label="Sessions" />
              <Tab label="Resumes" />
            </Tabs>
          </Box>

          <Box sx={{ py: 3 }}>
            {homeTab === 0 && (
              <SessionList
                sessions={sessions}
                onDeleteSession={handleDeleteSession}
                onSelectSession={handleLoadSession}
              />
            )}
            {homeTab === 1 && (
              <ResumeManager
                onAddResume={handleAddResume}
                resumes={resumes}
                onDeleteResume={handleDeleteResume}
              />
            )}
          </Box>
        </Box>
      )}

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
            {!isCapturing ? (
              <button onClick={startCapture} className="capture-button">
                Start Capture
              </button>
            ) : (
              <>
                <button onClick={stopCapture} className="stop-button">
                  Stop Capture
                </button>
                <button onClick={triggerManualResponse} className="trigger-button">
                  Trigger Response
                </button>
              </>
            )}
          </div>

          <div className="audio-container">
            <canvas ref={canvasRef} className="audio-canvas"></canvas>
          </div>

          <div className="response-output">
            <h3>OpenAI Response:</h3>
            <div className="response-text">
              {responseText ? (
                responseText
              ) : (
                <span className="no-response">
                  No response yet. Click "Trigger Response" after starting capture.
                </span>
              )}
            </div>
          </div>
        </Box>
      )}

      {/* Error Snackbar */}
      <Snackbar open={!!error} autoHideDuration={6000} onClose={handleCloseError}>
        <Alert onClose={handleCloseError} severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
    </Box>
  )
}

export default App
