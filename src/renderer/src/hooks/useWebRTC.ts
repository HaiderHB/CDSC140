import { useState, useRef, useEffect } from 'react'
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
// const MANUAL_DELAY = 1000

export const useWebRTC = ({
  currentSession,
  isCapturing,
  initialBulletPoints = []
}: UseWebRTCProps): UseWebRTCResult => {
  const [responseText, setResponseText] = useState('')
  const [bulletPoints, setBulletPoints] = useState<string[]>(initialBulletPoints)
  const [currentBulletPoint, setCurrentBulletPoint] = useState('')
  const [deletedBulletPoints, setDeletedBulletPoints] = useState<string[]>([])
  const isPrevDone = useRef(false)

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

    // Add manual delay
    // await new Promise((resolve) => setTimeout(resolve, MANUAL_DELAY))
    // Directly remove the bullet point at index 0
    const removedPoint = currentBulletPoints[0]
    setDeletedBulletPoints((prev) => [...prev, removedPoint])
    setBulletPoints((prev) => prev.slice(1))
    console.log('✅ Removed bullet point at index 0:', removedPoint)
  }

  const connectToOpenAI = async (stream: MediaStream): Promise<void> => {
    try {
      // Fetch the OpenAI session data, which includes the client secret for authentication
      const sessionData = await window.api.getOpenAISession()
      console.log('🔍 Session data:', sessionData)
      if (!sessionData.client_secret?.value) {
        // If the client secret is not available, log an error and exit the function
        console.error('Failed to get OpenAI token:', sessionData)
        return
      }
      console.log('Received OpenAI session token')

      // Create a new RTCPeerConnection instance for WebRTC
      const pc = new RTCPeerConnection()
      peerConnectionRef.current = pc

      // Add audio tracks from the MediaStream to the peer connection
      stream.getAudioTracks().forEach((track) => {
        pc.addTrack(track, stream)
      })

      // Create a data channel for sending messages to OpenAI
      const dc = pc.createDataChannel('oai-events')
      dataChannelRef.current = dc

      // Prepare the prompt for the current session
      const prompt = getPrompt(currentSession)

      // Event listener for when the data channel is open
      dc.addEventListener('open', () => {
        console.log('✅✅✅ Data channel open, sending session.update')
        const update = {
          type: 'session.update',
          session: { instructions: prompt } //, modalities: ['text'] }
        }
        console.log('🔍 Sending session update:', update)
        // Send the session update to OpenAI
        dataChannelRef.current?.send(JSON.stringify(update))

        console.log('✅✅✅ Data channel open, sending session.update 2222')

        const update2 = {
          type: 'session.update',
          session: { modalities: ['text'] }
        }
        console.log('🔍 Sending session update:', update2)
        // Send the session update to OpenAI
        dataChannelRef.current?.send(JSON.stringify(update2))

        // const update3 = {
        //   type: 'session.update',
        //   response: {
        //     input: [
        //       {
        //         type: 'message',
        //         role: 'user',
        //         content: [
        //           {
        //             type: 'input_text',
        //             text: 'So I made a next.js project with supabase as the backend hosted on vercel.'
        //           }
        //         ]
        //       }
        //     ]
        //   }
        // }
        // console.log('🔍 Sending session update:', update3)
        // // Send the session update to OpenAI
        // dataChannelRef.current?.send(JSON.stringify(update3))
      })

      // Event listener for incoming messages on the data channel
      dc.addEventListener('message', (event) => {
        try {
          const msg = JSON.parse(event.data)

          if (msg.type === 'response.text.delta') {
            const delta = msg.delta || ''
            const trimmed = delta.trim()

            console.log('🔍 Delta:', trimmed)

            // ✅ Skip PASSED entirely — do not append, do not reset
            if (trimmed === 'X') {
              console.log('⛔ Ignored X response from AI')
              return
            }

            // ✅ Reset state if previous response is done
            if (isPrevDone.current) {
              console.log('🔍 Resetting state because previous response is done')
              setBulletPoints([])
              setCurrentBulletPoint('')
              setResponseText('')
              isPrevDone.current = false
            }

            setResponseText((prev) => prev + delta)
            console.log('🔍 Response text:', responseText)
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
          } else if (msg.type === 'response.done') {
            isPrevDone.current = true
          }
        } catch (error) {
          console.error('Error parsing WebRTC message:', error)
        }
      })

      // Create an SDP offer for the WebRTC connection
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      console.log('Created WebRTC offer')

      try {
        const sdp = offer.sdp
        if (!sdp) throw new Error('Failed to create SDP offer')
        // Send the SDP offer to OpenAI and get the response
        const sdpResponse = await window.api.openAIWebRtcSdp(sdp)
        const answer = { type: 'answer' as RTCSdpType, sdp: sdpResponse }
        await pc.setRemoteDescription(answer) // Set the remote description with the response
        console.log('Successfully connected to OpenAI WebRTC')
      } catch (error) {
        // Log any errors that occur during the SDP exchange
        console.error('Error in WebRTC SDP exchange:', error)
      }
    } catch (error) {
      // Log any errors that occur during the WebRTC setup process
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
