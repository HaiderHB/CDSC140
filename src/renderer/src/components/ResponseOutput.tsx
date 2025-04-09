import React from 'react'
import { Box, Button, Collapse, List, ListItem, ListItemText } from '@mui/material'
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
  showCommands: boolean
  commandKey: string
  onShowReadingModeModal: () => void
}

export const ResponseOutput: React.FC<ResponseOutputProps> = ({
  isCapturing,
  bulletPoints,
  currentBulletPoint,
  readingMode,
  showCommands,
  commandKey,
  onShowReadingModeModal
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
        />
      ) : (
        <EyeContactBox
          text={
            bulletPoints[0] ||
            "Example text to minimise eye tracking. Click 'Start Capture' to begin session."
          }
          mode={readingMode}
        />
      )}

      {/* Commands */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          borderRadius: 1,
          color: 'text.secondary',
          bgcolor: 'rgba(255, 255, 255, 0.05)',
          mt: 2
        }}
      >
        <Collapse in={showCommands}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'row',
              gap: 1,
              p: 2,
              borderRadius: 1,
              justifyContent: 'space-around',
              fontSize: '14px'
            }}
          >
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'start', gap: 1 }}>
                Skip Current - <Key>{commandKey}</Key> + <Key>M</Key>
              </Box>
              <Box sx={{ fontSize: '9px', marginTop: '8px' }}>
                * Manual option — AI does this by automatically as you speak.
              </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'start', gap: 1 }}>
              Restore Previous - <Key>{commandKey}</Key> + <Key>N</Key>
            </Box>
          </Box>
        </Collapse>
      </Box>

      <List sx={{ py: 0 }}>
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
