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
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  Modal,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Checkbox
} from '@mui/material'
import { motion } from 'framer-motion'
import { Resume } from './ResumeManager'

interface AddResumeFormProps {
  onSave: (name: string, file: File) => void
  onCancel: () => void
}

function AddResumeForm({ onSave, onCancel }: AddResumeFormProps) {
  const [resumeName, setResumeName] = useState('')
  const [resumeFile, setResumeFile] = useState<File | null>(null)

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setResumeFile(event.target.files[0])
      if (!resumeName) {
        setResumeName(event.target.files[0].name.replace(/\.[^/.]+$/, ''))
      }
    }
  }

  const handleSubmit = () => {
    if (resumeName && resumeFile) {
      onSave(resumeName, resumeFile)
    }
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" mb={2}>Add New Resume</Typography>
      <TextField
        label="Resume Name"
        value={resumeName}
        onChange={(e) => setResumeName(e.target.value)}
        fullWidth
        sx={{ mb: 2 }}
      />
      <Button variant="contained" component="label" fullWidth sx={{ mb: 2 }}>
        Upload Resume File
        <input type="file" hidden onChange={handleFileChange} accept=".pdf,.doc,.docx" />
      </Button>
      {resumeFile && <Typography variant="body2" sx={{ mb: 2 }}>Selected: {resumeFile.name}</Typography>}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        <Button onClick={onCancel}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={!resumeName || !resumeFile}>
          Save Resume
        </Button>
      </Box>
    </Box>
  )
}

interface SetupConfigProps {
  onSave: (config: { jobDescription: string; selectedResume: string }) => void
  resumes: Resume[]
  onAddResume: (name: string, file: File) => Promise<void>
  onBack: () => void
  skipEmptySessionWarning: boolean
  onSetSkipEmptySessionWarning: (skip: boolean) => void
}

function SetupConfigPage({ 
  onSave, 
  resumes, 
  onAddResume, 
  onBack, 
  skipEmptySessionWarning, 
  onSetSkipEmptySessionWarning 
}: SetupConfigProps) {
  const [jobDescription, setJobDescription] = useState('')
  const [selectedResume, setSelectedResume] = useState('')
  const [isAddResumeModalOpen, setIsAddResumeModalOpen] = useState(false)
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false)
  const [dontShowAgain, setDontShowAgain] = useState(skipEmptySessionWarning)

  const handleSave = () => {
    const isEmpty = !jobDescription || !selectedResume
    if (isEmpty && !skipEmptySessionWarning) {
      setIsConfirmDialogOpen(true)
    } else {
      onSave({ jobDescription, selectedResume })
    }
  }

  const handleConfirmSave = () => {
    if (dontShowAgain) {
      onSetSkipEmptySessionWarning(true)
    }
    setIsConfirmDialogOpen(false)
    onSave({ jobDescription, selectedResume })
  }

  const handleCloseDialog = () => {
    setIsConfirmDialogOpen(false)
  }

  const handleAddNewResumeClick = () => {
    setIsAddResumeModalOpen(true)
  }

  const handleCloseAddResumeModal = () => {
    setIsAddResumeModalOpen(false)
  }

  const handleSaveNewResume = async (name: string, file: File) => {
    try {
      await onAddResume(name, file)
      setIsAddResumeModalOpen(false)
    } catch (error) {
      console.error("Error saving resume from modal:", error)
    }
  }

  const handleResumeSelectionChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    const value = event.target.value as string
    if (value === 'add_new') {
      handleAddNewResumeClick()
    } else {
      setSelectedResume(value)
    }
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
                  onChange={handleResumeSelectionChange}
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
                  sx={{ px: 4, py: 1.2 }}
                >
                  Create Session
                </Button>
              </Box>
            </CardContent>
          </Card>
        </motion.div>
      </Box>

      <Modal
        open={isAddResumeModalOpen}
        onClose={handleCloseAddResumeModal}
        aria-labelledby="add-resume-modal-title"
      >
        <Paper
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 400,
            bgcolor: 'background.paper',
            boxShadow: 24,
            borderRadius: 2,
          }}
        >
          <AddResumeForm onSave={handleSaveNewResume} onCancel={handleCloseAddResumeModal} />
        </Paper>
      </Modal>

      <Dialog
        open={isConfirmDialogOpen}
        onClose={handleCloseDialog}
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
      >
        <DialogTitle id="confirm-dialog-title">
          Create Session Without Full Details?
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="confirm-dialog-description">
            You haven't provided a job description or selected a resume. Adding these details will provide better assistance during your interview.
            <br /><br />
            Are you sure you want to proceed?
          </DialogContentText>
          <FormControlLabel
            control={
              <Checkbox 
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)} 
              />
            }
            label="Don't show this warning again"
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleConfirmSave} autoFocus variant="contained">
            Proceed Anyway
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}

export default SetupConfigPage
