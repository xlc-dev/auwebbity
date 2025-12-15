import { createAudioBuffer } from "./audioContext";
import { audioWorkerClient } from "./audioWorkerClient";

const USE_WORKER = typeof Worker !== "undefined";

export function cloneAudioBuffer(audioBuffer: AudioBuffer): AudioBuffer {
  const clonedBuffer = createAudioBuffer(
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

export async function mergeAudioBuffers(
  before: AudioBuffer,
  after: AudioBuffer,
  numberOfChannels: number,
  sampleRate: number
): Promise<AudioBuffer> {
  if (USE_WORKER) {
    try {
      return await audioWorkerClient.merge(before, after, numberOfChannels, sampleRate);
    } catch (error) {
      console.warn("Worker merge failed, falling back to main thread:", error);
    }
  }
  const newLength = Math.max(1, before.length + after.length);
  const newBuffer = createAudioBuffer(numberOfChannels, newLength, sampleRate);

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

export function mixTracksWithVolume(
  tracks: Array<{
    audioBuffer: AudioBuffer | null;
    volume: number;
    pan: number;
    muted: boolean;
    soloed: boolean;
  }>,
  sampleRate?: number
): AudioBuffer | null {
  const validTracks = tracks.filter((t) => t.audioBuffer !== null);
  if (validTracks.length === 0) return null;

  const hasSoloedTracks = validTracks.some((t) => t.soloed);
  const tracksToMix = hasSoloedTracks
    ? validTracks.filter((t) => t.soloed && !t.muted)
    : validTracks.filter((t) => !t.muted);

  if (tracksToMix.length === 0) {
    const firstTrack = validTracks[0];
    if (!firstTrack?.audioBuffer) return null;
    const sr = sampleRate ?? firstTrack.audioBuffer.sampleRate;
    return createAudioBuffer(2, Math.floor(sr * 0.1), sr);
  }

  const firstTrack = tracksToMix[0]?.audioBuffer;
  if (!firstTrack) return null;
  const sr = sampleRate ?? firstTrack.sampleRate;
  const maxDuration = Math.max(...tracksToMix.map((t) => t.audioBuffer!.duration));
  const maxLength = Math.floor(maxDuration * sr);
  const maxChannels = Math.max(...tracksToMix.map((t) => t.audioBuffer!.numberOfChannels));

  const mixedBuffer = createAudioBuffer(maxChannels, maxLength, sr);

  for (const track of tracksToMix) {
    const buffer = track.audioBuffer!;
    const volume = track.volume;
    const pan = track.pan ?? 0;
    const trackChannels = buffer.numberOfChannels;
    const trackSampleRate = buffer.sampleRate;
    const trackDuration = buffer.duration;
    const trackLength = Math.floor(Math.min(trackDuration, maxDuration) * sr);

    const panValue = Math.max(-1, Math.min(1, pan));
    const leftGain = Math.cos((panValue + 1) * (Math.PI / 4));
    const rightGain = Math.sin((panValue + 1) * (Math.PI / 4));

    for (let channel = 0; channel < maxChannels; channel++) {
      const mixedData = mixedBuffer.getChannelData(channel);
      const sourceChannel = channel < trackChannels ? channel : trackChannels - 1;
      const sourceData = buffer.getChannelData(sourceChannel);

      let channelGain = volume;
      if (maxChannels >= 2) {
        if (channel === 0) {
          channelGain = volume * leftGain;
        } else if (channel === 1) {
          channelGain = volume * rightGain;
        }
        if (trackChannels === 1 && maxChannels >= 2) {
          if (channel === 0) {
            channelGain = volume * leftGain;
          } else if (channel === 1) {
            channelGain = volume * rightGain;
          }
        }
      }

      if (trackSampleRate === sr) {
        const sourceLength = Math.min(sourceData.length, trackLength);
        for (let i = 0; i < sourceLength; i++) {
          mixedData[i] = (mixedData[i] ?? 0) + (sourceData[i] ?? 0) * channelGain;
        }
      } else {
        const ratio = trackSampleRate / sr;
        for (let i = 0; i < trackLength; i++) {
          const sourceIndex = Math.floor(i * ratio);
          if (sourceIndex < sourceData.length) {
            mixedData[i] = (mixedData[i] ?? 0) + (sourceData[sourceIndex] ?? 0) * channelGain;
          }
        }
      }
    }
  }

  for (let channel = 0; channel < maxChannels; channel++) {
    const mixedData = mixedBuffer.getChannelData(channel);
    for (let i = 0; i < maxLength; i++) {
      mixedData[i] = Math.max(-1.0, Math.min(1.0, mixedData[i] ?? 0));
    }
  }

  return mixedBuffer;
}
