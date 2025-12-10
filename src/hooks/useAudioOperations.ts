import { createSignal } from "solid-js";
import { useAudioStore } from "../stores/audioStore";
import { audioOperations } from "../utils/audioOperations";

export const useAudioOperations = () => {
  const { store, getCurrentTrack, setSelection, setClipboard, setAudioStore, saveToHistory } =
    useAudioStore();
  const [isLoading, setIsLoading] = createSignal(false);

  const updateTrackAfterOperation = async (
    trackId: string,
    newBuffer: AudioBuffer,
    waveformRef: () => ReturnType<typeof import("./useWaveform").useWaveform> | null
  ) => {
    const trackIndex = store.tracks.findIndex((t) => t.id === trackId);
    if (trackIndex === -1) return;

    const blob = await audioOperations.audioBufferToBlob(newBuffer);
    const newUrl = URL.createObjectURL(blob);
    const currentTrack = getCurrentTrack();
    if (!currentTrack) return;

    setAudioStore("tracks", (tracks) => {
      const newTracks = [...tracks];
      newTracks[trackIndex] = {
        ...currentTrack,
        audioBuffer: newBuffer,
        audioUrl: newUrl,
        duration: newBuffer.duration,
      };
      return newTracks;
    });

    setSelection(null);
    waveformRef()?.clearSelection();
    const updatedTrack = getCurrentTrack();
    if (updatedTrack?.audioUrl) {
      waveformRef()?.loadAudio(updatedTrack.audioUrl);
    }
  };

  const handleCut = async (
    waveformRef: () => ReturnType<typeof import("./useWaveform").useWaveform> | null
  ) => {
    const currentTrack = getCurrentTrack();
    if (!currentTrack?.audioBuffer || !store.selection) return;

    setIsLoading(true);
    try {
      await saveToHistory(currentTrack.id);
      setClipboard(null);

      const copiedBuffer = await audioOperations.copy(
        currentTrack.audioBuffer,
        store.selection.start,
        store.selection.end
      );
      setClipboard(copiedBuffer);

      const { before, after } = await audioOperations.cut(
        currentTrack.audioBuffer,
        store.selection.start,
        store.selection.end
      );

      const audioContext = new AudioContext();
      const newLength = before.length + after.length;
      const newBuffer = audioContext.createBuffer(
        currentTrack.audioBuffer.numberOfChannels,
        newLength,
        currentTrack.audioBuffer.sampleRate
      );

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

      await updateTrackAfterOperation(currentTrack.id, newBuffer, waveformRef);
    } catch (err) {
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async (
    waveformRef: () => ReturnType<typeof import("./useWaveform").useWaveform> | null
  ) => {
    const currentTrack = getCurrentTrack();
    if (!currentTrack?.audioBuffer || !store.selection) return;

    const copiedBuffer = await audioOperations.copy(
      currentTrack.audioBuffer,
      store.selection.start,
      store.selection.end
    );

    setClipboard(copiedBuffer);
    setSelection(null);
    waveformRef()?.clearSelection();
  };

  const handlePaste = async (
    waveformRef: () => ReturnType<typeof import("./useWaveform").useWaveform> | null
  ) => {
    const currentTrack = getCurrentTrack();
    if (!currentTrack?.audioBuffer || !store.clipboard) return;

    setIsLoading(true);
    try {
      const trackId = currentTrack.id;
      await saveToHistory(trackId);

      const insertTime = store.currentTime;
      const newBuffer = await audioOperations.paste(
        currentTrack.audioBuffer,
        store.clipboard,
        insertTime
      );

      await updateTrackAfterOperation(trackId, newBuffer, waveformRef);
    } catch (err) {
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (
    waveformRef: () => ReturnType<typeof import("./useWaveform").useWaveform> | null
  ) => {
    const currentTrack = getCurrentTrack();
    if (!currentTrack?.audioBuffer || !store.selection) return;

    setIsLoading(true);
    try {
      await saveToHistory(currentTrack.id);

      const { before, after } = await audioOperations.cut(
        currentTrack.audioBuffer,
        store.selection.start,
        store.selection.end
      );

      const audioContext = new AudioContext();
      const newLength = before.length + after.length;
      const newBuffer = audioContext.createBuffer(
        currentTrack.audioBuffer.numberOfChannels,
        newLength,
        currentTrack.audioBuffer.sampleRate
      );

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

      await updateTrackAfterOperation(currentTrack.id, newBuffer, waveformRef);
    } catch (err) {
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    handleCut,
    handleCopy,
    handlePaste,
    handleDelete,
    isLoading,
  };
};
