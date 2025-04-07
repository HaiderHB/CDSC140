import {
  Box,
  CardContent,
  Chip,
  Divider,
  IconButton,
  Paper,
  Typography
} from '@mui/material'
import Grid from '@mui/material/Grid'
import { motion } from 'framer-motion'
import AddIcon from '@mui/icons-material/Add'

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
  onSelectSession: (id: string) => void
  onNewSession: () => void
}

// Define styles for the tiles
const tileBaseStyle = {
  position: 'relative',
  width: '100%',
  maxWidth: '200px',
  minWidth: '200px',
  aspectRatio: '1/1',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'flex-start',
  borderRadius: 2,
  margin: 1,
  overflow: 'hidden',
  bgcolor: 'rgba(30, 41, 59, 0.6)',
  backdropFilter: 'blur(4px)',
  transition: 'all 0.3s ease',
  cursor: 'pointer',
  '&::before': {
    content: '""',
    position: 'absolute',
    inset: '-2px',
    borderRadius: 'inherit',
    background:
      'linear-gradient(145deg, rgba(99, 102, 241, 0), rgba(99, 102, 241, 0.4), rgba(236, 72, 153, 0), rgba(236, 72, 153, 0.5)) 0% 0% / 400% 400%',
    zIndex: -1,
    opacity: 0,
    transition: 'opacity 0.4s ease, background-position 1s ease'
  },
  '&:hover': {
    transform: 'translateY(-4px)',
    bgcolor: 'rgba(30, 41, 59, 0.8)',
    '&::before': {
      opacity: 1,
      animation: 'gradient-spin 4s linear infinite'
    }
  }
}

const addTileStyle = {
  ...tileBaseStyle,
  alignItems: 'center',
  justifyContent: 'center',
  border: '2px dashed rgba(255, 255, 255, 0.2)',
  bgcolor: 'transparent', // Different background for add tile
  '&:hover': {
    transform: 'translateY(-4px)',
    borderColor: 'rgba(99, 102, 241, 0.8)',
    bgcolor: 'rgba(99, 102, 241, 0.1)',
    '& svg': {
      color: '#818cf8' // Brighter icon on hover
    }
  },
  '&::before': {
    // Disable gradient glow for add tile
    display: 'none'
  }
}

function SessionList({
  sessions,
  onDeleteSession,
  onSelectSession,
  onNewSession
}: SessionListProps) {
  return (
    <Box>
      <Grid container spacing={2}>
        <Grid xs={12} sm={6} md={4}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            style={{ width: '100%' }}
          >
            <Paper sx={addTileStyle} onClick={onNewSession}>
              <Box sx={{ textAlign: 'center' }}>
                <AddIcon
                  sx={{
                    fontSize: 40,
                    color: 'rgba(255, 255, 255, 0.6)',
                    transition: 'color 0.3s ease'
                  }}
                />
                <Typography sx={{ mt: 1, color: 'text.secondary' }}>New Session</Typography>
              </Box>
            </Paper>
          </motion.div>
        </Grid>

        {sessions.map((session, index) => (
          <Grid xs={12} sm={6} md={4} key={session.id}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: (index + 1) * 0.05 }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              style={{ width: '100%' }}
            >
              <Paper sx={tileBaseStyle} onClick={() => onSelectSession(session.id)}>
                <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      mb: 2
                    }}
                  >
                    <Typography variant="h6" sx={{ fontWeight: 600, flexGrow: 1, mr: 1 }}>
                      {session.name}
                    </Typography>
                    <IconButton
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteSession(session.id)
                      }}
                      size="small"
                      sx={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        color: 'rgba(255,255,255,0.4)',
                        bgcolor: 'rgba(0,0,0,0.2)',
                        '&:hover': {
                          color: '#ec4899',
                          bgcolor: 'rgba(236, 72, 153, 0.2)'
                        }
                      }}
                    >
                      <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>×</span>
                    </IconButton>
                  </Box>

                  {session.date && (
                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                      {new Date(session.date).toLocaleDateString()}
                    </Typography>
                  )}

                  <Box sx={{ flexGrow: 1 }} />

                  {session.resumeId && (
                    <Box sx={{ mt: 'auto' }}>
                      <Divider sx={{ my: 1, bgcolor: 'rgba(255,255,255,0.1)' }} />
                      <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', mr: 1 }}>
                          Resume:
                        </Typography>
                        <Chip
                          label={session.resumeName || 'Selected Resume'}
                          size="small"
                          sx={{
                            bgcolor: 'rgba(99, 102, 241, 0.15)',
                            color: '#a5b4fc',
                            fontSize: '0.7rem',
                            height: '20px'
                          }}
                        />
                      </Box>
                    </Box>
                  )}
                </CardContent>
              </Paper>
            </motion.div>
          </Grid>
        ))}

        {sessions.length === 0 && (
          <Grid xs={12}>
            <Box
              sx={{
                p: 4,
                textAlign: 'center'
              }}
            >
              <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                No sessions yet. Click the '+' tile to create one!
              </Typography>
            </Box>
          </Grid>
        )}
      </Grid>
    </Box>
  )
}

export default SessionList
