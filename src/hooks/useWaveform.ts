import { onCleanup, createEffect } from "solid-js";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";
import { useAudioStore } from "../stores/audioStore";
import { isAbortError } from "../utils/errorUtils";

export const useWaveform = (containerRef: () => HTMLDivElement | undefined) => {
  let wavesurfer: WaveSurfer | null = null;
  let regionsPlugin: RegionsPlugin | null = null;
  let dragSelectionCleanup: (() => void) | null = null;
  let isSeeking = false;
  let seekingTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let pausedTime: number | null = null;
  let isDragging = false;
  let originalRegionWidth: number | null = null;
  let lastClampTime = 0;
  let isInitialized = false;
  let currentLoadAbortController: AbortController | null = null;
  let isAudioLoaded = false;
  let currentAudioUrl: string | null = null;

  const { store, setSelection, setCurrentTime, setPlaying } = useAudioStore();

  createEffect(() => {
    const container = containerRef();
    if (!container) return;
    if (isInitialized || wavesurfer !== null) return;
    isInitialized = true;

    wavesurfer = WaveSurfer.create({
      container,
      waveColor: "#30363d",
      progressColor: "#4a9eff",
      cursorColor: "#ffffff",
      cursorWidth: 3,
      barWidth: 2,
      barRadius: 1,
      height: 200,
      normalize: true,
      interact: true,
      dragToSeek: false,
    });

    regionsPlugin = wavesurfer.registerPlugin(RegionsPlugin.create());

    wavesurfer.on("ready", () => {
      isAudioLoaded = true;
      if (dragSelectionCleanup) {
        dragSelectionCleanup();
        dragSelectionCleanup = null;
      }
      if (regionsPlugin) {
        regionsPlugin.clearRegions();
        setSelection(null);

        dragSelectionCleanup = regionsPlugin.enableDragSelection({
          color: "rgba(74, 158, 255, 0.3)",
          drag: true,
          resize: false,
        });
      }
    });

    wavesurfer.on("play", () => {
      setPlaying(true);
    });

    wavesurfer.on("pause", () => {
      setPlaying(false);
      try {
        const time = wavesurfer?.getCurrentTime() || 0;
        pausedTime = time;
        setCurrentTime(time);
      } catch {
        setCurrentTime(0);
      }
    });

    wavesurfer.on("finish", () => {
      setPlaying(false);
      try {
        const dur = wavesurfer?.getDuration() || 0;
        if (dur > 0) {
          setCurrentTime(
            Math.max(dur, store.tracks.find((t) => t.id === store.currentTrackId)?.duration || dur)
          );
        }
      } catch {}
    });

    wavesurfer.on("timeupdate", (time) => {
      if (isSeeking || !store.isPlaying) return;
      try {
        const dur = wavesurfer?.getDuration() || 0;
        if (dur > 0 && time >= dur - 0.01) {
          setCurrentTime(dur);
        } else {
          setCurrentTime(time);
        }
      } catch {
        setCurrentTime(time);
      }
    });

    wavesurfer.on("seeking", (time) => {
      if (seekingTimeoutId) {
        clearTimeout(seekingTimeoutId);
      }
      isSeeking = true;
      pausedTime = null;
      setCurrentTime(time);
      seekingTimeoutId = setTimeout(() => {
        isSeeking = false;
        seekingTimeoutId = null;
      }, 100);
    });

    wavesurfer.on("click", (relativeX) => {
      if (isDragging) {
        isDragging = false;
        return;
      }

      const duration = wavesurfer?.getDuration() || 0;
      if (duration > 0) {
        const newTime = relativeX * duration;
        pausedTime = null;
        setCurrentTime(newTime);
        wavesurfer?.seekTo(relativeX);
      }
    });

    regionsPlugin.on("region-initialized", (region) => {
      if (!region) return;
      isDragging = true;
      const existingRegions = regionsPlugin?.getRegions() || [];
      existingRegions.forEach((r) => {
        if (r.id !== region.id) {
          r.remove();
        }
      });
    });

    regionsPlugin.on("region-created", (region) => {
      if (!region) return;
      isDragging = false;
      originalRegionWidth = region.end - region.start;
      region.setOptions({
        drag: true,
        resize: false,
      });
      setSelection({
        start: region.start,
        end: region.end,
      });
    });

    regionsPlugin.on("region-clicked", (region) => {
      if (!region) return;
      originalRegionWidth = region.end - region.start;
      setSelection({
        start: region.start,
        end: region.end,
      });
    });

    regionsPlugin.on("region-update", (region) => {
      if (originalRegionWidth === null && region) {
        originalRegionWidth = region.end - region.start;
      }
    });

    regionsPlugin.on("region-updated", (region) => {
      if (!region) return;
      const duration = wavesurfer?.getDuration() || 0;
      if (duration <= 0) {
        setSelection({
          start: region.start,
          end: region.end,
        });
        return;
      }

      if (originalRegionWidth === null) {
        originalRegionWidth = region.end - region.start;
      }

      const regionWidth = originalRegionWidth;
      const currentWidth = region.end - region.start;
      const widthChanged = Math.abs(currentWidth - regionWidth) > 0.001;

      let desiredStart = region.start;
      let clampedStart = Math.max(0, Math.min(desiredStart, duration - regionWidth));
      let clampedEnd = clampedStart + regionWidth;

      if (clampedEnd > duration) {
        clampedEnd = duration;
        clampedStart = Math.max(0, duration - regionWidth);
      }

      if (clampedStart < 0) {
        clampedStart = 0;
        clampedEnd = Math.min(duration, regionWidth);
      }

      const now = performance.now();
      const needsClamping =
        widthChanged ||
        Math.abs(region.start - clampedStart) > 0.001 ||
        Math.abs(region.end - clampedEnd) > 0.001;

      if (needsClamping) {
        if (widthChanged || now - lastClampTime > 16) {
          lastClampTime = now;
          region.setOptions({ start: clampedStart, end: clampedEnd });
        }
      }

      setSelection({
        start: clampedStart,
        end: clampedEnd,
      });
    });

    regionsPlugin.on("region-removed", () => {
      isDragging = false;
      setSelection(null);
    });

    return () => {};
  });

  onCleanup(() => {
    if (seekingTimeoutId) {
      clearTimeout(seekingTimeoutId);
      seekingTimeoutId = null;
    }
    if (dragSelectionCleanup) {
      dragSelectionCleanup();
      dragSelectionCleanup = null;
    }
    if (wavesurfer) {
      try {
        wavesurfer.destroy();
      } catch {}
      wavesurfer = null;
      regionsPlugin = null;
    }
    if (currentLoadAbortController) {
      currentLoadAbortController.abort();
      currentLoadAbortController = null;
    }
    isInitialized = false;
    isAudioLoaded = false;
    currentAudioUrl = null;
  });

  const loadAudio = async (url: string) => {
    if (!wavesurfer) return;
    if (currentAudioUrl === url && isAudioLoaded) return;

    if (currentLoadAbortController) {
      currentLoadAbortController.abort();
      currentLoadAbortController = null;
    }

    const wasPlaying = store.isPlaying;
    const previousUrl = currentAudioUrl;

    currentAudioUrl = url;
    const abortController = new AbortController();
    currentLoadAbortController = abortController;

    try {
      isAudioLoaded = false;

      await wavesurfer.load(url);

      if (abortController.signal.aborted) {
        currentAudioUrl = null;
        return;
      }

      if (previousUrl !== null && previousUrl !== url) {
        setCurrentTime(0);
        pausedTime = null;
        wavesurfer.seekTo(0);
        if (wasPlaying) {
          wavesurfer.play();
        }
      } else {
        const currentTime = store.currentTime;
        const duration = wavesurfer.getDuration();
        if (duration > 0 && currentTime > 0) {
          wavesurfer.seekTo(Math.max(0, Math.min(1, currentTime / duration)));
        }
        if (wasPlaying && duration > 0) {
          wavesurfer.play();
        }
      }
    } catch (err) {
      if (abortController.signal.aborted || isAbortError(err)) return;
      console.error("Failed to load audio:", err);
      isAudioLoaded = false;
      currentAudioUrl = null;
    } finally {
      if (abortController === currentLoadAbortController) {
        currentLoadAbortController = null;
      }
    }
  };

  const play = () => {
    if (!wavesurfer) return;
    try {
      const duration = wavesurfer.getDuration();
      if (!duration || duration <= 0) return;

      let resumeTime = pausedTime !== null ? pausedTime : store.currentTime;
      pausedTime = null;

      if (resumeTime >= duration - 0.01) {
        resumeTime = 0;
      }

      const clampedTime = Math.max(0, Math.min(duration, resumeTime));
      const seekPosition = clampedTime / duration;
      wavesurfer.seekTo(seekPosition);
      setCurrentTime(clampedTime);

      wavesurfer.play();
    } catch {}
  };

  const pause = () => {
    if (!wavesurfer) return;
    try {
      wavesurfer.pause();
    } catch {}
  };

  const stop = () => {
    if (!wavesurfer) return;
    try {
      wavesurfer.stop();
      setCurrentTime(0);
    } catch {
      setCurrentTime(0);
    }
  };

  const seekTo = (normalizedPosition: number) => {
    if (!wavesurfer) return;
    try {
      const duration = wavesurfer.getDuration();
      if (!duration || duration <= 0) return;

      const clampedPosition = Math.max(0, Math.min(1, normalizedPosition));
      const seekTime = clampedPosition * duration;
      pausedTime = null;
      wavesurfer.seekTo(clampedPosition);
      setCurrentTime(seekTime);
    } catch {}
  };

  const setZoom = (zoom: number) => {
    if (!wavesurfer || !isAudioLoaded) return;
    try {
      const duration = wavesurfer.getDuration();
      if (!duration || duration <= 0) {
        isAudioLoaded = false;
        return;
      }
      wavesurfer.zoom(zoom);
    } catch (err) {
      isAudioLoaded = false;
      if (
        isAbortError(err) ||
        (err instanceof Error &&
          (err.message.includes("No audio loaded") || err.message.includes("aborted")))
      ) {
        return;
      }
    }
  };

  const clearSelection = () => {
    if (!regionsPlugin) return;
    regionsPlugin.clearRegions();
    setSelection(null);
  };

  const clearAudio = () => {
    if (!wavesurfer) return;
    isAudioLoaded = false;
    currentAudioUrl = null;
    if (currentLoadAbortController) {
      currentLoadAbortController.abort();
      currentLoadAbortController = null;
    }

    try {
      wavesurfer.stop();
    } catch {}
    try {
      wavesurfer.seekTo(0);
    } catch {}
    try {
      wavesurfer.empty();
    } catch {}
    if (regionsPlugin) {
      regionsPlugin.clearRegions();
    }
    if (dragSelectionCleanup) {
      dragSelectionCleanup();
      dragSelectionCleanup = null;
    }
    setSelection(null);
    setCurrentTime(0);
    setPlaying(false);
    pausedTime = null;
  };

  createEffect(() => {
    const currentTrack = store.tracks.find((t) => t.id === store.currentTrackId);
    const audioUrl = currentTrack?.audioUrl;
    const tracksLength = store.tracks.length;
    if (!wavesurfer) return;
    if (audioUrl && currentAudioUrl !== audioUrl) {
      loadAudio(audioUrl);
    } else if (!audioUrl && tracksLength === 0) {
      clearAudio();
    }
  });

  createEffect(() => {
    if (!wavesurfer || !isAudioLoaded) return;
    setZoom(store.zoom);
  });

  return {
    loadAudio,
    play,
    pause,
    stop,
    seekTo,
    setZoom,
    clearSelection,
    clearAudio,
  };
};
