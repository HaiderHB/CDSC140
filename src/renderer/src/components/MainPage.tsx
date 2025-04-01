import React from 'react'
import { Box, Typography, Button, Container, Card, CardContent } from '@mui/material'
import { motion } from 'framer-motion'

interface MainPageProps {
  onNewSession: () => void
  onLoadSession: () => void
}

function MainPage({ onNewSession, onLoadSession }: MainPageProps) {
  return (
    <Container maxWidth="lg">
      <Box
        sx={{
          py: 6,
          textAlign: 'center'
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Typography
            variant="h2"
            component="h1"
            sx={{
              mb: 2,
              background: 'linear-gradient(to right, #6366f1, #ec4899)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontWeight: 700
            }}
          >
            Interview Assistant
          </Typography>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <Typography variant="h6" sx={{ mb: 5, color: 'text.secondary' }}>
            Prepare for interviews with real-time feedback and analysis
          </Typography>
        </motion.div>

        <Box
          sx={{
            display: 'flex',
            gap: 3,
            justifyContent: 'center',
            flexWrap: 'wrap'
          }}
        >
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
          >
            <Button
              variant="contained"
              size="large"
              onClick={onNewSession}
              sx={{
                px: 4,
                py: 1.5,
                fontSize: '1rem'
              }}
            >
              New Session
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
          >
            <Button
              variant="contained"
              color="secondary"
              size="large"
              onClick={onLoadSession}
              sx={{
                px: 4,
                py: 1.5,
                fontSize: '1rem'
              }}
            >
              My Sessions
            </Button>
          </motion.div>
        </Box>

        <Box sx={{ mt: 10 }}>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
          >
            <Card sx={{ maxWidth: 700, mx: 'auto', overflow: 'hidden' }}>
              <CardContent sx={{ p: 4 }}>
                <Typography variant="h5" sx={{ mb: 2 }}>
                  Get Ready for Your Next Interview
                </Typography>
                <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                  Our AI-powered assistant helps you prepare for interviews by providing real-time
                  feedback on your responses. Practice with our tool to improve your interview
                  skills and boost your confidence.
                </Typography>
              </CardContent>
            </Card>
          </motion.div>
        </Box>
      </Box>
    </Container>
  )
}

export default MainPage
