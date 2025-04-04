class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    // Noise gate settings
    this.threshold = -50 // dB
    this.bufferSize = 2048
    this.buffer = new Float32Array(this.bufferSize)
    this.int16Buffer = new Int16Array(this.bufferSize)
    this.bufferIndex = 0
    this.isGateOpen = false
    this.holdCounter = 0
    this.holdTime = 50 // frames to hold gate open after falling below threshold
  }

  calculateRMSdB(samples) {
    let sum = 0
    for (let i = 0; i < samples.length; i++) {
      sum += samples[i] * samples[i]
    }
    const rms = Math.sqrt(sum / samples.length)
    // Convert to dB, with a noise floor of -100 dB
    return 20 * Math.log10(Math.max(rms, 0.00001))
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0]
    const output = outputs[0]

    if (input && input.length > 0) {
      const inputChannel = input[0]

      // Calculate RMS in dB
      const currentLevel = this.calculateRMSdB(inputChannel)

      // Noise gate logic with hysteresis
      if (currentLevel > this.threshold) {
        this.isGateOpen = true
        this.holdCounter = this.holdTime
      } else if (this.holdCounter > 0) {
        this.holdCounter--
      } else {
        this.isGateOpen = false
      }

      // Copy input to output
      for (let channel = 0; channel < input.length; channel++) {
        output[channel].set(input[channel])
      }

      // If gate is open, send audio data
      if (this.isGateOpen) {
        // Add to buffer
        for (let i = 0; i < inputChannel.length; i++) {
          this.buffer[this.bufferIndex] = inputChannel[i]
          this.bufferIndex++

          // When buffer is full, send it
          if (this.bufferIndex >= this.bufferSize) {
            // Convert Float32Array to Int16Array
            for (let j = 0; j < this.bufferSize; j++) {
              // Scale to 16-bit range and clamp
              const sample = Math.max(-1, Math.min(1, this.buffer[j]))
              this.int16Buffer[j] = sample * 32767
            }
            this.port.postMessage(this.int16Buffer.slice())
            this.bufferIndex = 0
          }
        }
      }
    }

    return true
  }
}

registerProcessor('audio-processor', AudioProcessor)
