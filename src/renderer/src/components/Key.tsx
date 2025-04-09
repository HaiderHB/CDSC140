import React from 'react'
import { Box } from '@mui/material'

export const Key = ({ children }: { children: React.ReactNode }) => (
  <Box
    component="span"
    sx={{
      display: 'inline-block',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      borderRadius: '4px',
      px: 0.8,
      py: 0.3,
      fontSize: '0.65rem',
      fontFamily: 'sans-serif',
      backgroundColor: 'rgba(255, 255, 255, 0.05)'
    }}
  >
    {children}
  </Box>
)
