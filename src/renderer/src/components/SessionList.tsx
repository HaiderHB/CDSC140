import React from 'react'
import { Box, Typography, Card, CardContent, IconButton, Stack, Chip, Divider } from '@mui/material'
import { motion } from 'framer-motion'

interface Session {
  id: string
  name: string
  date?: string
  resumeId?: string
  resumeName?: string
}

interface SessionListProps {
  sessions: Session[]
  onDeleteSession: (id: string) => void
}

function SessionList({ sessions, onDeleteSession }: SessionListProps) {
  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" sx={{ mb: 3, fontWeight: 600 }}>
        Your Interview Sessions
      </Typography>

      {sessions.length === 0 ? (
        <Box
          sx={{
            p: 4,
            textAlign: 'center',
            bgcolor: 'rgba(30, 41, 59, 0.4)',
            borderRadius: 2,
            border: '1px dashed rgba(255, 255, 255, 0.1)'
          }}
        >
          <Typography variant="body1" sx={{ color: 'text.secondary' }}>
            No sessions available. Create a new session to get started.
          </Typography>
        </Box>
      ) : (
        <Stack spacing={3}>
          {sessions.map((session, index) => (
            <motion.div
              key={session.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              <Card
                sx={{
                  position: 'relative',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 12px 24px rgba(99, 102, 241, 0.2)'
                  }
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      mb: 2
                    }}
                  >
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {session.name}
                    </Typography>
                    <IconButton
                      onClick={() => onDeleteSession(session.id)}
                      size="small"
                      sx={{
                        color: 'rgba(255,255,255,0.6)',
                        '&:hover': {
                          color: '#ec4899',
                          bgcolor: 'rgba(236, 72, 153, 0.1)'
                        }
                      }}
                    >
                      <span>×</span>
                    </IconButton>
                  </Box>

                  {session.date && (
                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                      {new Date(session.date).toLocaleDateString()}
                    </Typography>
                  )}

                  {session.resumeId && (
                    <Box sx={{ mt: 2 }}>
                      <Divider sx={{ my: 1.5 }} />
                      <Box sx={{ display: 'flex', alignItems: 'center', mt: 1.5 }}>
                        <Typography variant="body2" sx={{ color: 'text.secondary', mr: 1 }}>
                          Resume:
                        </Typography>
                        <Chip
                          label={session.resumeName || 'Selected Resume'}
                          size="small"
                          sx={{
                            bgcolor: 'rgba(99, 102, 241, 0.1)',
                            color: 'primary.light',
                            borderRadius: 1
                          }}
                        />
                      </Box>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </Stack>
      )}
    </Box>
  )
}

export default SessionList
