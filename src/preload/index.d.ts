import { ElectronAPI } from '@electron-toolkit/preload'

interface OpenAIAPI {
  getOpenAISession: () => Promise<any>
  openAIWebRtcSdp: (sdp: string) => Promise<string>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: OpenAIAPI
  }
}
