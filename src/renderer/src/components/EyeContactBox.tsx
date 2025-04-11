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
  spritzSize?: number
}

export const EyeContactBox: React.FC<EyeContactBoxProps> = ({
  text,
  mode = 'normal',
  width = '450px',
  mx = 'auto',
  draggable = false,
  leftOffset = 0,
  spritzSize = 2
}) => {
  const [boxWidth, setBoxWidth] = useState<string>(width)
  const [boxId] = useState(() => `eye-contact-box-${Math.random().toString(36).substr(2, 9)}`)

  const formatText = (text: string, mode: ReadingMode): React.ReactNode => {
    if (!text) return ''
    switch (mode) {
      case 'rapid':
        return <RapidRead text={text} />
      case 'spritz':
        return <SpritzReader text={text} wpm={400} size={spritzSize} />
      default:
        return text
    }
  }

  // Update boxWidth when width prop changes
  useEffect(() => {
    if (width !== '100%') {
      setBoxWidth(width)
    }
  }, [width])

  useEffect(() => {
    if (mode === 'spritz' && width !== '80%') {
      setBoxWidth('570px')
    } else if (mode === 'spritz' && width === '80%') {
      setBoxWidth('220px')
    }
  }, [mode])

  const handleMouseDown = (e: React.MouseEvent, isRightSide: boolean) => {
    if (!draggable || mode === 'spritz') return

    const startX = e.clientX

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX
      const newWidth = isRightSide ? parseInt(boxWidth) + deltaX : parseInt(boxWidth) - deltaX
      if (newWidth < 410) {
        setBoxWidth(`410px`)
      } else if (newWidth > 1000) {
        setBoxWidth(`1000px`)
      } else {
        setBoxWidth(`${newWidth}px`)
      }
      console.log(newWidth)
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
      const boxElement = document.getElementById(boxId)
      if (boxElement) {
        boxElement.style.marginLeft = `calc((100% - ${boxWidth}) / 2 + ${leftOffset}px)`
      }
    }
  }, [boxWidth, mx, leftOffset, boxId])

  return (
    <Box
      id={boxId}
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
          cursor: draggable && mode !== 'spritz' ? 'ew-resize' : 'default',
          position: 'absolute',
          left: '-15px',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '30px',
          height: '100%',
          backgroundColor: 'transparent'
        }}
      />
      {draggable && mode !== 'spritz' && (
        <>
          <div
            style={{
              position: 'absolute',
              left: '-5px',
              top: '50%',
              transform: 'translateY(-50%)',
              height: '25px',
              width: '1px',
              backgroundColor: '#10b981',
              pointerEvents: 'none'
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: '-8px',
              top: '50%',
              transform: 'translateY(-50%)',
              height: '12px',
              width: '1px',
              backgroundColor: '#10b981',
              pointerEvents: 'none'
            }}
          />
        </>
      )}
      <div
        onMouseDown={(e) => handleMouseDown(e, true)}
        style={{
          cursor: draggable && mode !== 'spritz' ? 'ew-resize' : 'default',
          position: 'absolute',
          right: '-15px',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '30px',
          height: '100%',
          backgroundColor: 'transparent'
        }}
      />
      {draggable && mode !== 'spritz' && (
        <>
          <div
            style={{
              position: 'absolute',
              right: '-5px',
              top: '50%',
              transform: 'translateY(-50%)',
              height: '25px',
              width: '1px',
              backgroundColor: '#10b981',
              pointerEvents: 'none'
            }}
          />
          <div
            style={{
              position: 'absolute',
              right: '-8px',
              top: '50%',
              transform: 'translateY(-50%)',
              height: '12px',
              width: '1px',
              backgroundColor: '#10b981',
              pointerEvents: 'none'
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
                    position: 'relative'
                  }}
                >
                  <SpritzReader text={text} wpm={400} size={spritzSize} />
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
