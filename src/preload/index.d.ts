import { ElectronAPI } from '@electron-toolkit/preload'

interface OpenAIAPI {
  getOpenAISession: () => Promise<any>
  openAIWebRtcSdp: (sdp: string) => Promise<string>
  getSessions: () => Promise<any[]>
  saveSessions: (sessions: any[]) => Promise<boolean>
  getResumes: () => Promise<any[]>
  saveResumes: (resumes: any[]) => Promise<boolean>
  saveResumeFile: (id: string, fileData: ArrayBuffer, fileExtension: string) => Promise<string>
  readResumeFile: (filePath: string) => Promise<string>
  readDocxFile: (filePath: string) => Promise<string>
  readTxtFile: (filePath: string) => Promise<string>
  deleteResume: (filePath: string) => Promise<boolean>
  closeApp: () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: OpenAIAPI
  }
}
