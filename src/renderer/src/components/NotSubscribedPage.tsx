import React from 'react'
import { Box, Button, Container, Typography } from '@mui/material'
interface NotSubscribedPageProps {
  onReload: () => void
  onLogout: () => void
}

const NotSubscribedPage: React.FC<NotSubscribedPageProps> = ({ onReload, onLogout }) => {
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
          You must be subscribed
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          Your account does not have an active subscription. Please subscribe to continue using
          Interview Speaker.
        </Typography>
        <Button
          variant="contained"
          size="large"
          href="https://interviewspeaker.co/#pricing"
          target="_blank"
          rel="noopener noreferrer"
          sx={{ minWidth: 200, py: 1.5 }}
        >
          Subscribe
        </Button>
        <Button variant="contained" size="large" onClick={onReload} sx={{ minWidth: 200, py: 1.5 }}>
          Check Again
        </Button>
        <Button variant="contained" size="large" onClick={onLogout} sx={{ minWidth: 200, py: 1.5 }}>
          Logout
        </Button>
      </Box>
    </Container>
  )
}

export default NotSubscribedPage
