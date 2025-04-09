import { app } from 'electron'
import fs from 'fs'
import path from 'path'

// Define the user data directory
const USER_DATA_PATH = app.getPath('userData')
const SESSIONS_FILE = path.join(USER_DATA_PATH, 'sessions.json')
const RESUMES_FILE = path.join(USER_DATA_PATH, 'resumes.json')
const RESUMES_DIR = path.join(USER_DATA_PATH, 'resumes')

// Ensure directories exist
function ensureDirectoriesExist(): void {
  if (!fs.existsSync(RESUMES_DIR)) {
    fs.mkdirSync(RESUMES_DIR, { recursive: true })
  }
}

// Save sessions data
function saveSessions(sessions: any[]): boolean {
  try {
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2))
    return true
  } catch (error) {
    console.error('Failed to save sessions:', error)
    return false
  }
}

// Load sessions data
function loadSessions(): any[] {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const data = fs.readFileSync(SESSIONS_FILE, 'utf8')
      return JSON.parse(data)
    }
    return []
  } catch (error) {
    console.error('Failed to load sessions:', error)
    return []
  }
}

// Save resumes metadata
function saveResumesMetadata(resumes: any[]): boolean {
  try {
    // Strip the actual file data before saving metadata
    const resumesMetadata = resumes.map((resume) => ({
      id: resume.id,
      name: resume.name,
      fileName: resume.fileName,
      fileType: resume.fileType,
      filePath: resume.filePath,
      dateAdded: resume.dateAdded
    }))

    fs.writeFileSync(RESUMES_FILE, JSON.stringify(resumesMetadata, null, 2))
    return true
  } catch (error) {
    console.error('Failed to save resumes metadata:', error)
    return false
  }
}

// Load resumes metadata
function loadResumesMetadata(): any[] {
  try {
    if (fs.existsSync(RESUMES_FILE)) {
      const data = fs.readFileSync(RESUMES_FILE, 'utf8')
      return JSON.parse(data)
    }
    return []
  } catch (error) {
    console.error('Failed to load resumes metadata:', error)
    return []
  }
}

// Save resume file
async function saveResumeFile(
  id: string,
  fileBuffer: Buffer,
  fileExtension: string
): Promise<string> {
  try {
    ensureDirectoriesExist()
    const filePath = path.join(RESUMES_DIR, `${id}${fileExtension}`)
    fs.writeFileSync(filePath, fileBuffer)
    return filePath
  } catch (error) {
    console.error('Failed to save resume file:', error)
    throw error
  }
}

// Delete resume file
function deleteResumeFile(filePath: string): boolean {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
      return true
    }
    return false
  } catch (error) {
    console.error('Failed to delete resume file:', error)
    return false
  }
}

// Initialize storage
function initStorage(): void {
  ensureDirectoriesExist()
}

export {
  initStorage,
  saveSessions,
  loadSessions,
  saveResumesMetadata,
  loadResumesMetadata,
  saveResumeFile,
  deleteResumeFile
}
