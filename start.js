import { spawn } from 'child_process'
import { platform } from 'os'
import fs from 'fs'

// Determine if we're on Windows
const isWindows = platform() === 'win32'
const npmCmd = isWindows ? 'npm.cmd' : 'npm'

// Create a write stream for errors we want to ignore
const errorLogPath = 'electron-errors.log'
const errorStream = fs.createWriteStream(errorLogPath)

// Start the Electron app
console.log('Starting Electron app...')
const electron = spawn(npmCmd, ['run', 'dev'], {
  // Redirect stderr to our custom stream instead of inheriting
  stdio: ['inherit', 'inherit', 'pipe'],
  shell: isWindows // Use shell on Windows
})

// Filter stderr output
electron.stderr.on('data', (data) => {
  const output = data.toString()
  // Only log errors that don't match the patterns we want to ignore
  if (
    !output.includes('dxgi_duplicator_controller') &&
    !output.includes('screen_capturer_win_directx') &&
    !output.includes('Duplication failed') &&
    !output.includes('display_layout.cc:556 PlacementList must be sorted') &&
    !output.includes('Request Autofill') &&
    !output.includes('devtools://') &&
    !output.includes('is not valid JSON')
  ) {
    process.stderr.write(data)
  } else {
    // Write filtered errors to log file instead
    errorStream.write(data)
  }
})

// Handle process termination
process.on('SIGINT', () => {
  console.log('Terminating processes...')
  electron.kill()
  errorStream.end()
  process.exit()
})

electron.on('close', (code) => {
  console.log(`Electron app exited with code ${code}`)
  errorStream.end()
  process.exit()
})

console.log('Started Electron app. Press Ctrl+C to exit.')
