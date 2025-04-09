import React from 'react'
import { Box, Paper, Typography } from '@mui/material'

// Define AudioStatus type here or import from a shared location
interface AudioStatus {
  connection: 'disconnected' | 'connected'
  listening: boolean
}

interface AudioStatusDisplayProps {
  desktopAudioStatus: AudioStatus
  micAudioStatus: AudioStatus
  desktopCanvasRef: React.RefObject<HTMLCanvasElement>
  micCanvasRef: React.RefObject<HTMLCanvasElement>
}

export const AudioStatusDisplay: React.FC<AudioStatusDisplayProps> = ({
  desktopAudioStatus,
  micAudioStatus,
  desktopCanvasRef,
  micCanvasRef
}) => {
  return (
    <Box
      className="audio-status-container"
      sx={{
        width: '100%',
        maxWidth: '800px',
        mx: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        alignItems: 'center'
      }}
    >
      {/* Status Indicators Row */}
      <Box
        sx={{
          display: 'flex',
          gap: 4,
          justifyContent: 'center',
          width: '100%'
        }}
      >
        {/* Desktop Audio Status */}
        <Paper
          elevation={0}
          sx={{
            flexGrow: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            p: 1.5,
            borderRadius: 1,
            backgroundImage:
              'linear-gradient(to bottom right, rgba(37, 37, 37, 0.8), rgba(21, 21, 21, 0.9))',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
          }}
        >
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              mr: 1,
              bgcolor:
                desktopAudioStatus.connection === 'disconnected'
                  ? '#ef4444'
                  : desktopAudioStatus.listening
                    ? '#10b981'
                    : '#f59e0b',
              boxShadow: desktopAudioStatus.listening
                ? '0 0 0 4px rgba(16, 185, 129, 0.2)'
                : 'none',
              transition: 'background-color 0.3s ease, box-shadow 0.3s ease'
            }}
          />
          <Typography variant="body2">
            System Audio:{' '}
            {desktopAudioStatus.connection === 'disconnected'
              ? 'Not Connected'
              : desktopAudioStatus.listening
                ? 'Listening'
                : 'Connected'}
          </Typography>
        </Paper>

        {/* Microphone Audio Status */}
        <Paper
          elevation={0}
          sx={{
            flexGrow: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            p: 1.5,
            borderRadius: 1,
            backgroundImage:
              'linear-gradient(to bottom right, rgba(37, 37, 37, 0.8), rgba(21, 21, 21, 0.9))',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
          }}
        >
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              mr: 1,
              bgcolor:
                micAudioStatus.connection === 'disconnected'
                  ? '#ef4444'
                  : micAudioStatus.listening
                    ? '#10b981'
                    : '#f59e0b',
              boxShadow: micAudioStatus.listening ? '0 0 0 4px rgba(16, 185, 129, 0.2)' : 'none',
              transition: 'background-color 0.3s ease, box-shadow 0.3s ease'
            }}
          />
          <Typography variant="body2">
            Microphone:{' '}
            {micAudioStatus.connection === 'disconnected'
              ? 'Not Connected'
              : micAudioStatus.listening
                ? 'Listening'
                : 'Connected'}
          </Typography>
        </Paper>
      </Box>

      {/* Visualizers Row */}
      <Box
        sx={{
          display: 'flex',
          gap: 4,
          justifyContent: 'center',
          width: '100%',
          mt: 1
        }}
      >
        {/* Desktop Audio Visualizer Canvas */}
        <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center' }}>
          <canvas
            ref={desktopCanvasRef}
            style={{ width: '100%', maxWidth: '320px', height: '50px' }}
          />
        </Box>

        {/* Mic Audio Visualizer Canvas */}
        <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center' }}>
          <canvas ref={micCanvasRef} style={{ width: '100%', maxWidth: '320px', height: '50px' }} />
        </Box>
      </Box>
    </Box>
  )
}
