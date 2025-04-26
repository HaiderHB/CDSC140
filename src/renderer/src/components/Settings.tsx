import React from 'react'
import { Box, Button, Paper, Typography } from '@mui/material'
import LogoutIcon from '@mui/icons-material/Logout'

interface SettingsProps {
  onLogout: () => void
}

function Settings({ onLogout }: SettingsProps) {
  return (
    <Box sx={{ p: 2, width: '100%' }}>
      <Paper
        sx={{
          p: 4,
          backgroundImage:
            'linear-gradient(to bottom right, rgba(37, 37, 37, 0.8), rgba(21, 21, 21, 0.9))',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
          borderRadius: 2
        }}
      >
        <Typography variant="h6" sx={{ mb: 4 }}>
          Account Settings
        </Typography>

        <Button
          variant="outlined"
          color="white"
          startIcon={<LogoutIcon />}
          onClick={onLogout}
          sx={{
            borderColor: 'rgba(255, 99, 71, 0.5)',
            '&:hover': {
              borderColor: 'rgba(255, 99, 71, 0.8)',
              backgroundColor: 'rgba(255, 99, 71, 0.1)'
            }
          }}
        >
          Sign Out
        </Button>
      </Paper>
    </Box>
  )
}

export default Settings
