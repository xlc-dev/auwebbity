let sharedAudioContext: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!sharedAudioContext) {
    sharedAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
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
