class RecorderWorklet extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0][0]; // first channel (mono)
    if (input) {
      this.port.postMessage(input); // send Float32Array back to main thread
    }
    return true;
  }
}

registerProcessor("recorder-worklet", RecorderWorklet);
