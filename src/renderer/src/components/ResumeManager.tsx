import React, { useState } from 'react'
import {
  Box,
  Typography,
  Button,
  TextField,
  Card,
  CardContent,
  Stack,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Divider,
  Chip,
  Paper
} from '@mui/material'
import { motion } from 'framer-motion'

// Define Resume interface from useDataPersistence
export interface Resume {
  id: string
  name: string
  file?: File
  fileName?: string
  fileType?: string
  filePath?: string
  dateAdded?: string
}

interface ResumeManagerProps {
  onAddResume: (resume: { name: string; file: File }) => void
  resumes: Resume[]
  onDeleteResume?: (id: string) => void
}

function ResumeManager({ onAddResume, resumes = [], onDeleteResume }: ResumeManagerProps) {
  const [resumeName, setResumeName] = useState('')
  const [resumeFile, setResumeFile] = useState<File | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      const file = files[0]
      if (
        file &&
        [
          'application/pdf',
          'application/msword',
          'text/plain',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ].includes(file.type)
      ) {
        setResumeFile(file)
      } else {
        alert('Please select a valid resume file (PDF, DOC, DOCX, TXT).')
      }
    }
  }

  const handleAddResume = () => {
    if (resumeName && resumeFile) {
      // Call the parent's onAddResume with name and file
      onAddResume({
        name: resumeName,
        file: resumeFile
      })

      // Reset form
      setResumeName('')
      setResumeFile(null)

      // Reset the file input
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      if (fileInput) {
        fileInput.value = ''
      }
    } else {
      alert('Please provide a name and select a file.')
    }
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" sx={{ mb: 3, fontWeight: 600 }}>
        Manage Resumes
      </Typography>

      <Card sx={{ mb: 4 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 3 }}>
            Add New Resume
          </Typography>

          <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              label="Resume Name"
              placeholder="Enter a name for this resume"
              value={resumeName}
              onChange={(e) => setResumeName(e.target.value)}
              fullWidth
              variant="outlined"
              size="medium"
            />

            <Box>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                onChange={handleFileChange}
                style={{ display: 'none' }}
                id="resume-file-input"
              />
              <label htmlFor="resume-file-input">
                <Button
                  component="span"
                  variant="outlined"
                  sx={{
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                    color: 'text.primary',
                    bgcolor: 'rgba(30, 41, 59, 0.4)'
                  }}
                >
                  Select File
                </Button>
                {resumeFile && <Chip label={resumeFile.name} size="small" sx={{ ml: 2 }} />}
              </label>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                onClick={handleAddResume}
                disabled={!resumeName || !resumeFile}
              >
                Add Resume
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Typography variant="h6" sx={{ mb: 2, mt: 4 }}>
        My Resumes
      </Typography>

      {resumes.length === 0 ? (
        <Box
          sx={{
            p: 4,
            textAlign: 'center',
            bgcolor: 'rgba(30, 41, 59, 0.4)',
            borderRadius: 2,
            border: '1px dashed rgba(255, 255, 255, 0.1)'
          }}
        >
          <Typography variant="body1" sx={{ color: 'text.secondary' }}>
            No resumes added yet. Add your first resume above.
          </Typography>
        </Box>
      ) : (
        <Stack spacing={2}>
          {resumes.map((resume, index) => (
            <motion.div
              key={resume.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: index * 0.05 }}
            >
              <Paper
                sx={{
                  p: 2,
                  bgcolor: 'rgba(30, 41, 59, 0.6)',
                  backdropFilter: 'blur(4px)',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    bgcolor: 'rgba(30, 41, 59, 0.8)'
                  }
                }}
              >
                <Box
                  sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                      {resume.name}
                    </Typography>
                    {resume.fileName && (
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {resume.fileName}
                      </Typography>
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {resume.fileType && (
                      <Chip
                        label={resume.fileType.split('/')[1]?.toUpperCase() || 'FILE'}
                        size="small"
                        sx={{
                          bgcolor: 'rgba(99, 102, 241, 0.2)',
                          color: 'primary.light'
                        }}
                      />
                    )}
                    {onDeleteResume && (
                      <IconButton
                        onClick={() => onDeleteResume(resume.id)}
                        size="small"
                        sx={{
                          color: 'rgba(255,255,255,0.6)',
                          '&:hover': {
                            color: '#ec4899',
                            bgcolor: 'rgba(236, 72, 153, 0.1)'
                          }
                        }}
                      >
                        <span>×</span>
                      </IconButton>
                    )}
                  </Box>
                </Box>
              </Paper>
            </motion.div>
          ))}
        </Stack>
      )}
    </Box>
  )
}

export default ResumeManager
