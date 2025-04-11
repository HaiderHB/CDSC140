import React from 'react'
import { Box, ListItemText, Typography } from '@mui/material'
import { motion, AnimatePresence } from 'framer-motion'
import { SpritzReader, RapidRead } from './SpeedReaders'
import { useState, useEffect } from 'react'

// Define ReadingMode type locally or import from a shared types file
type ReadingMode = 'normal' | 'rapid' | 'spritz'

interface EyeContactBoxProps {
  text: string
  mode?: ReadingMode
  width?: string
  mx?: string
  draggable?: boolean
  leftOffset?: number
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
  width = '250px',
  mx = 'auto',
  draggable = false,
  leftOffset = 0
}) => {
  const [boxWidth, setBoxWidth] = useState<string>(width)

  const handleMouseDown = (e: React.MouseEvent, isRightSide: boolean) => {
    if (!draggable) return

    const startX = e.clientX

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX
      const newWidth = isRightSide ? parseInt(boxWidth) + deltaX : parseInt(boxWidth) - deltaX
      setBoxWidth(`${newWidth}px`)
    }

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  useEffect(() => {
    // Ensure the box is centered with leftOffset
    if (mx === 'auto') {
      const boxElement = document.getElementById('eye-contact-box')
      if (boxElement) {
        boxElement.style.marginLeft = `calc((100% - ${boxWidth}) / 2 + ${leftOffset}px)`
      }
    }
  }, [boxWidth, mx, leftOffset])

  return (
    <Box
      id="eye-contact-box"
      component="fieldset"
      sx={{
        border: '2px solid #10b981',
        borderRadius: 2,
        width: boxWidth,
        mx: mx,
        textAlign: 'center',
        px: 2,
        pt: 1.5,
        pb: 1.5,
        bgcolor: 'rgba(16, 185, 129, 0.1)',
        position: 'relative'
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
      <div
        onMouseDown={(e) => handleMouseDown(e, false)}
        style={{
          cursor: draggable ? 'ew-resize' : 'default',
          position: 'absolute',
          left: 0,
          top: '50%',
          transform: 'translateY(-50%)',
          width: '10px',
          height: '100%',
          backgroundColor: 'transparent'
        }}
      />
      {draggable && (
        <>
          <div
            style={{
              position: 'absolute',
              left: '-7px',
              top: '50%',
              transform: 'translateY(-50%)',
              height: '30px',
              width: '1px',
              backgroundColor: '#10b981'
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: '-12px',
              top: '50%',
              transform: 'translateY(-50%)',
              height: '15px',
              width: '1px',
              backgroundColor: '#10b981'
            }}
          />
        </>
      )}
      <div
        onMouseDown={(e) => handleMouseDown(e, true)}
        style={{
          cursor: draggable ? 'ew-resize' : 'default',
          position: 'absolute',
          right: 0,
          top: '50%',
          transform: 'translateY(-50%)',
          width: '10px',
          height: '100%',
          backgroundColor: 'transparent'
        }}
      />
      {draggable && (
        <>
          <div
            style={{
              position: 'absolute',
              right: '-7px',
              top: '50%',
              transform: 'translateY(-50%)',
              height: '30px',
              width: '1px',
              backgroundColor: '#10b981'
            }}
          />
          <div
            style={{
              position: 'absolute',
              right: '-12px',
              top: '50%',
              transform: 'translateY(-50%)',
              height: '15px',
              width: '1px',
              backgroundColor: '#10b981'
            }}
          />
        </>
      )}
      <AnimatePresence mode="wait">
        {text && (
          <motion.div
            key={text}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            {mode === 'spritz' ? (
              <Box
                sx={{
                  position: 'relative',
                  height: '60px',
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
