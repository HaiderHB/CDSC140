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
import { LoginPage } from './components/LoginPage'
import { authService } from './services/authService'
import NotSubscribedPage from './components/NotSubscribedPage'
import { checkSubscriptionStatus } from './utils/checkSubscription'

type ReadingMode = 'normal' | 'rapid' | 'spritz'

const TEST_MODE = process.env.DEV_MODE === 'true'

const test_bullet_points = [
  'The most undetectable AI interview assistant.',
  "Displays answers in a subtle eye contact box—impossible to tell you're reading.",
  'Invisible on screen share with lightning-fast responses.',
  'Auto speech recognition updates bullet points in real time.',
  'Speak naturally—no clicks, no hands.',
  'Never freeze on a question again.'
]

function App(): JSX.Element {
  const [error, setError] = useState<string | null>(null)
  const [isClickThrough, setIsClickThrough] = useState(false)
  const [readingMode, setReadingMode] = useState<ReadingMode>('normal')
  const [showReadingModeModal, setShowReadingModeModal] = useState(false)
  const [selectedMic, setSelectedMic] = useState<string>('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState<boolean | null>(null)

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
    handleLoadSession: navHandleLoadSession,
    handleSaveConfig
    // @ts-ignore
  } = useAppNavigation({ addSession, resumes, sessions })

  const {
    desktopAudioStatus,
    micAudioStatus,
    canvasRef,
    micCanvasRef,
    startCapture: hookStartCapture,
    stopCapture: hookStopCapture,
    isCapturing
  } = useAudioCapture(selectedMic)

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
    stopCapture: hookStopCapture,
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

  useEffect(() => {
    // Listen for auth callback
    // @ts-ignore
    window.api.onAuthCallback((url) => {
      console.log('Auth callback received:', url)
      const success = authService.handleAuthCallback(url)
      if (success) {
        setIsAuthenticated(true)
      }
    })
  }, [])

  useEffect(() => {
    // On app mount, check if user is already authenticated
    const authState = authService.getAuthState()
    if (authState.isAuthenticated) {
      setIsAuthenticated(true)
    }
  }, [])

  // Subscription check after login
  useEffect(() => {
    const checkSub = async () => {
      const authState = authService.getAuthState()
      if (authState.isAuthenticated && authState.userId) {
        const result = await checkSubscriptionStatus(authState.userId)
        setIsSubscribed(result)
      }
    }
    if (isAuthenticated) {
      checkSub()
    }
  }, [isAuthenticated])

  // Reload subscription status
  const handleReloadSubscription = async () => {
    const authState = authService.getAuthState()
    if (authState.isAuthenticated && authState.userId) {
      // setIsSubscribed(null)
      const result = await checkSubscriptionStatus(authState.userId)
      setIsSubscribed(result)
    }
  }

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
      setError(`Failed to Start Assistance: ${error?.message || 'Unknown error'}`)
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

  const handleLogout = () => {
    authService.logout()
    setIsAuthenticated(false)
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
      {/* Top bar */}
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
          sx={{ color: isClickThrough ? 'transparent' : 'white', opacity: 0.8, marginTop: '8px' }}
        >
          Interview Speaker
        </Typography>
        <Box sx={{ display: 'flex', WebkitAppRegion: 'no-drag', marginTop: '4px' }}>
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
            {isMac ? '🔴' : '✕'}
          </IconButton>
        </Box>
      </Box>

      {/* Commands */}
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

      {isAuthenticated ? (
        isSubscribed === false ? (
          <NotSubscribedPage onReload={handleReloadSubscription} onLogout={handleLogout} />
        ) : (
          <Box>
            {(loadingSessions || loadingResumes || isSubscribed === null) && (
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
                onNewSession={async () => {
                  // Check subscription before allowing session start
                  const authState = authService.getAuthState()
                  if (authState.isAuthenticated && authState.userId) {
                    const result = await checkSubscriptionStatus(authState.userId)
                    if (result) {
                      setCurrentPage('setup')
                    } else {
                      setIsSubscribed(false)
                    }
                  }
                }}
                onSelectSession={navHandleLoadSession}
                onDeleteSession={handleDeleteSessionWrapper}
                resumes={resumes}
                onAddResume={handleAddResumeWrapper}
                onDeleteResume={handleDeleteResumeWrapper}
                onLogout={handleLogout}
              />
            )}

            {currentPage === 'setup' && isSubscribed && (
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
                onMicSelected={setSelectedMic}
                selectedMic={selectedMic}
                onNotSubscribed={() => setIsSubscribed(false)}
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
        )
      ) : (
        <LoginPage />
      )}

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
