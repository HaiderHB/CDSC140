import React from 'react'
import { Box, Button, Container, Typography } from '@mui/material'
import { authService } from '../services/authService'

export const LoginPage: React.FC = () => {
  const handleLogin = async () => {
    await authService.initiateLogin()
  }

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          mt: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 3,
          textAlign: 'center'
        }}
      >
        <Typography variant="h4" component="h1" gutterBottom>
          Welcome to Interview Speaker
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          Please sign in to continue using the application
        </Typography>
        <Button
          variant="contained"
          size="large"
          onClick={handleLogin}
          sx={{
            minWidth: 200,
            py: 1.5
          }}
        >
          Sign In
        </Button>
      </Box>
    </Container>
  )
}
