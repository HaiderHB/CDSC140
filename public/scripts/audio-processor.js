class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0]
    const output = outputs[0]

    if (input && input.length > 0) {
      for (let channel = 0; channel < input.length; channel++) {
        output[channel].set(input[channel])
      }
    }

    // Send audio data to the main thread
    this.port.postMessage(input[0])

    return true
  }
}

registerProcessor('audio-processor', AudioProcessor)
