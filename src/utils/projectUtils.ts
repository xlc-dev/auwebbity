import { AudioTrack, AudioState } from "../stores/audioStore";
import { audioOperations } from "./audioOperations";

export interface ProjectFile {
  version: string;
  projectName: string;
  tracks: Array<{
    id: string;
    name: string;
    duration: number;
    backgroundColor: string | null;
    volume: number;
    muted: boolean;
    soloed: boolean;
    waveformRenderer: "bars" | "line" | "spectrogram";
    audioData: string;
  }>;
  currentTrackId: string | null;
  zoom: number;
  repeatRegion: { start: number; end: number } | null;
}

const PROJECT_VERSION = "1.0.0";

export async function exportProject(state: AudioState): Promise<Blob> {
  const tracks = await Promise.all(
    state.tracks.map(async (track) => {
      let audioData = "";
      if (track.audioBuffer) {
        const blob = await audioOperations.audioBufferToBlob(track.audioBuffer);
        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        const chunks: string[] = [];
        const chunkSize = 8192;
        for (let i = 0; i < uint8Array.length; i += chunkSize) {
          const chunk = uint8Array.slice(i, i + chunkSize);
          chunks.push(String.fromCharCode(...chunk));
        }
        audioData = btoa(chunks.join(""));
      }

      return {
        id: track.id,
        name: track.name,
        duration: track.duration,
        backgroundColor: track.backgroundColor,
        volume: track.volume,
        muted: track.muted,
        soloed: track.soloed,
        waveformRenderer: track.waveformRenderer,
        audioData,
      };
    })
  );

  const project: ProjectFile = {
    version: PROJECT_VERSION,
    projectName: state.projectName || "Untitled Project",
    tracks,
    currentTrackId: state.currentTrackId,
    zoom: state.zoom,
    repeatRegion: state.repeatRegion,
  };

  const json = JSON.stringify(project, null, 2);
  return new Blob([json], { type: "application/json" });
}

export async function importProject(
  file: File
): Promise<Partial<AudioState> & { tracks: AudioTrack[] }> {
  const text = await file.text();
  const project: ProjectFile = JSON.parse(text);

  if (project.version !== PROJECT_VERSION) {
    throw new Error(
      `Unsupported project version: ${project.version}. Expected: ${PROJECT_VERSION}`
    );
  }

  const audioContext = new AudioContext();
  const tracks: AudioTrack[] = await Promise.all(
    project.tracks.map(async (trackData) => {
      let audioBuffer: AudioBuffer | null = null;
      let audioUrl = "";

      if (trackData.audioData) {
        try {
          const binaryString = atob(trackData.audioData);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }

          audioBuffer = await audioContext.decodeAudioData(bytes.buffer);
          const blob = await audioOperations.audioBufferToBlob(audioBuffer);
          audioUrl = URL.createObjectURL(blob);
        } catch (error) {
          console.error("Failed to decode audio data for track:", trackData.name, error);
          throw new Error(`Failed to decode audio data for track: ${trackData.name}`);
        }
      }

      return {
        id: trackData.id,
        name: trackData.name,
        audioBuffer,
        audioUrl,
        duration: trackData.duration,
        backgroundColor: trackData.backgroundColor,
        volume: trackData.volume ?? 1,
        muted: trackData.muted ?? false,
        soloed: trackData.soloed ?? false,
        waveformRenderer: trackData.waveformRenderer || "bars",
      };
    })
  );

  return {
    tracks,
    currentTrackId: project.currentTrackId,
    zoom: project.zoom ?? 100,
    repeatRegion: project.repeatRegion ?? null,
    projectName: project.projectName || "",
    isPlaying: false,
    currentTime: 0,
    selection: null,
    clipboard: null,
    undoStackLength: 0,
    redoStackLength: 0,
  };
}

export function downloadProject(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".json") ? filename : `${filename}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
