import React from 'react'
import { Box, ListItemText, Typography } from '@mui/material'
import { motion, AnimatePresence } from 'framer-motion'
import { SpritzReader, RapidRead } from './SpeedReaders'

// Define ReadingMode type locally or import from a shared types file
type ReadingMode = 'normal' | 'rapid' | 'spritz'

interface EyeContactBoxProps {
  text: string
  mode?: ReadingMode
  width?: string
  mx?: string
}

const formatText = (text: string, mode: ReadingMode): React.ReactNode => {
  if (!text) return ''
  switch (mode) {
    case 'rapid':
      return <RapidRead text={text} />
    case 'spritz':
      return <SpritzReader text={text} wpm={400} />
    default:
      return text
  }
}

export const EyeContactBox: React.FC<EyeContactBoxProps> = ({
  text,
  mode = 'normal',
  width = '30%',
  mx = 'auto'
}) => {
  return (
    <Box
      component="fieldset"
      sx={{
        border: '2px solid #10b981',
        borderRadius: 2,
        width: width,
        mx: mx,
        ml: mx === '0' ? '32%' : 'auto',
        textAlign: 'center',
        px: 2,
        pt: 1.5,
        pb: 1.5,
        bgcolor: 'rgba(16, 185, 129, 0.1)'
      }}
    >
      <legend
        style={{
          marginRight: '0 auto',
          textAlign: 'center',
          padding: '0 8px',
          fontSize: '0.875rem',
          color: '#10b981',
          lineHeight: 1
        }}
      >
        Eye Contact
      </legend>
      <AnimatePresence mode="wait">
        {text && (
          <motion.div
            key={text} // Use text as key for animation trigger
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            {mode === 'spritz' ? (
              <Box
                sx={{
                  position: 'relative',
                  height: '60px', // Fixed height for Spritz
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Typography
                  variant="body1"
                  sx={{
                    position: 'relative',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      left: '50%',
                      top: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: '2px',
                      height: '1.2em',
                      backgroundColor: '#10b981',
                      opacity: 0.7
                      // Optional: Add animation if desired
                      // animation: 'focusPoint 2s ease-in-out infinite',
                    }
                  }}
                >
                  <SpritzReader text={text} wpm={400} />
                </Typography>
              </Box>
            ) : (
              <ListItemText primary={<div>{formatText(text, mode)}</div>} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  )
}
