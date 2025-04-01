import { useEffect, useRef, useState } from 'react'
import { Box, Tabs, Tab } from '@mui/material'
import './App.css'
import MainPage from './components/MainPage'
import SetupConfigPage from './components/SetupConfigPage'
import SessionList from './components/SessionList'
import ResumeManager from './components/ResumeManager'
import theme from './theme'

interface Session {
  id: string
  name: string
}

interface Resume {
  id: string
  name: string
  file: File
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
  const [sessions, setSessions] = useState<Session[]>([])
  const [resumes, setResumes] = useState<Resume[]>([])
  const [homeTab, setHomeTab] = useState(0)

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

  const handleNewSession = () => {
    setCurrentPage('setup')
  }

  const handleLoadSession = () => {
    // Logic to load existing sessions
  }

  const handleSaveConfig = (config) => {
    // Logic to save the session config
    setCurrentPage('capture')
  }

  const handleDeleteSession = (sessionId) => {
    setSessions(sessions.filter((session) => session.id !== sessionId))
  }

  const handleAddResume = (resume) => {
    setResumes([...resumes, resume])
  }

  const handleTabChange = (event, newValue) => {
    setHomeTab(newValue)
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
          <MainPage onNewSession={handleNewSession} onLoadSession={handleLoadSession} />

          <Box sx={{ mt: 4, borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={homeTab} onChange={handleTabChange} aria-label="home tabs">
              <Tab label="Sessions" />
              <Tab label="Resumes" />
            </Tabs>
          </Box>

          <Box sx={{ py: 3 }}>
            {homeTab === 0 && (
              <SessionList sessions={sessions} onDeleteSession={handleDeleteSession} />
            )}
            {homeTab === 1 && <ResumeManager onAddResume={handleAddResume} resumes={resumes} />}
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
            onAddResume={handleAddResume}
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
    </Box>
  )
}

export default App
