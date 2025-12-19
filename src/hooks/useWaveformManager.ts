import { Accessor } from "solid-js";
import { useAudioStore } from "../stores/audioStore";
import type { useWaveform } from "./useWaveform";

type WaveformRef = ReturnType<typeof useWaveform> | null;
type WaveformMap = Map<string, WaveformRef>;

export const useWaveformManager = (waveformMap: Accessor<WaveformMap>) => {
  const { store, setPlaying } = useAudioStore();

  const playAllTracks = () => {
    const map = waveformMap();
    const tracks = store.tracks;
    const trackMap = new Map(tracks.map((t) => [t.id, t]));
    const hasSoloedTracks = tracks.some((t) => t.soloed);
    let hasAnyPlaying = false;

    map.forEach((waveform, trackId) => {
      const track = trackMap.get(trackId);
      if (!track) return;

      const shouldPlay = hasSoloedTracks ? track.soloed : !track.muted;

      if (shouldPlay) {
        waveform?.play();
        hasAnyPlaying = true;
      } else {
        waveform?.pause();
      }
    });

    if (hasAnyPlaying) {
      setPlaying(true);
    }
  };

  const pauseAllTracks = () => {
    const map = waveformMap();
    map.forEach((waveform) => {
      waveform?.pause();
    });
    setPlaying(false);
  };

  const stopAllTracks = () => {
    const map = waveformMap();
    map.forEach((waveform) => {
      waveform?.stop();
    });
    setPlaying(false);
  };

  const seekAllTracks = (time: number) => {
    const map = waveformMap();
    const tracks = store.tracks;
    const trackMap = new Map(tracks.map((t) => [t.id, t]));
    map.forEach((waveform, trackId) => {
      const track = trackMap.get(trackId);
      if (track && track.duration > 0) {
        const normalizedPosition = Math.max(0, Math.min(1, time / track.duration));
        waveform?.seekTo(normalizedPosition);
      }
    });
  };

  const clearAllSelections = () => {
    waveformMap().forEach((waveform) => waveform?.clearSelection());
  };

  return {
    playAllTracks,
    pauseAllTracks,
    stopAllTracks,
    seekAllTracks,
    clearAllSelections,
  };
};
