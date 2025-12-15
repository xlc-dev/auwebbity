import { AudioTrack, WaveformRenderer } from "../stores/audioStore";
import { audioOperations } from "./audioOperations";
import { cloneAudioBuffer } from "./audioBuffer";

export const DEFAULT_TRACK_VALUES = {
  backgroundColor: null,
  volume: 1,
  pan: 0,
  muted: false,
  soloed: false,
  waveformRenderer: "bars" as WaveformRenderer,
} as const;

export async function createTrackFromBuffer(
  audioBuffer: AudioBuffer,
  audioUrl: string,
  name: string,
  baseTrack?: Partial<AudioTrack>
): Promise<Omit<AudioTrack, "id">> {
  return {
    name,
    audioBuffer,
    audioUrl,
    duration: audioBuffer.duration,
    backgroundColor: baseTrack?.backgroundColor ?? DEFAULT_TRACK_VALUES.backgroundColor,
    volume: baseTrack?.volume ?? DEFAULT_TRACK_VALUES.volume,
    pan: baseTrack?.pan ?? DEFAULT_TRACK_VALUES.pan,
    muted: baseTrack?.muted ?? DEFAULT_TRACK_VALUES.muted,
    soloed: baseTrack?.soloed ?? DEFAULT_TRACK_VALUES.soloed,
    waveformRenderer: baseTrack?.waveformRenderer ?? DEFAULT_TRACK_VALUES.waveformRenderer,
  };
}

export async function createTrackFromBufferWithUrl(
  audioBuffer: AudioBuffer,
  name: string,
  baseTrack?: Partial<AudioTrack>
): Promise<{ track: Omit<AudioTrack, "id">; audioUrl: string }> {
  const blob = await audioOperations.audioBufferToBlob(audioBuffer);
  const audioUrl = URL.createObjectURL(blob);
  const track = await createTrackFromBuffer(audioBuffer, audioUrl, name, baseTrack);
  return { track, audioUrl };
}

export async function cloneTrackWithBuffer(
  sourceTrack: AudioTrack,
  newName: string
): Promise<{ track: Omit<AudioTrack, "id">; audioUrl: string }> {
  if (!sourceTrack.audioBuffer) {
    throw new Error("Source track has no audio buffer");
  }
  const clonedBuffer = cloneAudioBuffer(sourceTrack.audioBuffer);
  return createTrackFromBufferWithUrl(clonedBuffer, newName, sourceTrack);
}
