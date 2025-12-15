import { AudioTrack, Selection } from "../stores/audioStore";
import { mixTracksWithVolume } from "./audioBuffer";
import { createAudioBuffer } from "./audioContext";

const DEFAULT_SAMPLE_RATE = 44100;

export async function prepareExportBuffer(
  scope: "all" | "current" | "selection",
  tracks: AudioTrack[],
  currentTrack: AudioTrack | null,
  selection: Selection | null,
  projectName: string,
  format: "wav" | "mp3" | "ogg"
): Promise<{ buffer: AudioBuffer; filename: string } | null> {
  if (scope === "current") {
    if (!currentTrack?.audioBuffer) {
      return null;
    }
    return {
      buffer: currentTrack.audioBuffer,
      filename: `${projectName}_${currentTrack.name}.${format}`,
    };
  }

  if (scope === "selection") {
    if (!selection) {
      return null;
    }

    const { start, end } = selection;
    const sampleRate =
      tracks.find((t) => t.audioBuffer)?.audioBuffer?.sampleRate ?? DEFAULT_SAMPLE_RATE;

    const tracksToMix = tracks
      .filter((t) => t.audioBuffer !== null)
      .map((t) => {
        const buffer = t.audioBuffer!;
        const startSample = Math.floor(start * buffer.sampleRate);
        const endSample = Math.floor(end * buffer.sampleRate);
        const length = Math.max(1, endSample - startSample);

        const selectionBuffer = createAudioBuffer(
          buffer.numberOfChannels,
          length,
          buffer.sampleRate
        );

        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
          const sourceData = buffer.getChannelData(channel);
          const destData = selectionBuffer.getChannelData(channel);
          for (let i = 0; i < length && startSample + i < sourceData.length; i++) {
            destData[i] = sourceData[startSample + i] ?? 0;
          }
        }

        return {
          audioBuffer: selectionBuffer,
          volume: t.volume,
          pan: t.pan,
          muted: t.muted,
          soloed: t.soloed,
        };
      });

    const buffer = mixTracksWithVolume(tracksToMix, sampleRate);
    if (!buffer) {
      return null;
    }

    return {
      buffer,
      filename: `${projectName}_selection.${format}`,
    };
  }

  if (tracks.length === 0) {
    return null;
  }

  const sampleRate =
    tracks.find((t) => t.audioBuffer)?.audioBuffer?.sampleRate ?? DEFAULT_SAMPLE_RATE;
  const buffer = mixTracksWithVolume(
    tracks.map((t) => ({
      audioBuffer: t.audioBuffer,
      volume: t.volume,
      pan: t.pan,
      muted: t.muted,
      soloed: t.soloed,
    })),
    sampleRate
  );

  if (!buffer) {
    return null;
  }

  return {
    buffer,
    filename: `${projectName}.${format}`,
  };
}
