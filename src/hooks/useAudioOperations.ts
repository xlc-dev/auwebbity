import { createSignal } from "solid-js";
import { useAudioStore } from "../stores/audioStore";
import { audioOperations } from "../utils/audioOperations";
import { mergeAudioBuffers } from "../utils/audioBuffer";
import { audioEffects } from "../utils/audioEffects";

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

    const track = store.tracks[trackIndex];
    if (!track) return;

    const oldUrl = track.audioUrl;
    const blob = await audioOperations.audioBufferToBlob(newBuffer);
    const newUrl = URL.createObjectURL(blob);

    setAudioStore("tracks", (tracks) => {
      const newTracks = [...tracks];
      newTracks[trackIndex] = {
        ...track,
        audioBuffer: newBuffer,
        audioUrl: newUrl,
        duration: newBuffer.duration,
      };
      return newTracks;
    });

    if (oldUrl) {
      URL.revokeObjectURL(oldUrl);
    }

    setSelection(null);
    waveformRef()?.clearSelection();
  };

  const handleCut = async (
    waveformRef: () => ReturnType<typeof import("./useWaveform").useWaveform> | null
  ) => {
    const currentTrack = getCurrentTrack();
    if (!currentTrack?.audioBuffer || !store.selection) return;

    setIsLoading(true);
    try {
      await saveToHistory();
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

      const newBuffer = mergeAudioBuffers(
        before,
        after,
        currentTrack.audioBuffer.numberOfChannels,
        currentTrack.audioBuffer.sampleRate
      );

      await updateTrackAfterOperation(currentTrack.id, newBuffer, waveformRef);
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
      await saveToHistory();

      const insertTime = store.currentTime;
      const newBuffer = await audioOperations.paste(
        currentTrack.audioBuffer,
        store.clipboard,
        insertTime
      );

      await updateTrackAfterOperation(trackId, newBuffer, waveformRef);
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
      await saveToHistory();

      const { before, after } = await audioOperations.cut(
        currentTrack.audioBuffer,
        store.selection.start,
        store.selection.end
      );

      const newBuffer = mergeAudioBuffers(
        before,
        after,
        currentTrack.audioBuffer.numberOfChannels,
        currentTrack.audioBuffer.sampleRate
      );

      await updateTrackAfterOperation(currentTrack.id, newBuffer, waveformRef);
    } finally {
      setIsLoading(false);
    }
  };

  const applyEffect = async (
    scope: "all" | "track" | "selection",
    waveformRef: (trackId: string) => ReturnType<typeof import("./useWaveform").useWaveform> | null,
    effectFn: (buffer: AudioBuffer, startTime?: number, endTime?: number) => Promise<AudioBuffer>
  ) => {
    setIsLoading(true);
    try {
      await saveToHistory();

      if (scope === "all") {
        for (const track of store.tracks) {
          if (!track.audioBuffer) continue;
          const waveform = waveformRef(track.id);
          if (!waveform) continue;

          const newBuffer = await effectFn(track.audioBuffer);
          await updateTrackAfterOperation(track.id, newBuffer, () => waveform);
        }
      } else {
        const targetTrackId =
          scope === "selection" && store.selection ? store.currentTrackId : store.currentTrackId;
        if (!targetTrackId) return;

        const targetTrack = store.tracks.find((t) => t.id === targetTrackId);
        if (!targetTrack?.audioBuffer) return;

        const waveform = waveformRef(targetTrackId);
        if (!waveform) return;

        let newBuffer: AudioBuffer;
        if (scope === "selection" && store.selection) {
          newBuffer = await effectFn(
            targetTrack.audioBuffer,
            store.selection.start,
            store.selection.end
          );
        } else {
          newBuffer = await effectFn(targetTrack.audioBuffer);
        }

        await updateTrackAfterOperation(targetTrackId, newBuffer, () => waveform);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleNormalize = async (
    scope: "all" | "track" | "selection",
    waveformRef: (trackId: string) => ReturnType<typeof import("./useWaveform").useWaveform> | null
  ) => {
    await applyEffect(scope, waveformRef, (buffer, start, end) =>
      audioEffects.normalize(buffer, start, end)
    );
  };

  const handleAmplify = async (
    scope: "all" | "track" | "selection",
    waveformRef: (trackId: string) => ReturnType<typeof import("./useWaveform").useWaveform> | null,
    gain: number
  ) => {
    await applyEffect(scope, waveformRef, (buffer, start, end) =>
      audioEffects.amplify(buffer, gain, start, end)
    );
  };

  const handleSilence = async (
    scope: "all" | "track" | "selection",
    waveformRef: (trackId: string) => ReturnType<typeof import("./useWaveform").useWaveform> | null
  ) => {
    if (scope !== "selection" || !store.selection) return;
    await applyEffect(scope, waveformRef, (buffer, start, end) =>
      audioEffects.silence(buffer, start!, end!)
    );
  };

  const handleReverse = async (
    scope: "all" | "track" | "selection",
    waveformRef: (trackId: string) => ReturnType<typeof import("./useWaveform").useWaveform> | null
  ) => {
    await applyEffect(scope, waveformRef, (buffer, start, end) =>
      audioEffects.reverse(buffer, start, end)
    );
  };

  const handleFadeIn = async (
    scope: "all" | "track" | "selection",
    waveformRef: (trackId: string) => ReturnType<typeof import("./useWaveform").useWaveform> | null,
    fadeDuration?: number
  ) => {
    await applyEffect(scope, waveformRef, (buffer, start, end) =>
      audioEffects.fadeIn(buffer, fadeDuration, start, end)
    );
  };

  const handleFadeOut = async (
    scope: "all" | "track" | "selection",
    waveformRef: (trackId: string) => ReturnType<typeof import("./useWaveform").useWaveform> | null,
    fadeDuration?: number
  ) => {
    await applyEffect(scope, waveformRef, (buffer, start, end) =>
      audioEffects.fadeOut(buffer, fadeDuration, start, end)
    );
  };

  return {
    handleCut,
    handleCopy,
    handlePaste,
    handleDelete,
    handleNormalize,
    handleAmplify,
    handleSilence,
    handleReverse,
    handleFadeIn,
    handleFadeOut,
    isLoading,
  };
};
