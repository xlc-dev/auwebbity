let sharedAudioContext: AudioContext | null = null;

const AudioContextClass =
  window.AudioContext ||
  (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

export function getAudioContext(): AudioContext {
  if (!sharedAudioContext) {
    if (!AudioContextClass) {
      throw new Error("AudioContext is not supported in this browser");
    }
    sharedAudioContext = new AudioContextClass();
  }
  if (sharedAudioContext.state === "suspended") {
    sharedAudioContext.resume();
  }
  return sharedAudioContext;
}

export function createAudioBuffer(
  numberOfChannels: number,
  length: number,
  sampleRate: number
): AudioBuffer {
  return getAudioContext().createBuffer(numberOfChannels, length, sampleRate);
}
