import { useState, useRef, useEffect } from 'react'

// Define types
export interface AudioStatus {
  connection: 'disconnected' | 'connected'
  listening: boolean
}

interface UseAudioCaptureResult {
  desktopAudioStatus: AudioStatus
  micAudioStatus: AudioStatus
  streamRef: React.RefObject<MediaStream | null>
  micStreamRef: React.RefObject<MediaStream | null>
  audioContextRef: React.RefObject<AudioContext | null>
  micAudioContextRef: React.RefObject<AudioContext | null>
  analyserRef: React.RefObject<AnalyserNode | null>
  micAnalyserRef: React.RefObject<AnalyserNode | null>
  canvasRef: React.RefObject<HTMLCanvasElement>
  micCanvasRef: React.RefObject<HTMLCanvasElement>
  animationFrameRef: React.RefObject<number | null>
  micAnimationFrameRef: React.RefObject<number | null>
  videoRef: React.RefObject<HTMLVideoElement>
  startCapture: () => Promise<{ desktopStream: MediaStream; micStream: MediaStream } | null>
  stopCapture: () => void
  startVisualization: () => void
  startMicVisualization: () => void
  isCapturing: boolean
}

export const useAudioCapture = (): UseAudioCaptureResult => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const micCanvasRef = useRef<HTMLCanvasElement>(null)
  const [isCapturing, setIsCapturing] = useState(false)
  const streamRef = useRef<MediaStream | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const micAudioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const micAnalyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const micAnimationFrameRef = useRef<number | null>(null)

  // State for audio status
  const [desktopAudioStatus, setDesktopAudioStatus] = useState<AudioStatus>({
    connection: 'disconnected',
    listening: false
  })
  const [micAudioStatus, setMicAudioStatus] = useState<AudioStatus>({
    connection: 'disconnected',
    listening: false
  })

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

  const startCapture = async (): Promise<{
    desktopStream: MediaStream
    micStream: MediaStream
  } | null> => {
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

      // Update connection status when streams are obtained
      setDesktopAudioStatus((prev) => ({ ...prev, connection: 'connected' }))
      setMicAudioStatus((prev) => ({ ...prev, connection: 'connected' }))

      // Set up audio analysis for desktop audio
      audioContextRef.current = new AudioContext()
      analyserRef.current = audioContextRef.current.createAnalyser()
      const source = audioContextRef.current.createMediaStreamSource(desktopStream)
      source.connect(analyserRef.current)

      // Set up audio monitoring for desktop
      const desktopProcessor = audioContextRef.current.createScriptProcessor(2048, 1, 1)
      desktopProcessor.addEventListener('audioprocess', (e) => {
        const input = e.inputBuffer.getChannelData(0)
        const sum = input.reduce((acc, val) => acc + Math.abs(val), 0)
        if (sum > 0.01) {
          // Threshold for detecting audio
          setDesktopAudioStatus((prev) => ({ ...prev, listening: true }))
        }
      })
      source.connect(desktopProcessor)
      desktopProcessor.connect(audioContextRef.current.destination)

      // Set up audio analysis for microphone
      micAudioContextRef.current = new AudioContext()
      micAnalyserRef.current = micAudioContextRef.current.createAnalyser()
      const micSource = micAudioContextRef.current.createMediaStreamSource(micStream)
      micSource.connect(micAnalyserRef.current)

      // Set up audio monitoring for microphone
      const micProcessor = micAudioContextRef.current.createScriptProcessor(2048, 1, 1)
      micProcessor.addEventListener('audioprocess', (e) => {
        const input = e.inputBuffer.getChannelData(0)
        const sum = input.reduce((acc, val) => acc + Math.abs(val), 0)
        if (sum > 0.01) {
          // Threshold for detecting audio
          setMicAudioStatus((prev) => ({ ...prev, listening: true }))
        }
      })
      micSource.connect(micProcessor)
      micProcessor.connect(micAudioContextRef.current.destination)

      streamRef.current = desktopStream
      micStreamRef.current = micStream

      if (videoRef.current) {
        videoRef.current.srcObject = desktopStream
        videoRef.current.onloadedmetadata = () => videoRef.current?.play()
      }

      setIsCapturing(true)
      startVisualization()
      startMicVisualization()

      return { desktopStream, micStream }
    } catch (error: any) {
      console.error('Error starting capture:', error)
      // Reset status on error
      setDesktopAudioStatus({ connection: 'disconnected', listening: false })
      setMicAudioStatus({ connection: 'disconnected', listening: false })
      return null
    }
  }

  const stopCapture = (): void => {
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

    setIsCapturing(false)

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

    // Reset audio status
    setDesktopAudioStatus({ connection: 'disconnected', listening: false })
    setMicAudioStatus({ connection: 'disconnected', listening: false })
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

      canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)

      const barWidth = (canvasRef.current.width / bufferLength) * 1.5
      let barHeight
      let x = 0

      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] / 2

        canvasCtx.fillStyle = `hsl(${(i / bufferLength) * 360}, 100%, 50%)`
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

      canvasCtx.clearRect(0, 0, micCanvasRef.current.width, micCanvasRef.current.height)

      const barWidth = (micCanvasRef.current.width / bufferLength) * 1.5
      let barHeight
      let x = 0

      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] / 2

        canvasCtx.fillStyle = `hsl(${(i / bufferLength) * 360}, 100%, 50%)`
        canvasCtx.fillRect(x, micCanvasRef.current.height - barHeight, barWidth, barHeight)

        x += barWidth + 1
      }
    }

    draw()
  }

  return {
    desktopAudioStatus,
    micAudioStatus,
    streamRef,
    micStreamRef,
    audioContextRef,
    micAudioContextRef,
    analyserRef,
    micAnalyserRef,
    canvasRef,
    micCanvasRef,
    animationFrameRef,
    micAnimationFrameRef,
    videoRef,
    startCapture,
    stopCapture,
    startVisualization,
    startMicVisualization,
    isCapturing
  }
}
