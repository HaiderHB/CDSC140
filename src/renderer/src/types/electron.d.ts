interface OpenAIAPI {
  getOpenAISession: () => Promise<any>
  openAIWebRtcSdp: (sdp: string) => Promise<any>
  transcribeAudio: (audioData: Uint8Array) => Promise<string>
  closeApp: () => void
  onCtrlM: (callback: () => void) => () => void
}

interface ServerResult {
  success: boolean
  error?: string
}

interface DataAPI {
  getSessions: () => Promise<any[]>
  saveSessions: (sessions: any[]) => Promise<boolean>
  getResumes: () => Promise<any[]>
  saveResumes: (resumes: any[]) => Promise<boolean>
  saveResumeFile: (id: string, fileData: ArrayBuffer, fileExtension: string) => Promise<string>
  readResumeFile: (filePath: string) => Promise<string>
  readDocxFile: (filePath: string) => Promise<string>
  readTxtFile: (filePath: string) => Promise<string>
  deleteResume: (filePath: string) => Promise<boolean>
  startPythonServer: () => Promise<ServerResult>
  stopPythonServer: () => Promise<ServerResult>
}

interface API extends OpenAIAPI, DataAPI {
  transcribeAudio: (audioData: Uint8Array) => Promise<string>
}

interface IpcRenderer {
  transcribeAudio: (audioData: Uint8Array) => Promise<string>
}

interface ElectronAPI {
  ipcRenderer: IpcRenderer
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: API
  }
}
