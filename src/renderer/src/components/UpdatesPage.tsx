import React, { useEffect, useState } from 'react'
import { Box, Typography, Alert, Card, CardContent, Button } from '@mui/material'

const UpdatesPage: React.FC = () => {
  const [appInfo, setAppInfo] = useState<{ version: string; message?: string } | null>(null)
  const [currentVersion, setCurrentVersion] = useState<string>('1.0.0') // Replace with actual current version

  useEffect(() => {
    const fetchAppInfo = async () => {
      try {
        const response = await fetch('https://www.interviewspeaker.co/api/app-info')
        const data = await response.json()
        setAppInfo(data)
      } catch (error) {
        console.error('Failed to fetch app info:', error)
      }
    }

    fetchAppInfo()
  }, [])

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        App Updates
      </Typography>
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="h6">Current App Version</Typography>
            <Typography variant="body1">{currentVersion}</Typography>
          </CardContent>
        </Card>
        {appInfo && (
          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Typography variant="h6">Latest App Version</Typography>
              <Typography variant="body1">{appInfo.version}</Typography>
            </CardContent>
          </Card>
        )}
      </Box>
      {appInfo && currentVersion !== appInfo.version && (
        <Typography variant="body2" sx={{ mb: 2 }}>
          Update is available.{' '}
          <a
            href="https://interviewspeaker.co/account/download"
            target="_blank"
            style={{ color: '#1976d2', textDecoration: 'none' }}
          >
            Download Here
          </a>
        </Typography>
      )}
      {appInfo?.message && (
        <Alert severity="info" sx={{ mt: 2 }}>
          {appInfo.message}
        </Alert>
      )}
    </Box>
  )
}

export default UpdatesPage
