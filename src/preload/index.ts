import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  // OpenAI API functions
  getOpenAISession: () => ipcRenderer.invoke('get-ai-session'),
  openAIWebRtcSdp: (sdp: string) => ipcRenderer.invoke('ai-webrtc-sdp', sdp),

  // App control functions
  closeApp: () => ipcRenderer.send('close-app'),

  // Data persistence functions
  getSessions: () => ipcRenderer.invoke('get-sessions'),
  saveSessions: (sessions: any[]) => ipcRenderer.invoke('save-sessions', sessions),
  getResumes: () => ipcRenderer.invoke('get-resumes'),
  saveResumes: (resumes: any[]) => ipcRenderer.invoke('save-resumes', resumes),
  saveResumeFile: (id: string, fileData: ArrayBuffer, fileExtension: string) =>
    ipcRenderer.invoke('save-resume-file', id, fileData, fileExtension),
  readResumeFile: (filePath: string) => ipcRenderer.invoke('read-resume-file', filePath),
  readDocxFile: (filePath: string) => ipcRenderer.invoke('read-docx-file', filePath),
  readTxtFile: (filePath: string) => ipcRenderer.invoke('read-txt-file', filePath),
  deleteResume: (filePath: string) => ipcRenderer.invoke('delete-resume', filePath),

  // Ctrl+M event handler
  onCtrlM: (callback: () => void) => {
    ipcRenderer.on('ctrl-m-event', callback)
    return () => {
      ipcRenderer.removeListener('ctrl-m-event', callback)
    }
  },

  // Ctrl+N event handler
  onCtrlN: (callback: () => void) => {
    ipcRenderer.on('ctrl-n-event', callback)
    return () => {
      ipcRenderer.removeListener('ctrl-n-event', callback)
    }
  },

  // Auth methods
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  onAuthCallback: (callback: (url: string) => void) => {
    ipcRenderer.on('auth-callback', (_event, url) => callback(url))
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
