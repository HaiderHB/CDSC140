# electron-app

An Electron application with React and TypeScript that captures desktop audio and sends it to OpenAI's realtime API for text responses.

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
$ npm install
```

### Configuration

1. Create a `.env` file in the root directory with your OpenAI API key:

```
OPENAI_API_KEY=your_openai_api_key_here
```

### Development

#### Run with Error Filtering

```bash
$ npm run start:filtered
```

This will start the Electron app with error filtering to suppress common screen capture and DevTools errors.

#### Regular Development

```bash
$ npm run dev
```

### Build

```bash
# For windows
$ npm run build:win

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux
```

## How It Works

1. The application captures desktop audio using Electron's `desktopCapturer`
2. WebRTC is used to stream the audio to OpenAI's realtime API
3. OpenAI processes the audio in real-time and returns transcriptions and responses
4. These responses are displayed in the application interface

## Features

- Desktop audio capture
- Real-time audio visualization
- WebRTC streaming to OpenAI
- Real-time text responses from OpenAI's GPT-4o model
- Manual response triggering

```
whisper-node-test
├─ .editorconfig
├─ .npmrc
├─ .prettierignore
├─ .prettierrc.yaml
├─ build
│  ├─ entitlements.mac.plist
│  ├─ icon.icns
│  ├─ icon.ico
│  └─ icon.png
├─ dev-app-update.yml
├─ electron-builder.yml
├─ electron.vite.config.ts
├─ eslint.config.mjs
├─ onnx_models
├─ package-lock.json
├─ package.json
├─ public
│  └─ scripts
│     └─ audio-processor.js
├─ README.md
├─ resources
│  └─ icon.png
├─ scripts
│  ├─ install_packages.py
│  ├─ requirements.txt
│  └─ transcription.py
├─ src
│  ├─ main
│  │  ├─ index.ts
│  │  ├─ storage.ts
│  │  └─ transcription.ts
│  ├─ preload
│  │  ├─ index.d.ts
│  │  └─ index.ts
│  └─ renderer
│     ├─ index.html
│     └─ src
│        ├─ App.css
│        ├─ App.tsx
│        ├─ assets
│        │  ├─ base.css
│        │  ├─ electron.svg
│        │  ├─ main.css
│        │  └─ wavy-lines.svg
│        ├─ components
│        │  ├─ AssistanceModeModal.tsx
│        │  ├─ AudioStatusDisplay.tsx
│        │  ├─ CapturePage.tsx
│        │  ├─ EyeContactBox.tsx
│        │  ├─ Key.tsx
│        │  ├─ LoginPage.tsx
│        │  ├─ MainPage.tsx
│        │  ├─ NotSubscribedPage.tsx
│        │  ├─ ReadingModeModal.tsx
│        │  ├─ ResponseOutput.tsx
│        │  ├─ ResumeManager.tsx
│        │  ├─ SessionList.tsx
│        │  ├─ Settings.tsx
│        │  ├─ SetupConfigPage.tsx
│        │  ├─ SpeedReaders.tsx
│        │  ├─ TranscriptionDisplay.tsx
│        │  └─ Versions.tsx
│        ├─ env.d.ts
│        ├─ hooks
│        │  ├─ useAppNavigation.ts
│        │  ├─ useAudioCapture.ts
│        │  ├─ useDataPersistence.ts
│        │  ├─ useKeyboardShortcuts.ts
│        │  ├─ useSpeechRecognition.ts
│        │  ├─ useTranscriptionService.ts
│        │  └─ useWebRTC.ts
│        ├─ main.tsx
│        ├─ services
│        │  └─ authService.ts
│        ├─ theme.tsx
│        ├─ types
│        │  ├─ electron.d.ts
│        │  └─ speech.d.ts
│        └─ utils
│           ├─ appLifecycle.ts
│           ├─ checkSubscription.ts
│           └─ prompts.ts
├─ start.js
├─ stealth-run.bat
├─ tsconfig.json
├─ tsconfig.node.json
└─ tsconfig.web.json

```