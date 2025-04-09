/**
 * Utility functions for application lifecycle management
 */

interface CleanupReferences {
  streamRef?: React.MutableRefObject<MediaStream | null>
  micStreamRef?: React.MutableRefObject<MediaStream | null>
  audioContextRef?: React.MutableRefObject<AudioContext | null>
  micAudioContextRef?: React.MutableRefObject<AudioContext | null>
  videoRef?: React.MutableRefObject<HTMLVideoElement | null>
  animationFrameRef?: React.MutableRefObject<number | null>
  micAnimationFrameRef?: React.MutableRefObject<number | null>
  canvasRef?: React.MutableRefObject<HTMLCanvasElement | null>
  micCanvasRef?: React.MutableRefObject<HTMLCanvasElement | null>
  wsRef?: React.MutableRefObject<WebSocket | null>
  peerConnectionRef?: React.MutableRefObject<RTCPeerConnection | null>
  dataChannelRef?: React.MutableRefObject<RTCDataChannel | null>
}

/**
 * Perform cleanup of all media and connection resources for graceful app shutdown
 */
export const handleCloseApp = (refs: CleanupReferences) => {
  // Stop any ongoing media streams
  if (refs.streamRef?.current) {
    refs.streamRef.current.getTracks().forEach((track) => track.stop())
    refs.streamRef.current = null
  }

  if (refs.micStreamRef?.current) {
    refs.micStreamRef.current.getTracks().forEach((track) => track.stop())
    refs.micStreamRef.current = null
  }

  // Close audio contexts
  if (refs.audioContextRef?.current) {
    refs.audioContextRef.current.close()
    refs.audioContextRef.current = null
  }

  if (refs.micAudioContextRef?.current) {
    refs.micAudioContextRef.current.close()
    refs.micAudioContextRef.current = null
  }

  // Clear video element
  if (refs.videoRef?.current) {
    refs.videoRef.current.srcObject = null
  }

  // Cancel any animation frames
  if (refs.animationFrameRef?.current) {
    cancelAnimationFrame(refs.animationFrameRef.current)
    refs.animationFrameRef.current = null
  }

  if (refs.micAnimationFrameRef?.current) {
    cancelAnimationFrame(refs.micAnimationFrameRef.current)
    refs.micAnimationFrameRef.current = null
  }

  // Clear canvases
  if (refs.canvasRef?.current) {
    const canvasCtx = refs.canvasRef.current.getContext('2d')
    if (canvasCtx) {
      canvasCtx.clearRect(0, 0, refs.canvasRef.current.width, refs.canvasRef.current.height)
    }
  }

  if (refs.micCanvasRef?.current) {
    const micCanvasCtx = refs.micCanvasRef.current.getContext('2d')
    if (micCanvasCtx) {
      micCanvasCtx.clearRect(
        0,
        0,
        refs.micCanvasRef.current.width,
        refs.micCanvasRef.current.height
      )
    }
  }

  // Close WebSocket connection
  if (refs.wsRef?.current) {
    refs.wsRef.current.close(1000, 'App closing')
    refs.wsRef.current = null
  }

  // Close WebRTC connection
  if (refs.peerConnectionRef?.current) {
    refs.peerConnectionRef.current.close()
    refs.peerConnectionRef.current = null
  }

  // Close data channel
  if (refs.dataChannelRef?.current) {
    refs.dataChannelRef.current.close()
    refs.dataChannelRef.current = null
  }

  // Close the app window
  window.api.closeApp?.()
}
