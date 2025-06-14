import React from 'react'
import {
  Modal,
  Box,
  Typography,
  FormControl,
  RadioGroup,
  Grid,
  FormControlLabel,
  Radio,
  Button
} from '@mui/material'
import { EyeContactBox } from './EyeContactBox' // Assuming EyeContactBox is in the same directory

// Define ReadingMode type here or import from a shared location
type ReadingMode = 'normal' | 'rapid' | 'spritz'

// Define the constant object for texts
const readingModeTexts = {
  normal: {
    description: 'Plain text with no enhancements.',
    example:
      'One of my biggest strengths is my ability to read quick and understand information quickly.'
  },
  rapid: {
    description:
      'Bolds the start of each word to guide your eyes. Increases reading speed by 200%.',
    example:
      'One of my biggest strengths is my ability to read quick and understand information quickly.'
  },
  spritz: {
    description:
      'Focus on the red letter. Displays one word at a time with a fixed focus. Increases reading speed by 400%.',
    example:
      'One of my biggest strengths is my ability to read quick and understand information quickly.'
  }
}

interface ReadingModeModalProps {
  open: boolean
  onClose: () => void
  value: ReadingMode
  onChange: (event: React.ChangeEvent<HTMLInputElement>, value: string) => void
}

export const ReadingModeModal: React.FC<ReadingModeModalProps> = ({
  open,
  onClose,
  value,
  onChange
}) => {
  return (
    <Modal
      open={open}
      onClose={onClose}
      aria-labelledby="reading-mode-modal"
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <Box
        sx={{
          bgcolor: 'background.paper',
          borderRadius: 2,
          p: 4,
          maxWidth: 900,
          width: '90%',
          maxHeight: '90vh',
          overflow: 'auto'
        }}
      >
        <Typography variant="h6" sx={{ mb: 3 }}>
          Speed Reading Mode
        </Typography>

        <FormControl component="fieldset" sx={{ width: '100%' }}>
          Different modes to help you read faster.
          <RadioGroup row value={value} onChange={onChange} sx={{ width: '100%', mt: 2 }}>
            <Grid
              container
              spacing={1}
              direction="row"
              justifyContent="space-between"
              wrap="nowrap"
            >
              {['normal', 'rapid', 'spritz'].map((mode) => (
                // @ts-ignore
                <Grid
                  key={mode}
                  item
                  xs={4}
                  ml={mode === 'rapid' ? 0 : 0}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center'
                  }}
                >
                  <FormControlLabel
                    value={mode}
                    control={<Radio />}
                    label={
                      mode === 'normal'
                        ? 'Normal'
                        : mode === 'rapid'
                          ? 'Rapid Read'
                          : 'Spritz Reading'
                    }
                  />
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      minHeight: '170px', // Add fixed minimum height to change eye contact box height
                      justifyContent: 'flex-start' // Align items to the start
                    }}
                  >
                    <EyeContactBox
                      text={readingModeTexts[mode].example}
                      mode={mode as ReadingMode}
                      width="80%"
                      spritzSize={1.4}
                    />
                    <Typography
                      variant="body2"
                      sx={{
                        mt: 1,
                        textAlign: 'center',
                        color: 'text.secondary',
                        width: '100%' // Ensure full width
                      }}
                    >
                      {readingModeTexts[mode].description}
                    </Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </RadioGroup>
        </FormControl>

        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
          <Button onClick={onClose} variant="contained">
            Close
          </Button>
        </Box>
      </Box>
    </Modal>
  )
}
