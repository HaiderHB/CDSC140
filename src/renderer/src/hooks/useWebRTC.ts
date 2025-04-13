import { useState, useRef, useEffect } from 'react'
import Fuse from 'fuse.js'
import { CurrentSession } from './useAppNavigation'
import { getPrompt } from '@renderer/utils/prompts'

interface UseWebRTCProps {
  currentSession: CurrentSession | null
  isCapturing: boolean
  initialBulletPoints?: string[]
}

interface UseWebRTCResult {
  responseText: string
  bulletPoints: string[]
  currentBulletPoint: string
  deletedBulletPoints: string[]
  connectToOpenAI: (stream: MediaStream) => Promise<void>
  handleManualDeleteEyeContact: () => void
  handleRestoreLastDeleted: () => void
  resetWebRTCState: () => void
  findAndRemoveMatchingBulletPoint: (transcript: string) => void
}

export const useWebRTC = ({
  currentSession,
  isCapturing,
  initialBulletPoints = []
}: UseWebRTCProps): UseWebRTCResult => {
  const [responseText, setResponseText] = useState('')
  const [bulletPoints, setBulletPoints] = useState<string[]>(initialBulletPoints)
  const [currentBulletPoint, setCurrentBulletPoint] = useState('')
  const [deletedBulletPoints, setDeletedBulletPoints] = useState<string[]>([])

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const dataChannelRef = useRef<RTCDataChannel | null>(null)
  const bulletPointsRef = useRef<string[]>(bulletPoints)
  const bulletPointsInitializedRef = useRef(!!initialBulletPoints.length)

  useEffect(() => {
    bulletPointsRef.current = bulletPoints
    console.log('📋 Bullet points updated in WebRTC hook:', bulletPoints)
  }, [bulletPoints])

  useEffect(() => {
    if (!isCapturing) {
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close()
        peerConnectionRef.current = null
      }
      if (dataChannelRef.current) {
        dataChannelRef.current.close()
        dataChannelRef.current = null
      }
    }
  }, [isCapturing])

  const findAndRemoveMatchingBulletPoint = (matchedPoint: string) => {
    console.log('🎯 Received potential match (e.g., from transcription): ', matchedPoint)

    const currentBulletPoints = bulletPointsRef.current
    if (currentBulletPoints.length === 0) {
      console.log('🤷 No bullet points to match against.')
      return
    }
    console.log('🔍 Current bullet points in state:', currentBulletPoints)

    const exactMatch = currentBulletPoints.includes(matchedPoint)

    if (exactMatch) {
      console.log('✅ Exact match found in bullet points, removing:', matchedPoint)
      setBulletPoints((prev) => prev.filter((point) => point !== matchedPoint))
    } else {
      console.log('⚠️ No exact match, using Fuse.js for fuzzy matching:', matchedPoint)

      const fuseOptions = {
        includeScore: true,
        threshold: 0.4,
        keys: ['.']
      }
      const fuse = new Fuse(currentBulletPoints, fuseOptions)
      const searchResult = fuse.search(matchedPoint)

      if (searchResult.length > 0) {
        const bestMatch = searchResult[0]
        console.log(
          `✅ Found fuzzy match with Fuse.js: "${bestMatch.item}" (Score: ${bestMatch.score?.toFixed(4)})`
        )
        setBulletPoints((prev) => prev.filter((point) => point !== bestMatch.item))
      } else {
        console.log('❌ No match found with Fuse.js.')
      }
    }
  }

  const connectToOpenAI = async (stream: MediaStream): Promise<void> => {
    try {
      const sessionData = await window.api.getOpenAISession()
      if (!sessionData.client_secret?.value) {
        console.error('Failed to get OpenAI token:', sessionData)
        return
      }
      console.log('Received OpenAI session token')

      const pc = new RTCPeerConnection()
      peerConnectionRef.current = pc

      stream.getAudioTracks().forEach((track) => {
        pc.addTrack(track, stream)
      })

      const dc = pc.createDataChannel('oai-events')
      dataChannelRef.current = dc

      const prompt = getPrompt(currentSession)

      dc.addEventListener('open', () => {
        console.log('Data channel open, sending session.update')
        const update = {
          type: 'session.update',
          session: { instructions: prompt }
        }
        dataChannelRef.current?.send(JSON.stringify(update))
      })

      dc.addEventListener('message', (event) => {
        try {
          const msg = JSON.parse(event.data)

          if (msg.type === 'response.audio_transcript.delta') {
            const delta = msg.delta || ''
            setResponseText((prev) => prev + delta)
            // If the response text includes "PASSED", clear the response text and return
            if (responseText.includes('PASSED')) {
              setResponseText('')
              return
            }

            setCurrentBulletPoint((prev) => {
              const newText = prev + delta
              if (delta.includes('•')) {
                const parts = newText.split('•')
                if (parts.length > 1) {
                  setBulletPoints((prevPoints) => {
                    const newPoints = [...prevPoints]
                    for (let i = 0; i < parts.length - 1; i++) {
                      const point = parts[i].trim()
                      if (point && !newPoints.includes(point)) {
                        newPoints.push(point)
                      }
                    }
                    return newPoints
                  })
                  return parts[parts.length - 1]
                }
              }
              return newText
            })
          } else if (msg.type === 'response.text.done') {
            if (currentBulletPoint.trim()) {
              setBulletPoints((prev) => [...prev, currentBulletPoint.trim()])
              setCurrentBulletPoint('')
            }
            const responseRequest = {
              type: 'response.create',
              response: { modalities: ['text'] }
            }
            if (dataChannelRef.current) {
              dataChannelRef.current.send(JSON.stringify(responseRequest))
            }
          } else {
          }
        } catch (error) {
          console.error('Error parsing WebRTC message:', error)
        }
      })

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      console.log('Created WebRTC offer')

      try {
        const sdp = offer.sdp
        if (!sdp) throw new Error('Failed to create SDP offer')
        const sdpResponse = await window.api.openAIWebRtcSdp(sdp)
        const answer = { type: 'answer' as RTCSdpType, sdp: sdpResponse }
        await pc.setRemoteDescription(answer)
        console.log('Successfully connected to OpenAI WebRTC')
      } catch (error) {
        console.error('Error in WebRTC SDP exchange:', error)
      }
    } catch (error) {
      console.error('Error setting up WebRTC:', error)
    }
  }

  const handleManualDeleteEyeContact = () => {
    if (bulletPoints.length > 0) {
      const deletedPoint = bulletPoints[0]
      setBulletPoints((prev) => prev.slice(1))
      setDeletedBulletPoints((prev) => [...prev, deletedPoint])
    }
  }

  const handleRestoreLastDeleted = () => {
    if (deletedBulletPoints.length > 0) {
      const pointToRestore = deletedBulletPoints[deletedBulletPoints.length - 1]
      setBulletPoints((prev) => [pointToRestore, ...prev])
      setDeletedBulletPoints((prev) => prev.slice(0, -1))
    }
  }

  const resetWebRTCState = () => {
    setResponseText('')
    setBulletPoints([])
    setCurrentBulletPoint('')
    setDeletedBulletPoints([])
    bulletPointsInitializedRef.current = false

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }
    if (dataChannelRef.current) {
      dataChannelRef.current.close()
      dataChannelRef.current = null
    }
    console.log('WebRTC state reset')
  }

  return {
    responseText,
    bulletPoints,
    currentBulletPoint,
    deletedBulletPoints,
    connectToOpenAI,
    handleManualDeleteEyeContact,
    handleRestoreLastDeleted,
    resetWebRTCState,
    findAndRemoveMatchingBulletPoint
  }
}
