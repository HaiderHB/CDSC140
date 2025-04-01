import { useEffect, useRef, useState } from 'react'
import './App.css'

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

      // Create audio element to hear model voice (optional)
      const audioEl = document.createElement('audio')
      audioEl.autoplay = true
      pc.ontrack = (e) => {
        console.log('Received audio track from OpenAI')
        audioEl.srcObject = e.streams[0]
        document.body.appendChild(audioEl)
      }

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
          console.log('OpenAI WebRTC event:', msg.type)

          if (msg.type === 'response.text.delta') {
            setResponseText((prev) => prev + (msg.delta?.text || ''))
          }
          if (msg.type === 'response.text.done') {
            console.log('Final response:', msg.response.output[0])
          }
          // Log when transcription is detected
          if (msg.type === 'transcription') {
            console.log('Transcription detected:', msg.transcription?.text)
          }
          // Log when voice activity is detected
          if (msg.type === 'voice_activity') {
            console.log('Voice activity detected:', msg.is_speech ? 'speech' : 'no speech')
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

    // Manually trigger a response
    dataChannelRef.current.send(
      JSON.stringify({
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
      })
    )

    dataChannelRef.current.send(
      JSON.stringify({
        type: 'response.create',
        response: {
          modalities: ['text']
        }
      })
    )

    console.log('Manual response request sent to OpenAI')
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

  return (
    <div className="container">
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

      {/* <div className="preview-container">
        <video ref={videoRef} autoPlay muted className="preview-video" />
      </div> */}

      <div className="audio-container">
        <canvas ref={canvasRef} className="audio-canvas"></canvas>
      </div>

      <div className="response-output">
        <h3>OpenAI Response:</h3>
        <p>{responseText}</p>
      </div>
    </div>
  )
}

export default App
