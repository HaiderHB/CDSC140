import { useEffect, useState } from 'react'
import { Box, CircularProgress, IconButton, Snackbar, Alert, Typography } from '@mui/material'
import './App.css'
import SetupConfigPage from './components/SetupConfigPage'
import { useDataPersistence } from './hooks/useDataPersistence'
import { useSpeechRecognition } from './hooks/useSpeechRecognition'
import { Key } from './components/Key' // Import the Key component
import { ReadingModeModal } from './components/ReadingModeModal' // Import ReadingModeModal
import { useAppNavigation } from './hooks/useAppNavigation'
import { useAudioCapture } from './hooks/useAudioCapture'
import { useTranscriptionService } from './hooks/useTranscriptionService'
import { useWebRTC } from './hooks/useWebRTC'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import MainPage from './components/MainPage'
import CapturePage from './components/CapturePage'

type ReadingMode = 'normal' | 'rapid' | 'spritz'

const TEST_MODE = true

const test_bullet_points = [
  'javascript is a langauge to make web pages alive',
  'Lamda functions are used in AWS',
  'React is a library to make web pages alive',
  'Node.js is a runtime to run javascript outside the browser'
]

function App(): JSX.Element {
  const [error, setError] = useState<string | null>(null)
  const [isClickThrough, setIsClickThrough] = useState(false)
  const [readingMode, setReadingMode] = useState<ReadingMode>('normal')
  const [showReadingModeModal, setShowReadingModeModal] = useState(false)

  const {
    sessions,
    resumes,
    loadingSessions,
    loadingResumes,
    loadSessionsError,
    loadResumesError,
    addSession,
    deleteSession,
    addResume,
    deleteResume
  } = useDataPersistence()

  const {
    currentPage,
    homeTab,
    currentSession,
    setCurrentPage,
    setHomeTab,
    handleNewSession,
    handleLoadSession: navHandleLoadSession,
    handleSaveConfig
    // @ts-ignore
  } = useAppNavigation({ addSession, resumes, sessions })

  const {
    desktopAudioStatus,
    micAudioStatus,
    startCapture: hookStartCapture,
    stopCapture: hookStopCapture,
    isCapturing,
    canvasRef,
    micCanvasRef
  } = useAudioCapture()

  const {
    responseText,
    bulletPoints,
    currentBulletPoint,
    connectToOpenAI,
    handleManualDeleteEyeContact,
    handleRestoreLastDeleted,
    resetWebRTCState,
    findAndRemoveMatchingBulletPoint
  } = useWebRTC({
    currentSession,
    isCapturing,
    initialBulletPoints: TEST_MODE ? test_bullet_points : []
  })

  useKeyboardShortcuts({
    onManualDeleteEyeContact: handleManualDeleteEyeContact,
    onRestoreLastDeleted: handleRestoreLastDeleted,
    isActive: isCapturing
  })

  const {
    transcriptText,
    wsStatus,
    wsError,
    connectWebSocket,
    startRecording: startTranscriptionRecording,
    stopRecording: stopTranscriptionRecording
  } = useTranscriptionService({
    isCapturing,
    bulletPoints,
    onMatchFound: findAndRemoveMatchingBulletPoint
  })

  const { isListening } = useSpeechRecognition({
    onTranscript: (text) => {
      console.log('Local speech recognition transcript:', text)
    },
    bulletPoints,
    onMatchFound: findAndRemoveMatchingBulletPoint
  })

  // useEffect(() => {
  //   console.log('----currentSession', currentSession)
  // }, [currentSession])

  useEffect(() => {
    if (loadSessionsError) {
      setError(`Failed to load sessions: ${loadSessionsError.message}`)
    } else if (loadResumesError) {
      setError(`Failed to load resumes: ${loadResumesError.message}`)
    }
  }, [loadSessionsError, loadResumesError])

  useEffect(() => {
    const handleClickThroughToggle = (event: CustomEvent) => {
      setIsClickThrough(event.detail.enabled)
    }
    window.addEventListener('clickThroughToggled', handleClickThroughToggle as EventListener)
    return () => {
      window.removeEventListener('clickThroughToggled', handleClickThroughToggle as EventListener)
    }
  }, [])

  const startCombinedCapture = async () => {
    setError(null)
    try {
      const streams = await hookStartCapture()
      if (streams && streams.desktopStream) {
        if (!TEST_MODE) {
          await connectToOpenAI(streams.desktopStream)
        } else {
          console.log('TEST_MODE: Skipping OpenAI WebRTC connection')
        }

        connectWebSocket()

        startTranscriptionRecording()
      } else {
        throw new Error('Failed to get audio streams.')
      }
    } catch (error: any) {
      console.error('Error starting combined capture:', error)
      setError(`Failed to start capture: ${error?.message || 'Unknown error'}`)
      stopCombinedCapture()
    }
  }

  const stopCombinedCapture = () => {
    console.log('Stopping capture...')
    hookStopCapture()
    stopTranscriptionRecording()
    resetWebRTCState()
    console.log('Capture stopped.')
  }

  const handleAddResumeWrapper = async (resume: { name: string; file: File }) => {
    setError(null)
    try {
      await addResume(resume.name, resume.file)
      if (currentPage === 'setup') {
        setCurrentPage('main')
        setHomeTab(1)
      }
    } catch (error: any) {
      console.error('Error adding resume:', error)
      setError(`Failed to add resume: ${error.message || 'Please try again.'}`)
    }
  }

  const handleDeleteSessionWrapper = async (sessionId: string) => {
    setError(null)
    try {
      await deleteSession(sessionId)
    } catch (error: any) {
      console.error('Error deleting session:', error)
      setError(`Failed to delete session: ${error.message || 'Please try again.'}`)
    }
  }

  const handleDeleteResumeWrapper = async (resumeId: string) => {
    setError(null)
    try {
      await deleteResume(resumeId)
    } catch (error: any) {
      console.error('Error deleting resume:', error)
      setError(`Failed to delete resume: ${error.message || 'Please try again.'}`)
    }
  }

  const handleCloseError = () => {
    setError(null)
  }

  const handleCloseApp = () => {
    console.log('Attempting to close application...')
    if (isCapturing) {
      stopCombinedCapture()
    }
    setTimeout(() => {
      window.api.closeApp?.()
    }, 150)
  }

  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
  const commandKey = isMac ? '⌘' : 'Ctrl'

  return (
    <Box
      className="app-container"
      sx={{
        minHeight: '100vh',
        width: '100%',
        background: isClickThrough
          ? 'transparent'
          : 'linear-gradient(to bottom right, rgba(21, 21, 21, 0.4), rgba(37, 37, 37, 0.4))',
        backdropFilter: 'blur(2px)',
        p: 3,
        paddingTop: '62px'
      }}
    >
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          height: '28px',
          backgroundColor: isClickThrough ? 'transparent' : 'rgba(21, 21, 21, 1)',
          WebkitAppRegion: 'drag',
          zIndex: 9998,
          paddingX: 2
        }}
      >
        <Typography
          variant="subtitle2"
          sx={{ color: isClickThrough ? 'transparent' : 'white', opacity: 1 }}
        >
          Interview Speaker
        </Typography>
        <Box sx={{ display: 'flex', WebkitAppRegion: 'no-drag' }}>
          <IconButton
            onClick={handleCloseApp}
            size="small"
            sx={{
              color: isClickThrough ? 'transparent' : 'white',
              '&:hover': {
                color: 'red',
                backgroundColor: 'rgba(255,255,255,0.1)'
              }
            }}
          >
            ✕
          </IconButton>
        </Box>
      </Box>

      <Box
        sx={{
          position: 'fixed',
          top: 28,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          height: '34px',
          backgroundColor: 'rgba(21, 21, 21, 1)',
          color: '#909090',
          zIndex: 9999,
          fontSize: '12px',
          px: 4,
          pb: 1
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          Opacity – <Key>{commandKey}</Key> + <Key>&#91;</Key> <Key>&#93;</Key>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          Move – <Key>{commandKey}</Key> + <Key>←</Key> <Key>↑</Key> <Key>→</Key> <Key>↓</Key>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          Quit – <Key>{commandKey}</Key> + <Key>Q</Key>
        </Box>
      </Box>

      <Box>
        {(loadingSessions || loadingResumes) && (
          <Box
            sx={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'rgba(21, 21, 21, 0.3)',
              zIndex: 10000
            }}
          >
            <CircularProgress color="primary" size={60} />
          </Box>
        )}

        {currentPage === 'main' && (
          <MainPage
            homeTab={homeTab}
            onTabChange={(event, newValue) => setHomeTab(newValue)}
            sessions={sessions}
            onNewSession={handleNewSession}
            onSelectSession={navHandleLoadSession}
            onDeleteSession={handleDeleteSessionWrapper}
            resumes={resumes}
            onAddResume={handleAddResumeWrapper}
            onDeleteResume={handleDeleteResumeWrapper}
          />
        )}

        {currentPage === 'setup' && (
          <Box
            sx={{
              width: '100%',
              mx: 'auto',
              borderRadius: 2,
              overflow: 'hidden',
              boxShadow: '0 0 40px rgba(233, 104, 12, 0.2)'
            }}
          >
            <SetupConfigPage
              onSave={handleSaveConfig}
              resumes={resumes}
              onAddResume={() => {
                setCurrentPage('main')
                setHomeTab(1)
              }}
              onBack={() => setCurrentPage('main')}
            />
          </Box>
        )}

        {currentPage === 'capture' && currentSession && (
          <CapturePage
            isCapturing={isCapturing}
            startCapture={startCombinedCapture}
            stopCapture={stopCombinedCapture}
            bulletPoints={bulletPoints}
            readingMode={readingMode}
            onShowReadingModeModal={() => setShowReadingModeModal(true)}
            desktopAudioStatus={desktopAudioStatus}
            micAudioStatus={micAudioStatus}
            transcriptText={transcriptText}
            wsStatus={wsStatus}
            wsError={wsError}
            isListening={isListening}
            currentSession={currentSession}
            goBack={() => setCurrentPage('main')}
            responseText={responseText}
            desktopCanvasRef={canvasRef}
            micCanvasRef={micCanvasRef}
            currentBulletPoint={currentBulletPoint}
            handleManualDeleteEyeContact={handleManualDeleteEyeContact}
            handleRestoreLastDeleted={handleRestoreLastDeleted}
          />
        )}

        <Snackbar
          open={!!error}
          autoHideDuration={6000}
          onClose={handleCloseError}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <Alert onClose={handleCloseError} severity="error" sx={{ width: '100%' }}>
            {error}
          </Alert>
        </Snackbar>
      </Box>

      <ReadingModeModal
        open={showReadingModeModal}
        onClose={() => setShowReadingModeModal(false)}
        value={readingMode}
        onChange={(e) => setReadingMode(e.target.value as ReadingMode)}
      />
    </Box>
  )
}

export default App
