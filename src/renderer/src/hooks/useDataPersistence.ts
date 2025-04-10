import { useState, useEffect, useCallback } from 'react'

export interface Resume {
  id: string
  name: string
  file?: File
  fileName?: string
  fileType?: string
  filePath?: string
  dateAdded?: string
  resumeContent?: string
}

export interface Session {
  id: string
  name: string
  date: string
  jobDescription: string
  resumeId?: string
  resumeName?: string
  resumeContent?: string
  mode?: 'fast' | 'balanced' | 'max'
  additionalInfo?: string
}

export interface DataPersistence {
  sessions: Session[]
  resumes: Resume[]
  loadingSessions: boolean
  loadingResumes: boolean
  loadSessionsError: Error | null
  loadResumesError: Error | null
  addSession: (session: Omit<Session, 'id' | 'date'>) => Promise<Session>
  updateSession: (id: string, data: Partial<Session>) => Promise<void>
  deleteSession: (id: string) => Promise<void>
  addResume: (name: string, file: File) => Promise<Resume>
  deleteResume: (id: string) => Promise<void>
}

export function useDataPersistence(): DataPersistence {
  const [sessions, setSessions] = useState<Session[]>([])
  const [resumes, setResumes] = useState<Resume[]>([])
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [loadingResumes, setLoadingResumes] = useState(true)
  const [loadSessionsError, setLoadSessionsError] = useState<Error | null>(null)
  const [loadResumesError, setLoadResumesError] = useState<Error | null>(null)

  // Load sessions
  const loadSessions = useCallback(async () => {
    try {
      setLoadingSessions(true)
      const data = await window.api.getSessions()
      setSessions(data)
      setLoadSessionsError(null)
    } catch (error) {
      console.error('Failed to load sessions:', error)
      setLoadSessionsError(error instanceof Error ? error : new Error('Failed to load sessions'))
    } finally {
      setLoadingSessions(false)
    }
  }, [])

  // Load resumes
  const loadResumes = useCallback(async () => {
    try {
      setLoadingResumes(true)
      const data = await window.api.getResumes()
      setResumes(data)
      setLoadResumesError(null)
    } catch (error) {
      console.error('Failed to load resumes:', error)
      setLoadResumesError(error instanceof Error ? error : new Error('Failed to load resumes'))
    } finally {
      setLoadingResumes(false)
    }
  }, [])

  // Save sessions
  const saveSessions = useCallback(async (updatedSessions: Session[]) => {
    try {
      await window.api.saveSessions(updatedSessions)
      setSessions(updatedSessions)
    } catch (error) {
      console.error('Failed to save sessions:', error)
      throw error
    }
  }, [])

  // Save resumes
  const saveResumes = useCallback(async (updatedResumes: Resume[]) => {
    try {
      await window.api.saveResumes(updatedResumes)
      setResumes(updatedResumes)
    } catch (error) {
      console.error('Failed to save resumes:', error)
      throw error
    }
  }, [])

  // Add session
  const addSession = useCallback(
    async (sessionData: Omit<Session, 'id' | 'date'>): Promise<Session> => {
      const newSession: Session = {
        ...sessionData,
        id: `session_${Date.now()}`,
        date: new Date().toISOString()
      }

      const updatedSessions = [...sessions, newSession]
      await saveSessions(updatedSessions)
      return newSession
    },
    [sessions, saveSessions]
  )

  // Update session
  const updateSession = useCallback(
    async (id: string, data: Partial<Session>): Promise<void> => {
      const updatedSessions = sessions.map((session) =>
        session.id === id ? { ...session, ...data } : session
      )
      await saveSessions(updatedSessions)
    },
    [sessions, saveSessions]
  )

  // Delete session
  const deleteSession = useCallback(
    async (id: string): Promise<void> => {
      const updatedSessions = sessions.filter((session) => session.id !== id)
      await saveSessions(updatedSessions)
    },
    [sessions, saveSessions]
  )

  // Add resume
  const addResume = useCallback(
    async (name: string, file: File): Promise<Resume> => {
      try {
        const id = `resume_${Date.now()}`
        const fileExtension = `.${file.name.split('.').pop() || ''}`

        // Convert file to array buffer
        const arrayBuffer = await file.arrayBuffer()

        // Save file to disk
        const filePath = await window.api.saveResumeFile(id, arrayBuffer, fileExtension)

        // Read the file content
        const fileContent = await window.api.readResumeFile(filePath)

        // Create resume metadata
        const newResume: Resume = {
          id,
          name,
          fileName: file.name,
          fileType: file.type,
          filePath,
          dateAdded: new Date().toISOString(),
          resumeContent: fileContent
        }

        const updatedResumes = [...resumes, newResume]
        await saveResumes(updatedResumes)

        return newResume
      } catch (error) {
        console.error('Failed to add resume:', error)
        throw error
      }
    },
    [resumes, saveResumes]
  )

  // Delete resume
  const deleteResume = useCallback(
    async (id: string): Promise<void> => {
      const resumeToDelete = resumes.find((resume) => resume.id === id)

      if (resumeToDelete && resumeToDelete.filePath) {
        // Delete file from disk
        await window.api.deleteResume(resumeToDelete.filePath)

        // Update state
        const updatedResumes = resumes.filter((resume) => resume.id !== id)
        await saveResumes(updatedResumes)
      }
    },
    [resumes, saveResumes]
  )

  // Load data on mount
  useEffect(() => {
    loadSessions()
    loadResumes()
  }, [loadSessions, loadResumes])

  return {
    sessions,
    resumes,
    loadingSessions,
    loadingResumes,
    loadSessionsError,
    loadResumesError,
    addSession,
    updateSession,
    deleteSession,
    addResume,
    deleteResume
  }
}
