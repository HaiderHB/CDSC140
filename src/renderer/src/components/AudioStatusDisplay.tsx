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
}

export const AudioStatusDisplay: React.FC<AudioStatusDisplayProps> = ({
  desktopAudioStatus,
  micAudioStatus
}) => {
  return (
    <Box
      className="audio-status-container"
      sx={{
        width: '100%',
        maxWidth: '800px',
        mx: 'auto',
        display: 'flex',
        gap: 4,
        justifyContent: 'center'
      }}
    >
      {/* Desktop Audio Status */}
      <Paper
        elevation={0}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          p: 2,
          borderRadius: 1,
          backgroundImage:
            'linear-gradient(to bottom right, rgba(37, 37, 37, 0.8), rgba(21, 21, 21, 0.9))',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
          transition: 'all 0.2s ease',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
          }
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
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
            boxShadow: desktopAudioStatus.listening ? '0 0 0 4px rgba(16, 185, 129, 0.2)' : 'none'
          }}
        />
        <Typography variant="subtitle2">
          System Audio:{' '}
          {desktopAudioStatus.connection === 'disconnected'
            ? 'Not Connected'
            : desktopAudioStatus.listening
              ? 'Connected, Listening'
              : 'Connected, No Audio'}
        </Typography>
      </Paper>

      {/* Microphone Audio Status */}
      <Paper
        elevation={0}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          p: 2,
          backgroundImage:
            'linear-gradient(to bottom right, rgba(37, 37, 37, 0.8), rgba(21, 21, 21, 0.9))',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
          transition: 'all 0.2s ease',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
          }
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
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
            boxShadow: micAudioStatus.listening ? '0 0 0 4px rgba(16, 185, 129, 0.2)' : 'none'
          }}
        />
        <Typography variant="subtitle2">
          Microphone:{' '}
          {micAudioStatus.connection === 'disconnected'
            ? 'Not Connected'
            : micAudioStatus.listening
              ? 'Connected, Listening'
              : 'Connected, No Audio'}
        </Typography>
      </Paper>
    </Box>
  )
}
