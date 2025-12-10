export function cloneAudioBuffer(audioBuffer: AudioBuffer): AudioBuffer {
  const audioContext = new AudioContext();
  const clonedBuffer = audioContext.createBuffer(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    audioBuffer.sampleRate
  );

  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const sourceData = audioBuffer.getChannelData(channel);
    const destData = clonedBuffer.getChannelData(channel);
    destData.set(sourceData);
  }

  return clonedBuffer;
}

export function mergeAudioBuffers(
  before: AudioBuffer,
  after: AudioBuffer,
  numberOfChannels: number,
  sampleRate: number
): AudioBuffer {
  const audioContext = new AudioContext();
  const newLength = before.length + after.length;
  const newBuffer = audioContext.createBuffer(numberOfChannels, newLength, sampleRate);

  for (let channel = 0; channel < newBuffer.numberOfChannels; channel++) {
    const newData = newBuffer.getChannelData(channel);
    const beforeData = before.getChannelData(channel);
    const afterData = after.getChannelData(channel);

    for (let i = 0; i < before.length; i++) {
      newData[i] = beforeData[i] ?? 0;
    }
    for (let i = 0; i < after.length; i++) {
      newData[before.length + i] = afterData[i] ?? 0;
    }
  }

  return newBuffer;
}
