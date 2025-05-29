import React, { useState, useEffect } from 'react'
import {
  Box,
  Button,
  CircularProgress,
  Typography,
  Switch,
  FormControlLabel,
  Tooltip
} from '@mui/material'
import { AudioStatus } from '../hooks/useAudioCapture'
import { ResponseOutput } from './ResponseOutput'
import { TranscriptionDisplay } from './TranscriptionDisplay'
import { AudioStatusDisplay } from './AudioStatusDisplay'
import { WsStatus } from '../hooks/useTranscriptionService'
import { CurrentSession } from '../hooks/useAppNavigation'
import { checkSubscriptionStatus } from '../utils/checkSubscription'
import { authService } from '../services/authService'

const showTranscription = import.meta.env.DEV || false

interface CapturePageProps {
  isCapturing: boolean
  startCapture: () => void
  stopCapture: () => void
  bulletPoints: string[]
  currentBulletPoint: string
  readingMode: 'normal' | 'rapid' | 'spritz'
  onShowReadingModeModal: () => void
  desktopAudioStatus: AudioStatus
  micAudioStatus: AudioStatus
  transcriptText: string
  wsStatus: WsStatus
  wsError: string | null
  currentSession: CurrentSession | null
  goBack: () => void
  responseText: string
  desktopCanvasRef: React.RefObject<HTMLCanvasElement>
  micCanvasRef: React.RefObject<HTMLCanvasElement>
  handleManualDeleteEyeContact: () => void
  handleRestoreLastDeleted: () => void
  onMicSelected: (micId: string) => void
  selectedMic: string
  onNotSubscribed: () => void
  autoSkipEnabled: boolean
  onAutoSkipToggle: (enabled: boolean) => void
}

export const CapturePage: React.FC<CapturePageProps> = ({
  isCapturing,
  startCapture,
  stopCapture,
  bulletPoints,
  currentBulletPoint,
  readingMode,
  onShowReadingModeModal,
  desktopAudioStatus,
  micAudioStatus,
  transcriptText,
  wsStatus,
  wsError,
  goBack,
  desktopCanvasRef,
  micCanvasRef,
  handleManualDeleteEyeContact,
  handleRestoreLastDeleted,
  onMicSelected,
  selectedMic,
  onNotSubscribed,
  autoSkipEnabled,
  onAutoSkipToggle
}) => {
  // Determine command key based on platform
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
  const commandKey = isMac ? '⌘' : 'Ctrl'

  const [micOptions, setMicOptions] = useState<MediaDeviceInfo[]>([])
  const [isStarting, setIsStarting] = useState(false)
  const [statusMessage, setStatusMessage] = useState('Initializing')

  useEffect(() => {
    const getMicrophones = async () => {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const mics = devices.filter((device) => device.kind === 'audioinput')
      setMicOptions(mics)
    }
    getMicrophones()
  }, [])

  useEffect(() => {
    if (wsStatus != 'connected' && isStarting) {
      setIsStarting(true)
      const messages = [
        'Preparing transcription service',
        'Preparing audio capture',
        'Loading AI models',
        'Finalizing'
      ]
      let index = 0
      const interval = setInterval(() => {
        setStatusMessage(messages[index])
        index = (index + 1) % messages.length
        if (index === 0) {
          clearInterval(interval)
        }
      }, 3000)
      return () => {
        clearInterval(interval)
        setIsStarting(false)
      }
    }
    if (wsStatus === 'connected') {
      setIsStarting(false)
      setStatusMessage('')
    }
  }, [wsStatus, isStarting])

  const handleStartCapture = async () => {
    setIsStarting(true)
    // Subscription check before starting assistance
    const authState = authService.getAuthState()
    if (authState.isAuthenticated && authState.userId) {
      const result = await checkSubscriptionStatus(authState.userId)
      if (!result) {
        setIsStarting(false)
        onNotSubscribed()
        return
      }
    }
    if (wsStatus !== 'connecting') {
      startCapture()
    }
  }

  return (
    <Box
      sx={{
        // Use Flexbox for overall layout
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        // Account for fixed header elements in height calculation
        height: 'calc(100vh - 28px - 34px - 48px)',
        flexGrow: 1,
        overflowY: 'auto',
        px: 3,
        py: 2,
        // Add more space at the top to clear the instruction bar
        '&::-webkit-scrollbar': {
          display: 'block'
        },
        '&::-webkit-scrollbar-track': {
          marginTop: '34px'
        }
      }}
    >
      {/* Back Button - Top Left */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          p: 1,
          flexShrink: 0,
          justifyContent: 'space-between'
        }}
      >
        <Box
          onClick={goBack}
          sx={{
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            color: '#E9680C',
            marginTop: '10px',
            '&:hover': { color: '#FF8534' }
          }}
        >
          ← Back to Home
        </Box>

        <Box
          onClick={onShowReadingModeModal}
          sx={{
            outline: '1px solid #E9680C',
            borderRadius: '4px',
            padding: '4px 8px',
            cursor: 'pointer',
            color: '#E9680C',
            '&:hover': {
              outline: '2px solid #E9680C',
              backgroundColor: 'rgba(233, 104, 12, 0.1)'
            }
          }}
        >
          Reading Mode
        </Box>
      </Box>

      {/* Bullet Points - Top Middle */}
      <Box sx={{ width: '100%', maxWidth: '700px', mx: 'auto', px: 2, flexShrink: 0, mb: 2 }}>
        {/* Auto Skip Toggle */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <Tooltip title="Use AI to auto skip bullet points as you speak" arrow>
            <FormControlLabel
              control={
                <Switch
                  checked={autoSkipEnabled}
                  onChange={(e) => onAutoSkipToggle(e.target.checked)}
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': {
                      color: '#E9680C'
                    },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                      backgroundColor: '#E9680C'
                    }
                  }}
                />
              }
              label="Automatically Skip (Beta)"
              sx={{
                color: '#E9680C',
                '& .MuiFormControlLabel-label': {
                  fontSize: '0.9rem',
                  fontWeight: 500
                }
              }}
            />
          </Tooltip>
        </Box>

        <ResponseOutput
          isCapturing={isCapturing}
          bulletPoints={bulletPoints}
          currentBulletPoint={currentBulletPoint}
          readingMode={readingMode}
          commandKey={commandKey}
          handleManualDeleteEyeContact={handleManualDeleteEyeContact}
          handleRestoreLastDeleted={handleRestoreLastDeleted}
        />
      </Box>

      {/* Controls - Centered below bullet points */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          p: 2,
          flexShrink: 0
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 1 }}>
          {!isCapturing ? (
            <>
              <Button
                onClick={handleStartCapture}
                variant="contained"
                sx={
                  {
                    bgcolor: isStarting ? 'rgba(233, 104, 12, 0.5)' : 'rgba(233, 104, 12, 0.9)',
                    color: 'white',
                    px: 3,
                    py: 1,
                    fontSize: '1rem',
                    fontWeight: 500,
                    boxShadow: '0 4px 14px rgba(233, 104, 12, 0.4)',
                    '&:hover': {
                      bgcolor: isStarting ? 'rgba(233, 104, 12, 0.5)' : 'rgba(233, 104, 12, 1)',
                      boxShadow: '0 6px 20px rgba(233, 104, 12, 0.6)'
                    }
                  } as const
                }
              >
                {isStarting ? (
                  <>
                    <CircularProgress size={16} sx={{ color: 'white', mr: 1 }} />
                    Starting Assistance
                  </>
                ) : (
                  'Start Assistance'
                )}
              </Button>
              <select
                value={selectedMic}
                onChange={(e) => onMicSelected(e.target.value)}
                style={{
                  marginTop: '30px',
                  padding: '8px 12px',
                  borderRadius: '4px',
                  border: '1px solid rgba(233, 104, 12, 0.6)',
                  backgroundColor: 'rgba(21, 21, 21, 0.9)',
                  color: '#E9680C',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                  fontSize: '1rem',
                  fontWeight: 500,
                  outline: 'none',
                  transition: 'border-color 0.3s ease'
                }}
              >
                <option value="" style={{ color: '#E9680C' }}>
                  Select Microphone
                </option>
                {micOptions.map((mic) => (
                  <option key={mic.deviceId} value={mic.deviceId} style={{ color: '#E9680C' }}>
                    {mic.label || `Microphone ${mic.deviceId}`}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <Button
              onClick={stopCapture}
              variant="contained"
              disabled={wsStatus === 'connecting'}
              sx={
                {
                  bgcolor: 'rgba(239, 68, 68, 0.9)',
                  color: 'white',
                  px: 3,
                  py: 1,
                  fontSize: '1rem',
                  fontWeight: 500,
                  boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)',
                  '&:hover': {
                    bgcolor: 'rgba(239, 68, 68, 1)',
                    boxShadow: '0 6px 20px rgba(239, 68, 68, 0.6)'
                  }
                } as const
              }
            >
              {wsStatus === 'connecting' ? (
                <>
                  <CircularProgress size={16} sx={{ color: 'white', mr: 1 }} />
                  Starting Assistance
                </>
              ) : (
                <>Stop Assistance</>
              )}
            </Button>
          )}
          {isStarting || wsStatus === 'connecting' ? (
            <Typography sx={{ mt: 1, color: '#E9680C' }}>{statusMessage}</Typography>
          ) : null}
        </Box>
      </Box>

      {/* Transcription - Centered within scrollable area */}
      {showTranscription && (
        <Box sx={{ width: '100%', maxWidth: '800px', mx: 'auto', mb: 3 }}>
          <TranscriptionDisplay
            isCapturing={isCapturing}
            transcriptText={transcriptText}
            wsStatus={wsStatus}
            wsError={wsError}
          />
        </Box>
      )}

      {/* Audio Visualizers - Centered within scrollable area */}
      {isCapturing ? (
        <AudioStatusDisplay
          desktopAudioStatus={desktopAudioStatus}
          micAudioStatus={micAudioStatus}
          desktopCanvasRef={desktopCanvasRef}
          micCanvasRef={micCanvasRef}
        />
      ) : null}
    </Box>
  )
}

export default CapturePage
