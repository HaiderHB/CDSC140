// audio-processor.js
// This worklet processes audio data for transcription

class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.bufferSize = 4096 // Buffer size for audio processing
    this.buffer = new Float32Array(this.bufferSize)
    this.bufferIndex = 0
  }

  process(inputs, outputs, parameters) {
    // Get the input audio data (first channel of first input)
    const input = inputs[0][0]

    // If there's no input, just continue processing
    if (!input) return true

    // Fill the buffer with audio data
    for (let i = 0; i < input.length; i++) {
      // If we have space in the buffer
      if (this.bufferIndex < this.bufferSize) {
        this.buffer[this.bufferIndex++] = input[i]
      }

      // If the buffer is full, convert and send it
      if (this.bufferIndex >= this.bufferSize) {
        // Convert Float32Array to Int16Array for more efficient transmission
        // and compatibility with the transcription service
        const int16Data = new Int16Array(this.bufferSize)
        for (let j = 0; j < this.bufferSize; j++) {
          // Convert from [-1, 1] float range to [-32768, 32767] int16 range
          int16Data[j] = Math.max(-32768, Math.min(32767, this.buffer[j] * 32767))
        }

        // Send the audio data to the main thread
        this.port.postMessage(int16Data.buffer)

        // Reset the buffer index to start over
        this.bufferIndex = 0
      }
    }

    // Return true to keep the node alive
    return true
  }
}

// Register the processor
registerProcessor('audio-processor', AudioProcessor)
