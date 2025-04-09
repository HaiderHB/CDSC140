import React from 'react'
import {
  Box,
  Typography,
  Alert // Import Alert if needed for error display, or pass error message as prop
} from '@mui/material'

interface TranscriptionDisplayProps {
  isCapturing: boolean
  transcriptText: string
  wsStatus: 'disconnected' | 'connecting' | 'connected'
  wsError: string | null
}

export const TranscriptionDisplay: React.FC<TranscriptionDisplayProps> = ({
  isCapturing,
  transcriptText,
  wsStatus,
  wsError
}) => {
  // Decide whether to display based on props
  const shouldDisplay = isCapturing || transcriptText

  return (
    <Box
      className="transcription-container"
      sx={{
        mt: 3,
        p: 2,
        borderRadius: 2,
        bgcolor: 'background.paper',
        backgroundImage:
          'linear-gradient(to bottom right, rgba(37, 37, 37, 0.8), rgba(21, 21, 21, 0.9))',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
        maxWidth: '800px',
        margin: '0 auto',
        display: shouldDisplay ? 'block' : 'none' // Use prop derived value
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
}
