import React from 'react'
import { Box, Button, Collapse, List, ListItem, ListItemText, Paper } from '@mui/material'
import { motion, AnimatePresence } from 'framer-motion'
import { EyeContactBox } from './EyeContactBox'
import { Key } from './Key'

// Define ReadingMode type here or import from a shared location
type ReadingMode = 'normal' | 'rapid' | 'spritz'

interface ResponseOutputProps {
  isCapturing: boolean
  bulletPoints: string[]
  currentBulletPoint: string
  readingMode: ReadingMode
  commandKey: string
  onShowReadingModeModal: () => void
  handleManualDeleteEyeContact: () => void
  handleRestoreLastDeleted: () => void
}

export const ResponseOutput: React.FC<ResponseOutputProps> = ({
  isCapturing,
  bulletPoints,
  currentBulletPoint,
  readingMode,
  commandKey,
  onShowReadingModeModal,
  handleManualDeleteEyeContact,
  handleRestoreLastDeleted
}) => {
  return (
    <Box className="response-output" sx={{ mt: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button
          onClick={onShowReadingModeModal}
          variant="outlined"
          size="small"
          sx={{
            color: 'white',
            '&:hover': {
              bgcolor: 'rgba(16, 185, 129, 0.1)'
            }
          }}
        >
          Speed Reading
        </Button>
      </Box>

      {isCapturing ? (
        <EyeContactBox
          text={bulletPoints[0] || 'Waiting for next question...'}
          mode={readingMode}
          width="450px"
        />
      ) : (
        <div>
          <Box
            display="flex"
            justifyContent="center"
            alignItems="center"
            sx={{ width: '100%', height: '100%', marginBottom: '20px' }}
          >
            <Box display="flex" alignItems="center" gap={2}>
              <EyeContactBox
                text={
                  bulletPoints[0] ||
                  "Example text to minimise eye tracking. Click 'Start Capture' to begin session."
                }
                mode={readingMode}
                draggable={true}
                leftOffset={155}
                width="450px"
              />
              <Box
                display="flex"
                flexDirection="column"
                alignItems="flex-start"
                justifyContent="space-between"
              >
                <Box
                  sx={{
                    fontSize: '8px',
                    marginTop: '-10px',
                    marginBottom: '10px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  * Manual option — AI does this by automatically as you speak.
                </Box>
                <Paper
                  elevation={0}
                  onClick={handleManualDeleteEyeContact}
                  sx={{
                    cursor: 'pointer',
                    flexGrow: 1,
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    p: 0.5,
                    borderRadius: 1,
                    mb: 2,
                    backgroundImage:
                      'linear-gradient(to bottom right, rgba(37, 37, 37, 0.8), rgba(21, 21, 21, 0.9))',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                    transition: 'background-image 0.3s ease',
                    '&:hover': {
                      backgroundImage:
                        'linear-gradient(to bottom right, rgba(21, 21, 21, 0.9), rgba(37, 37, 37, 0.8))'
                    }
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    ↑ Skip Current - <Key>{commandKey}</Key> + <Key>M</Key>
                  </Box>
                </Paper>
                <Paper
                  elevation={0}
                  onClick={handleRestoreLastDeleted}
                  sx={{
                    cursor: 'pointer',
                    flexGrow: 1,
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    mt: 2,
                    p: 0.5,
                    borderRadius: 1,
                    backgroundImage:
                      'linear-gradient(to bottom right, rgba(37, 37, 37, 0.8), rgba(21, 21, 21, 0.9))',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                    transition: 'background-image 0.3s ease',
                    '&:hover': {
                      backgroundImage:
                        'linear-gradient(to bottom right, rgba(21, 21, 21, 0.9), rgba(37, 37, 37, 0.8))'
                    }
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    ↓ Restore Previous - <Key>{commandKey}</Key> + <Key>N</Key>
                  </Box>
                </Paper>
              </Box>
            </Box>
          </Box>
        </div>
      )}

      <List sx={{ py: 0 }}>
        {/* <Box sx={{ fontSize: '14px', marginBottom: '10px', fontWeight: 'bold' }}>Upcoming</Box> */}
        <AnimatePresence initial={false}>
          {bulletPoints.slice(1).map((point) => (
            <motion.div
              key={point}
              initial={{ opacity: 0, y: 20 }}
              animate={{
                opacity: 1,
                y: 0,
                transition: { duration: 0.3, ease: 'easeOut' }
              }}
              exit={{
                opacity: 0,
                y: -20,
                transition: { duration: 0.2, ease: 'easeIn' }
              }}
              layout
            >
              <ListItem
                disablePadding
                sx={{
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                  px: 2,
                  py: 1
                }}
              >
                <ListItemText primary={point} />
              </ListItem>
            </motion.div>
          ))}
          {currentBulletPoint && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 0.7, y: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <ListItem
                sx={{
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                  py: 1,
                  px: 2
                }}
              >
                <ListItemText primary={currentBulletPoint} sx={{ fontStyle: 'italic' }} />
              </ListItem>
            </motion.div>
          )}
        </AnimatePresence>
      </List>
    </Box>
  )
}
