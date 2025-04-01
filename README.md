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
