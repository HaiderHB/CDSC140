import './assets/main.css'

import React from 'react'
import ReactDOM from 'react-dom/client'
import { ThemeProvider, CssBaseline } from '@mui/material'
import App from './App'
import theme from './theme'
import './App.css'
import * as tf from '@tensorflow/tfjs'

// Configure and initialize TensorFlow.js
async function initTensorFlow() {
  console.log('🧠 Initializing TensorFlow.js...')

  // Set logging level - choose one of these options
  // tf.setBackend('cpu')
  // tf.setBackend('webgl')
  tf.enableProdMode()

  try {
    await tf.ready()
    console.log('✅ TensorFlow.js initialized. Backend:', tf.getBackend())
    console.log('✅ TensorFlow.js version:', tf.version.tfjs)
  } catch (error) {
    console.error('❌ Error initializing TensorFlow.js:', error)
  }
}

// Initialize TensorFlow and render the app
initTensorFlow().then(() => {
  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <App />
      </ThemeProvider>
    </React.StrictMode>
  )
})
