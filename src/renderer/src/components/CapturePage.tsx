import React, { useState, useRef, useEffect } from 'react'
import { Box, Button, CircularProgress, Typography } from '@mui/material'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'

import { AudioStatus } from '../hooks/useAudioCapture'
import { ResponseOutput } from './ResponseOutput'
import { TranscriptionDisplay } from './TranscriptionDisplay'
import { AudioStatusDisplay } from './AudioStatusDisplay'
import { WsStatus } from '../hooks/useTranscriptionService'
import { CurrentSession } from '../hooks/useAppNavigation'

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
  isListening: boolean
  currentSession: CurrentSession | null
  goBack: () => void
  responseText: string
  desktopCanvasRef: React.RefObject<HTMLCanvasElement>
  micCanvasRef: React.RefObject<HTMLCanvasElement>
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
  isListening,
  currentSession,
  goBack,
  responseText,
  desktopCanvasRef,
  micCanvasRef
}) => {
  const [showCommands, setShowCommands] = useState(true)

  // Determine command key based on platform
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
  const commandKey = isMac ? '⌘' : 'Ctrl'

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

        {/* Commands toggle - Top Right */}
        <Box
          onClick={() => setShowCommands(!showCommands)}
          sx={{
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            color: 'text.secondary',
            marginTop: '10px',
            '&:hover': { color: 'white' }
          }}
        >
          {showCommands ? (
            <VisibilityIcon fontSize="small" sx={{ fontSize: '0.85rem' }} />
          ) : (
            <VisibilityOffIcon fontSize="small" sx={{ fontSize: '0.85rem' }} />
          )}
          <Typography variant="caption" sx={{ fontSize: '0.85rem' }}>
            Commands
          </Typography>
        </Box>
      </Box>

      {/* Bullet Points - Top Middle */}
      <Box sx={{ width: '100%', maxWidth: '700px', mx: 'auto', px: 2, flexShrink: 0, mb: 2 }}>
        <ResponseOutput
          isCapturing={isCapturing}
          bulletPoints={bulletPoints}
          currentBulletPoint={currentBulletPoint}
          readingMode={readingMode}
          showCommands={showCommands}
          commandKey={commandKey}
          onShowReadingModeModal={onShowReadingModeModal}
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
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 1 }}>
          {!isCapturing ? (
            <Button
              onClick={startCapture}
              variant="contained"
              sx={{
                bgcolor: 'rgba(233, 104, 12, 0.9)',
                color: 'white',
                px: 3,
                py: 1,
                fontSize: '1rem',
                fontWeight: 500,
                boxShadow: '0 4px 14px rgba(233, 104, 12, 0.4)',
                '&:hover': {
                  bgcolor: 'rgba(233, 104, 12, 1)',
                  boxShadow: '0 6px 20px rgba(233, 104, 12, 0.6)'
                }
              }}
            >
              Start Capture
            </Button>
          ) : (
            <Button
              onClick={stopCapture}
              variant="contained"
              sx={{
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
              }}
            >
              Stop Capture
            </Button>
          )}
        </Box>
        {isListening && (
          <Box sx={{ color: '#4ade80', mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={16} sx={{ color: '#4ade80' }} />
            Listening for speech...
          </Box>
        )}
      </Box>

      {/* Transcription - Centered within scrollable area */}
      <Box sx={{ width: '100%', maxWidth: '800px', mx: 'auto', mb: 3 }}>
        <TranscriptionDisplay
          isCapturing={isCapturing}
          transcriptText={transcriptText}
          wsStatus={wsStatus}
          wsError={wsError}
        />
      </Box>

      {/* Audio Visualizers - Centered within scrollable area */}
      <AudioStatusDisplay
        desktopAudioStatus={desktopAudioStatus}
        micAudioStatus={micAudioStatus}
        desktopCanvasRef={desktopCanvasRef}
        micCanvasRef={micCanvasRef}
      />
    </Box>
  )
}

export default CapturePage
