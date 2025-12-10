import { onCleanup, createEffect } from "solid-js";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";
import { useAudioStore } from "../stores/audioStore";

export const useWaveform = (containerRef: () => HTMLDivElement | undefined) => {
  let wavesurfer: WaveSurfer | null = null;
  let regionsPlugin: RegionsPlugin | null = null;
  let dragSelectionCleanup: (() => void) | null = null;
  let isSeeking = false;
  let pausedTime: number | null = null;
  let isDragging = false;
  let originalRegionWidth: number | null = null;
  let lastClampTime = 0;
  let isInitialized = false;
  let currentLoadAbortController: AbortController | null = null;
  let isLoading = false;
  let isAudioLoaded = false;

  const { store, setSelection, setCurrentTime, setPlaying } = useAudioStore();

  createEffect(() => {
    const container = containerRef();
    if (!container) return;
    if (isInitialized) return;
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
      console.log("Waveform ready");
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
        console.log("Drag selection enabled");
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
      isSeeking = true;
      pausedTime = null;
      setCurrentTime(time);
      setTimeout(() => {
        isSeeking = false;
      }, 150);
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
        isSeeking = true;
        wavesurfer?.seekTo(relativeX);
        setTimeout(() => {
          isSeeking = false;
        }, 100);
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

    return () => {
      if (wavesurfer) {
        wavesurfer.destroy();
        wavesurfer = null;
        regionsPlugin = null;
        isInitialized = false;
      }
    };
  });

  const loadAudio = async (url: string) => {
    if (!wavesurfer || isLoading) return;

    isLoading = true;

    if (currentLoadAbortController) {
      currentLoadAbortController.abort();
      currentLoadAbortController = null;
    }

    const abortController = new AbortController();
    currentLoadAbortController = abortController;

    try {
      const wasPlaying = store.isPlaying;
      let currentTime = store.currentTime;
      try {
        currentTime = wavesurfer.getCurrentTime() || store.currentTime;
      } catch {
        currentTime = store.currentTime;
      }

      isAudioLoaded = false;
      try {
        await wavesurfer.load(url);
      } catch (loadErr) {
        isAudioLoaded = false;
        if (
          loadErr instanceof Error &&
          (loadErr.name === "AbortError" ||
            loadErr.message.includes("aborted") ||
            loadErr.message.includes("signal is aborted"))
        ) {
          isLoading = false;
          if (abortController === currentLoadAbortController) {
            currentLoadAbortController = null;
          }
          return;
        }
        if (loadErr instanceof DOMException && loadErr.name === "AbortError") {
          isLoading = false;
          if (abortController === currentLoadAbortController) {
            currentLoadAbortController = null;
          }
          return;
        }
        throw loadErr;
      }

      if (abortController.signal.aborted) {
        isAudioLoaded = false;
        isLoading = false;
        if (abortController === currentLoadAbortController) {
          currentLoadAbortController = null;
        }
        return;
      }

      if (wasPlaying) {
        try {
          const duration = wavesurfer.getDuration();
          if (duration > 0) {
            const seekPosition = Math.max(0, Math.min(1, currentTime / duration));
            wavesurfer.seekTo(seekPosition);
            wavesurfer.play();
          }
        } catch {}
      } else if (currentTime > 0) {
        try {
          const duration = wavesurfer.getDuration();
          if (duration > 0) {
            const seekPosition = Math.max(0, Math.min(1, currentTime / duration));
            wavesurfer.seekTo(seekPosition);
          }
        } catch {}
      }

      if (abortController === currentLoadAbortController) {
        currentLoadAbortController = null;
      }
      isLoading = false;
    } catch (err) {
      isLoading = false;
      if (abortController === currentLoadAbortController) {
        currentLoadAbortController = null;
      }
      if (
        err instanceof Error &&
        (err.name === "AbortError" ||
          err.message.includes("aborted") ||
          err.message.includes("signal is aborted"))
      ) {
        return;
      }
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      console.error("Failed to load audio:", err);
    }
  };

  const play = () => {
    if (!wavesurfer) return;
    try {
      const duration = wavesurfer.getDuration();
      if (!duration || duration <= 0) return;

      const resumeTime = pausedTime !== null ? pausedTime : store.currentTime;
      pausedTime = null;

      const clampedTime = Math.max(0, Math.min(duration, resumeTime));
      const seekPosition = clampedTime / duration;

      isSeeking = true;
      wavesurfer.seekTo(seekPosition);
      setCurrentTime(clampedTime);

      setTimeout(() => {
        isSeeking = false;
      }, 100);

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
      isSeeking = true;
      wavesurfer.seekTo(clampedPosition);
      setCurrentTime(seekTime);

      setTimeout(() => {
        isSeeking = false;
      }, 100);
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
        err instanceof Error &&
        (err.message.includes("No audio loaded") ||
          err.message.includes("aborted") ||
          err.name === "AbortError")
      ) {
        return;
      }
      if (err instanceof DOMException && err.name === "AbortError") {
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

    isLoading = false;
    isAudioLoaded = false;

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

  onCleanup(() => {
    if (dragSelectionCleanup) {
      dragSelectionCleanup();
    }
    wavesurfer?.destroy();
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
