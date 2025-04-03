interface OpenAIAPI {
  getOpenAISession: () => Promise<any>
  openAIWebRtcSdp: (sdp: string) => Promise<any>
  transcribeAudio: (audioData: Uint8Array) => Promise<string>
}

interface DataAPI {
  getSessions: () => Promise<any>
  saveSessions: (sessions: any[]) => Promise<void>
  getResumes: () => Promise<any>
  saveResumes: (resumes: any[]) => Promise<void>
  saveResumeFile: (id: string, fileData: ArrayBuffer, fileExtension: string) => Promise<void>
  readResumeFile: (filePath: string) => Promise<ArrayBuffer>
  deleteResume: (filePath: string) => Promise<void>
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
