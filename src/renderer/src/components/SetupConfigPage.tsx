import React, { useState } from 'react'
import {
  Box,
  Typography,
  Button,
  TextField,
  MenuItem,
  Container,
  Card,
  CardContent,
  IconButton,
  InputAdornment
} from '@mui/material'
import { motion } from 'framer-motion'
import { Resume } from './ResumeManager'

interface SetupConfigProps {
  onSave: (config: { jobDescription: string; selectedResume: string }) => void
  resumes: Resume[]
  onAddResume: () => void
  onBack: () => void
}

function SetupConfigPage({ onSave, resumes, onAddResume, onBack }: SetupConfigProps) {
  const [jobDescription, setJobDescription] = useState('')
  const [selectedResume, setSelectedResume] = useState('')

  const handleSave = () => {
    onSave({ jobDescription, selectedResume })
  }

  const handleAddNewResume = () => {
    // Go back to home screen and switch to Resume tab
    onAddResume()
    onBack()
  }

  return (
    <Container maxWidth="md">
      <Box sx={{ py: 4 }}>
        <Box
          onClick={onBack}
          sx={{
            display: 'flex',
            alignItems: 'center',
            mb: 4,
            cursor: 'pointer',
            color: 'primary.main',
            '&:hover': { color: 'primary.light' }
          }}
        >
          <Typography variant="body1">← Back to Home</Typography>
        </Box>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card>
            <CardContent sx={{ p: 4 }}>
              <Typography
                variant="h4"
                component="h1"
                sx={{
                  mb: 4,
                  fontWeight: 600,
                  background: 'linear-gradient(to right, #6366f1, #818cf8)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}
              >
                Setup New Interview Session
              </Typography>

              <Box sx={{ mb: 4 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Job Description
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={6}
                  placeholder="Paste the job description here to help AI understand the position better"
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  variant="outlined"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2
                    }
                  }}
                />
              </Box>

              <Box sx={{ mb: 4 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Select Resume
                </Typography>
                <TextField
                  select
                  fullWidth
                  value={selectedResume}
                  onChange={(e) => setSelectedResume(e.target.value)}
                  variant="outlined"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2
                    }
                  }}
                >
                  <MenuItem value="">
                    <em>Select a resume</em>
                  </MenuItem>
                  {resumes.map((resume) => (
                    <MenuItem key={resume.id} value={resume.id}>
                      {resume.name}
                    </MenuItem>
                  ))}
                  <MenuItem
                    value="add_new"
                    onClick={handleAddNewResume}
                    sx={{
                      color: 'primary.main',
                      fontWeight: 600
                    }}
                  >
                    + Add New Resume
                  </MenuItem>
                </TextField>
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 6 }}>
                <Button
                  variant="contained"
                  onClick={handleSave}
                  size="large"
                  disabled={!jobDescription || !selectedResume}
                  sx={{ px: 4, py: 1.2 }}
                >
                  Create Session
                </Button>
              </Box>
            </CardContent>
          </Card>
        </motion.div>
      </Box>
    </Container>
  )
}

export default SetupConfigPage
