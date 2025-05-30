import React from 'react'
import { Box, List, ListItem, ListItemText, Paper, Slider } from '@mui/material'
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
  handleManualDeleteEyeContact: () => void
  handleRestoreLastDeleted: () => void
}

export const ResponseOutput: React.FC<ResponseOutputProps> = ({
  isCapturing,
  bulletPoints,
  currentBulletPoint,
  readingMode,
  commandKey,
  handleManualDeleteEyeContact,
  handleRestoreLastDeleted
}) => {
  const [fontSize, setFontSize] = React.useState(() => {
    const savedFontSize = localStorage.getItem('fontSize')
    return savedFontSize ? parseInt(savedFontSize) : 16
  })

  const handleFontSizeChange = (event: Event, newValue: number | number[]) => {
    const value = newValue as number
    setFontSize(value)
    localStorage.setItem('fontSize', value.toString())
  }

  return (
    <Box className="response-output" sx={{ mt: 3 }}>
      <Box sx={{ width: '150px', mx: 'auto', mt: 2 }}>
        <Slider
          value={fontSize}
          min={6}
          max={30}
          step={1}
          onChange={handleFontSizeChange}
          valueLabelDisplay="auto"
          aria-labelledby="font-size-slider"
          sx={{
            height: 3, // 🔹 Thickness of the track
            '& .MuiSlider-thumb': {
              height: 12, // 🔹 Height of the dot
              width: 12, // 🔹 Width of the dot
              '&:hover, &.Mui-focusVisible, &.Mui-active': {
                boxShadow: '0px 0px 0px 8px rgba(16, 185, 129, 0.16)'
              }
            }
          }}
        />
      </Box>
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
                isCapturing
                  ? bulletPoints[0] || 'Waiting for next question...'
                  : bulletPoints[0] ||
                    'Adjust text size using the slider and box size using the edges. The smaller the reading area the less your eyes have to move to read.'
              }
              mode={readingMode}
              draggable={true}
              leftOffset={155}
              width="450px"
              fontSize={`${fontSize}px`}
            />
            <Box
              display="flex"
              flexDirection="column"
              alignItems="flex-start"
              justifyContent="space-between"
            >
              {/* <Box
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
              </Box> */}
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
                    overflow: 'visible',
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
                    overflow: 'visible',
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
