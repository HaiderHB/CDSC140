import {
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  IconButton,
  Chip
} from '@mui/material'
import { motion } from 'framer-motion'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'

interface Session {
  id: string
  name: string
  date?: string
  resumeId?: string
  resumeName?: string
  jobDescription?: string
}

interface SessionListProps {
  sessions: Session[]
  onDeleteSession: (id: string) => void
  onSelectSession: (id: string) => void
  onNewSession: () => void
}

function SessionList({
  sessions,
  onDeleteSession,
  onSelectSession,
  onNewSession
}: SessionListProps) {
  // Sort sessions by date - newest first
  const sortedSessions = [...sessions].sort((a, b) => {
    const dateA = a.date ? new Date(a.date).getTime() : 0
    const dateB = b.date ? new Date(b.date).getTime() : 0
    return dateB - dateA // Descending order (newest first)
  })

  return (
    <Box sx={{ p: 2, width: '100%' }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          mb: 4
        }}
      >
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={onNewSession}
          sx={{
            py: 1.5,
            px: 4,
            borderRadius: 2,
            backgroundImage: 'linear-gradient(to right, #C45400, #E9680C)',
            boxShadow: '0 4px 14px rgba(233, 104, 12, 0.4), 0 0 20px rgba(233, 104, 12, 0.3)',
            fontWeight: 600,
            '&:hover': {
              backgroundImage: 'linear-gradient(to right, #B34800, #D05800)',
              boxShadow: '0 6px 20px rgba(233, 104, 12, 0.6), 0 0 30px rgba(233, 104, 12, 0.4)'
            }
          }}
        >
          New Session
        </Button>
      </Box>

      {sortedSessions.length === 0 ? (
        <Box
          sx={{
            p: 4,
            textAlign: 'center',
            bgcolor: 'background.paper',
            borderRadius: 2,
            border: '1px dashed rgba(255, 255, 255, 0.1)'
          }}
        >
          <Typography variant="body1" sx={{ color: 'text.secondary' }}>
            No sessions yet. Click the 'New Session' button to create one!
          </Typography>
        </Box>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <TableContainer
            component={Paper}
            sx={{
              backgroundImage:
                'linear-gradient(to bottom right, rgba(37, 37, 37, 0.8), rgba(21, 21, 21, 0.9))',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
              borderRadius: 2,
              overflow: 'hidden'
            }}
          >
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell
                    sx={{
                      fontWeight: 600,
                      color: 'text.primary',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                      pl: 3
                    }}
                  >
                    Session Name
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: 600,
                      color: 'text.primary',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
                    }}
                  >
                    Date
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: 600,
                      color: 'text.primary',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
                    }}
                  >
                    Mode
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: 600,
                      color: 'text.primary',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
                    }}
                  >
                    Job Description
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: 600,
                      color: 'text.primary',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
                    }}
                  >
                    Resume
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
                    }}
                  >
                    Delete
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedSessions.map((session, index) => (
                  <TableRow
                    key={session.id}
                    onClick={() => onSelectSession(session.id)}
                    sx={{
                      cursor: 'pointer',
                      transition: 'background-color 0.2s',
                      '&:hover': {
                        bgcolor: 'rgba(233, 104, 12, 0.05)'
                      }
                    }}
                  >
                    <TableCell
                      sx={{
                        fontWeight: 500,
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                        pl: 3
                      }}
                    >
                      {/* Display a default name if name is missing */}
                      {session.name || `Session ${index + 1}`}
                    </TableCell>
                    <TableCell
                      sx={{
                        color: 'text.secondary',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
                      }}
                    >
                      {session.date ? new Date(session.date).toLocaleDateString() : '-'}
                    </TableCell>
                    <TableCell
                      sx={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
                      }}
                    >
                      <Chip
                        label={session.mode?.toUpperCase() || '-'}
                        size="small"
                        sx={{
                          bgcolor: 'rgba(233, 104, 12, 0.2)',
                          color: 'primary.light',
                          fontSize: '0.75rem'
                        }}
                      />
                    </TableCell>

                    <TableCell
                      sx={{
                        color: 'text.secondary',
                        maxWidth: '300px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
                      }}
                    >
                      {session.jobDescription || '-'}
                    </TableCell>
                    <TableCell
                      sx={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
                      }}
                    >
                      {session.resumeId ? (
                        <Chip
                          label={session.resumeName || 'Selected Resume'}
                          size="small"
                          sx={{
                            bgcolor: 'rgba(233, 104, 12, 0.2)',
                            color: 'primary.light',
                            fontSize: '0.75rem'
                          }}
                        />
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <IconButton
                        onClick={(e) => {
                          e.stopPropagation()
                          onDeleteSession(session.id)
                        }}
                        size="small"
                        sx={{
                          color: 'rgba(255,255,255,0.6)',
                          '&:hover': {
                            color: 'primary.main',
                            bgcolor: 'rgba(233, 104, 12, 0.1)'
                          }
                        }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </motion.div>
      )}
    </Box>
  )
}

export default SessionList
