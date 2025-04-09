import { useState } from 'react'

// Import Session type from useDataPersistence or define if not exported
// Assuming Session is defined elsewhere or we use CurrentSession structure
interface Session {
  id: string
  name: string
  date?: string
  jobDescription: string
  resumeId?: string
  resumeName?: string
  resumeContent?: string
}

// Define types
export interface CurrentSession {
  id: string
  name: string
  date?: string
  resumeId?: string
  resumeName?: string
  jobDescription: string
  resumeContent?: string
}

interface UseAppNavigationProps {
  addSession: (sessionData: {
    name: string
    jobDescription: string
    resumeId?: string
    resumeName?: string
    resumeContent?: string
  }) => Promise<CurrentSession> // Assuming addSession returns the structure needed for CurrentSession
  resumes: Array<{
    id: string
    name: string
    resumeContent?: string
  }>
  sessions: Session[] // Add sessions array to props
}

interface UseAppNavigationResult {
  currentPage: string
  homeTab: number
  currentSession: CurrentSession | null
  setCurrentPage: (page: string) => void
  setHomeTab: (tab: number) => void
  handleNewSession: () => void
  handleLoadSession: (sessionId: string) => void
  handleSaveConfig: (config: {
    sessionName?: string
    jobDescription: string
    selectedResume: string
  }) => Promise<void>
}

export const useAppNavigation = ({
  addSession,
  resumes,
  sessions // Destructure sessions from props
}: UseAppNavigationProps): UseAppNavigationResult => {
  const [currentPage, setCurrentPage] = useState('main')
  const [homeTab, setHomeTab] = useState(0)
  const [currentSession, setCurrentSession] = useState<CurrentSession | null>(null)

  const handleNewSession = () => {
    setCurrentPage('setup')
  }

  const handleLoadSession = (sessionId: string) => {
    // Find the session from the sessions array passed in props
    const session = sessions.find((s) => s.id === sessionId)
    if (session) {
      // Map the found session structure to the CurrentSession structure
      setCurrentSession({
        id: session.id,
        name: session.name,
        date: session.date, // Ensure date is included
        jobDescription: session.jobDescription, // Ensure jobDescription is included
        resumeId: session.resumeId,
        resumeName: session.resumeName,
        resumeContent: session.resumeContent
      })
      setCurrentPage('capture')
    } else {
      console.warn(`Session with ID ${sessionId} not found.`)
      // Optionally set an error state or keep the user on the current page
    }
  }

  const handleSaveConfig = async (config: {
    sessionName?: string
    jobDescription: string
    selectedResume: string
  }) => {
    // Find the selected resume
    const selectedResume = resumes.find((r) => r.id === config.selectedResume)

    // Create a new session using the addSession function passed in props
    const newSession = await addSession({
      name: config.sessionName || `Interview Session - ${new Date().toLocaleDateString()}`,
      jobDescription: config.jobDescription,
      resumeId: selectedResume?.id,
      resumeName: selectedResume?.name,
      resumeContent: selectedResume?.resumeContent
    })

    // Set the newly created session as the current session
    // Ensure the structure matches CurrentSession
    setCurrentSession({
      id: newSession.id,
      name: newSession.name,
      date: newSession.date,
      jobDescription: newSession.jobDescription,
      resumeId: newSession.resumeId,
      resumeName: newSession.resumeName,
      resumeContent: newSession.resumeContent
    })

    // Navigate to capture page
    setCurrentPage('capture')
  }

  return {
    currentPage,
    homeTab,
    currentSession,
    setCurrentPage,
    setHomeTab,
    handleNewSession,
    handleLoadSession,
    handleSaveConfig
  }
}
