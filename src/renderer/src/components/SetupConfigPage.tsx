import React, { useState } from 'react'
import {
  Box,
  Typography,
  Button,
  TextField,
  MenuItem,
  Card,
  CardContent,
  FormControlLabel,
  Modal,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Checkbox,
  Stack
} from '@mui/material'
import { Resume } from './ResumeManager'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { List, ListItem, ListItemText } from '@mui/material'
import { AssistanceModePreviewModal } from './AssistanceModeModal'
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
      <Typography variant="h6" mb={2}>
        Add New Resume
      </Typography>
      <TextField
        label="Resume Name"
        value={resumeName}
        onChange={(e) => setResumeName(e.target.value)}
        fullWidth
        sx={{ mb: 2 }}
      />
      <Button
        variant="outlined"
        component="label"
        fullWidth
        sx={{
          mb: 2,
          borderColor: 'rgba(255, 255, 255, 0.2)',
          color: 'text.primary'
        }}
      >
        Upload Resume File
        <input type="file" hidden onChange={handleFileChange} accept=".pdf,.doc,.docx" />
      </Button>
      {resumeFile && (
        <Typography variant="body2" sx={{ mb: 2 }}>
          Selected: {resumeFile.name}
        </Typography>
      )}
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
  onSave: (config: {
    sessionName?: string
    jobDescription: string
    selectedResume: string
    additionalInfo: string
    mode: 'fast' | 'balanced' | 'max'
  }) => void
  resumes: Resume[]
  onAddResume: () => void
  onBack: () => void
  skipEmptySessionWarning?: boolean
  onSetSkipEmptySessionWarning?: (skip: boolean) => void
}

function SetupConfigPage({
  onSave,
  resumes,
  onAddResume,
  onBack,
  skipEmptySessionWarning,
  onSetSkipEmptySessionWarning
}: SetupConfigProps) {
  const [sessionName, setSessionName] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [selectedResume, setSelectedResume] = useState('')
  const [isAddResumeModalOpen, setIsAddResumeModalOpen] = useState(false)
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false)
  const [dontShowAgain, setDontShowAgain] = useState(skipEmptySessionWarning)
  const [additionalInfo, setAdditionalInfo] = useState('')
  const [selectedMode, setSelectedMode] = useState<'fast' | 'balanced' | 'max'>('balanced')
  const [isExampleModalOpen, setIsExampleModalOpen] = useState(false)
  const modeOptions = [
    {
      key: 'fast',
      title: 'Fast',
      points: [
        'Short and efficient bullet points for quick recall.',
        'Best if you already know the material and just need light guidance to stay on track.'
      ]
    },
    {
      key: 'balanced',
      title: 'Balanced',
      points: [
        'Moderately detailed responses with a balance of brevity and depth.',
        'Ideal if you somewhat understand most concepts but want some clarification or structure.'
      ]
    },
    {
      key: 'max',
      title: 'Max',
      points: [
        'Longer and detailed explanations that cover concepts in depth.',
        'Great if you’re unsure of the material and want help crafting strong answers from scratch.'
      ]
    }
  ]

  const handleSave = () => {
    const isEmpty = !jobDescription || !selectedResume
    if (isEmpty && !skipEmptySessionWarning) {
      setIsConfirmDialogOpen(true)
    } else {
      onSave({ sessionName, jobDescription, selectedResume, additionalInfo, mode: selectedMode })
    }
  }

  const handleConfirmSave = () => {
    if (dontShowAgain && onSetSkipEmptySessionWarning) {
      onSetSkipEmptySessionWarning(true)
    }
    setIsConfirmDialogOpen(false)
    onSave({ sessionName, jobDescription, selectedResume, additionalInfo, mode: selectedMode })
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

  const handleSaveNewResume = async () => {
    try {
      await onAddResume()
      setIsAddResumeModalOpen(false)
    } catch (error) {
      console.error('Error saving resume from modal:', error)
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
    <Box
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1,
        overflow: 'auto'
      }}
    >
      <Box
        onClick={onBack}
        sx={{
          display: 'flex',
          alignItems: 'center',
          p: 2,
          pt: 8,
          cursor: 'pointer',
          color: 'text.secondary',
          '&:hover': { color: 'primary.main' },
          backdropFilter: 'blur(8px)',
          backgroundColor: 'rgba(21, 21, 21, 0.7)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
        }}
      >
        <ArrowBackIcon fontSize="small" sx={{ mr: 1 }} />
        <Typography variant="body2">Back to Home</Typography>
      </Box>

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Card
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            backgroundImage:
              'linear-gradient(to bottom right, rgba(37, 37, 37, 0.8), rgba(21, 21, 21, 0.9))',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: 'none',
            borderRadius: 0
          }}
        >
          <CardContent
            sx={{
              p: 3,
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'auto'
            }}
          >
            <Typography
              variant="h5"
              component="h1"
              sx={{
                mb: 0,
                fontWeight: 600,
                background: 'linear-gradient(to right, #E9680C, #FF8534)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}
            >
              Setup New Session
            </Typography>
            <Typography
              component="h3"
              sx={{
                mb: 3,
                fontWeight: 400,
                fontSize: '0.875rem',
                mt: 1,
                background: 'white',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}
            >
              Optional. Helps AI give better responses.
            </Typography>

            <Stack spacing={3}>
              <Box>
                <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 500 }}>
                  Session Name
                </Typography>
                <TextField
                  fullWidth
                  placeholder="Enter a name for this session"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  variant="outlined"
                  size="small"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 1.5
                    }
                  }}
                />
              </Box>

              <Box>
                <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 500 }}>
                  Assistance Mode
                </Typography>
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'row',
                    gap: 2,
                    flexWrap: 'wrap'
                  }}
                >
                  {modeOptions.map((mode) => (
                    <Card
                      key={mode.key}
                      onClick={() => setSelectedMode(mode.key as 'fast' | 'balanced' | 'max')}
                      sx={{
                        cursor: 'pointer',
                        flex: 1,
                        minWidth: 180,
                        border:
                          selectedMode === mode.key
                            ? '2px solid #FF8534'
                            : '1px solid rgba(255, 255, 255, 0.08)',
                        background:
                          selectedMode === mode.key
                            ? 'linear-gradient(to bottom right, rgba(255, 133, 52, 0.1), rgba(255, 133, 52, 0.05))'
                            : 'rgba(255, 255, 255, 0.02)',
                        transition: 'border 0.3s ease, background 0.3s ease',
                        borderRadius: 2,
                        '&:hover': {
                          border: '2px solid #FF8534',
                          background: 'rgba(255, 133, 52, 0.05)'
                        }
                      }}
                    >
                      <CardContent sx={{ p: 2 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                          {mode.title}
                        </Typography>
                        <List dense sx={{ pl: 2, pt: 0 }}>
                          {mode.points.map((point, index) => (
                            <ListItem key={index} disableGutters sx={{ py: 0.5 }}>
                              <ListItemText
                                primaryTypographyProps={{
                                  variant: 'body2',
                                  color: 'text.secondary'
                                }}
                                primary={`• ${point}`}
                              />
                            </ListItem>
                          ))}
                        </List>
                      </CardContent>
                    </Card>
                  ))}
                </Box>

                <Button
                  variant="outlinedSecondary"
                  sx={{ color: 'text.secondary', mt: 1 }}
                  onClick={() => setIsExampleModalOpen(true)}
                >
                  See Example
                </Button>
              </Box>

              {isExampleModalOpen && (
                <AssistanceModePreviewModal
                  open={isExampleModalOpen}
                  onClose={() => setIsExampleModalOpen(false)}
                />
              )}

              <Box>
                <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 500 }}>
                  Job Description
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={5}
                  placeholder="Paste the job description here"
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  variant="outlined"
                  size="small"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 1.5
                    }
                  }}
                />
              </Box>

              <Box>
                <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 500 }}>
                  Select Resume
                </Typography>
                <TextField
                  select
                  fullWidth
                  value={selectedResume}
                  onChange={handleResumeSelectionChange}
                  variant="outlined"
                  size="small"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 1.5
                    },
                    mb: 2
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
                      fontWeight: 500
                    }}
                  >
                    + Add New Resume
                  </MenuItem>
                </TextField>

                <Typography variant="body2" color="text.secondary">
                  Your resume will be used to tailor interview responses to your experience and
                  qualifications.
                </Typography>
              </Box>

              <Box>
                <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 500 }}>
                  Additional Instructions
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  placeholder="Enter any additional instructions for the AI here"
                  value={additionalInfo}
                  onChange={(e) => setAdditionalInfo(e.target.value)}
                  variant="outlined"
                  size="small"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 1.5
                    }
                  }}
                />
              </Box>
            </Stack>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
              <Button
                variant="contained"
                onClick={handleSave}
                sx={{
                  px: 3,
                  py: 1,
                  backgroundImage: 'linear-gradient(to right, #C45400, #E9680C)',
                  boxShadow: '0 4px 14px rgba(233, 104, 12, 0.4)',
                  fontWeight: 600,
                  '&:hover': {
                    backgroundImage: 'linear-gradient(to right, #B34800, #D05800)',
                    boxShadow: '0 6px 20px rgba(233, 104, 12, 0.6)'
                  }
                }}
              >
                Create Session
              </Button>
            </Box>
          </CardContent>
        </Card>
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
            backgroundImage:
              'linear-gradient(to bottom right, rgba(37, 37, 37, 0.8), rgba(21, 21, 21, 0.9))',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
            borderRadius: 2
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
        PaperProps={{
          sx: {
            backgroundImage:
              'linear-gradient(to bottom right, rgba(37, 37, 37, 0.8), rgba(21, 21, 21, 0.9))',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
          }
        }}
      >
        <DialogTitle id="confirm-dialog-title">Create Session Without Full Details?</DialogTitle>
        <DialogContent>
          <DialogContentText id="confirm-dialog-description">
            You haven't provided a job description or selected a resume. Adding these details will
            provide better assistance during your interview.
            <br />
            <br />
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
          <Button
            onClick={handleConfirmSave}
            autoFocus
            variant="contained"
            sx={{
              backgroundImage: 'linear-gradient(to right, #C45400, #E9680C)'
            }}
          >
            Proceed Anyway
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default SetupConfigPage
