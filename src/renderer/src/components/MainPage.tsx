import React from 'react'
import { Box, Container, Tabs, Tab } from '@mui/material'
import SessionList from './SessionList'
import ResumeManager from './ResumeManager'
import Settings from './Settings'
import { Session, Resume } from '../hooks/useDataPersistence'
import UpdatesPage from './UpdatesPage'

interface MainPageProps {
  sessions: Session[]
  resumes: Resume[]
  homeTab: number
  onTabChange: (event: React.SyntheticEvent, newValue: number) => void
  onNewSession: () => void
  onSelectSession: (sessionId: string) => void
  onDeleteSession: (sessionId: string) => void
  onAddResume: (resume: { name: string; file: File }) => void
  onDeleteResume: (resumeId: string) => void
  onLogout: () => void
  onUpdates: () => void
}

export const MainPage: React.FC<MainPageProps> = ({
  sessions,
  resumes,
  homeTab,
  onTabChange,
  onNewSession,
  onSelectSession,
  onDeleteSession,
  onAddResume,
  onDeleteResume,
  onLogout,
  onUpdates
}) => {
  return (
    <Container maxWidth="lg">
      <Box
        sx={{
          py: 6,
          textAlign: 'center'
        }}
      >
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={homeTab} onChange={onTabChange} aria-label="main navigation tabs">
            <Tab label="Sessions" />
            <Tab label="Resumes" />
            <Tab label="Settings" />
            <Tab label="Updates" onClick={onUpdates} />
          </Tabs>
        </Box>

        {/* Sessions Tab */}
        {homeTab === 0 && (
          <SessionList
            sessions={sessions}
            onNewSession={onNewSession}
            onSelectSession={onSelectSession}
            onDeleteSession={onDeleteSession}
          />
        )}

        {/* Resumes Tab */}
        {homeTab === 1 && (
          <ResumeManager
            resumes={resumes}
            onAddResume={onAddResume}
            onDeleteResume={onDeleteResume}
          />
        )}

        {/* Settings Tab */}
        {homeTab === 2 && <Settings onLogout={onLogout} />}

        {/* Updates Tab */}
        {homeTab === 3 && <UpdatesPage />}
      </Box>
    </Container>
  )
}

export default MainPage
