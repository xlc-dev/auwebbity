import { onCleanup, createEffect } from "solid-js";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";
import { useAudioStore } from "../stores/audioStore";
import { isAbortError } from "../utils/errorUtils";

export const useWaveform = (
  containerRef: () => HTMLDivElement | undefined,
  options?: { autoLoad?: boolean; isCurrent?: boolean }
) => {
  const autoLoad = options?.autoLoad !== false;
  const isCurrent = options?.isCurrent ?? true;
  let wavesurfer: WaveSurfer | null = null;
  let regionsPlugin: RegionsPlugin | null = null;
  let dragSelectionCleanup: (() => void) | null = null;
  let isSeeking = false;
  let seekingTimeoutId: ReturnType<typeof setTimeout> | null = null;
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
      cursorColor: "transparent",
      cursorWidth: 0,
      barWidth: 2,
      barRadius: 1,
      height: 200,
      normalize: true,
      interact: isCurrent,
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

        if (isCurrent) {
          dragSelectionCleanup = regionsPlugin.enableDragSelection({
            color: "rgba(74, 158, 255, 0.3)",
            drag: true,
            resize: false,
          });
        }
      }

      const duration = wavesurfer.getDuration() || 0;
      if (duration > 0) {
        const currentTime = store.currentTime;
        const progress = Math.max(0, Math.min(1, currentTime / duration));
        try {
          wavesurfer.seekTo(progress);
        } catch (err) {
          console.warn("Failed to seek on ready:", err);
        }
      }
    });

    wavesurfer.on("play", () => {
      if (isCurrent) {
        setPlaying(true);
      }
    });

    wavesurfer.on("pause", () => {
      if (isCurrent) {
        setPlaying(false);
        try {
          const time = wavesurfer?.getCurrentTime() || 0;
          setCurrentTime(time);
        } catch {
          setCurrentTime(0);
        }
      }
    });

    wavesurfer.on("finish", () => {
      try {
        const maxDur =
          store.tracks.length > 0 ? Math.max(...store.tracks.map((t) => t.duration), 0) : 0;
        if (maxDur > 0) {
          const trackDuration = wavesurfer?.getDuration() || 0;
          setCurrentTime(Math.max(store.currentTime, trackDuration));
          if (trackDuration >= maxDur - 0.01) {
            setCurrentTime(maxDur);
            if (isCurrent) {
              setPlaying(false);
            }
          }
        }
      } catch {}
    });

    wavesurfer.on("timeupdate", (time) => {
      if (isSeeking) return;
      const isWaveformPlaying = wavesurfer?.isPlaying() ?? false;
      if (!isWaveformPlaying && !store.isPlaying) return;
      try {
        const maxDur =
          store.tracks.length > 0 ? Math.max(...store.tracks.map((t) => t.duration), 0) : 0;
        if (maxDur > 0) {
          const currentMaxTime = Math.max(time, store.currentTime);
          if (currentMaxTime >= maxDur - 0.01) {
            setCurrentTime(maxDur);
            if (isCurrent) {
              setPlaying(false);
            }
          } else {
            setCurrentTime(currentMaxTime);
          }
        } else {
          setCurrentTime(time);
        }
      } catch {
        setCurrentTime(time);
      }
    });

    createEffect(() => {
      if (!wavesurfer || !isAudioLoaded) return;
      if (!isCurrent) return;

      const duration = wavesurfer.getDuration() || 0;
      if (duration <= 0) return;

      const currentTime = store.currentTime;
      const progress = Math.max(0, Math.min(1, currentTime / duration));

      const isWaveformPlaying = wavesurfer.isPlaying();
      if (isWaveformPlaying && store.isPlaying) {
        const waveformTime = wavesurfer.getCurrentTime() || 0;
        const timeDiff = Math.abs(waveformTime - currentTime);
        if (timeDiff < 0.1) {
          return;
        }
      }

      try {
        wavesurfer.seekTo(progress);
      } catch (err) {
        console.warn("Failed to seek waveform:", err);
      }

      if (store.isPlaying) {
        try {
          const duration = wavesurfer.getDuration() || 0;
          if (duration > 0) {
            const currentTime = store.currentTime;
            const clampedTime = Math.max(0, Math.min(duration, currentTime));
            const seekPosition = clampedTime / duration;

            const currentPos = wavesurfer.getCurrentTime() / duration;
            if (Math.abs(currentPos - seekPosition) > 0.001) {
              wavesurfer.seekTo(seekPosition);
            }

            if (!wavesurfer.isPlaying() && clampedTime < duration) {
              wavesurfer.play();
            }
          }
        } catch (err) {
          console.warn("Failed to play waveform:", err);
        }
      } else {
        try {
          if (wavesurfer.isPlaying()) {
            wavesurfer.pause();
          }
        } catch (err) {
          console.warn("Failed to pause waveform:", err);
        }
      }
    });

    wavesurfer.on("seeking", (time) => {
      if (seekingTimeoutId) {
        clearTimeout(seekingTimeoutId);
      }
      isSeeking = true;
      setCurrentTime(time);
      seekingTimeoutId = setTimeout(() => {
        isSeeking = false;
        seekingTimeoutId = null;
      }, 100);
    });

    wavesurfer.on("click", (relativeX) => {
      if (!isCurrent) return;
      if (isDragging) {
        isDragging = false;
        return;
      }

      const duration = wavesurfer?.getDuration() || 0;
      if (duration > 0) {
        const newTime = relativeX * duration;
        setCurrentTime(newTime);
        wavesurfer?.seekTo(relativeX);
      }
    });

    regionsPlugin.on("region-initialized", (region) => {
      if (!region || !isCurrent) return;
      isDragging = true;
      const existingRegions = regionsPlugin?.getRegions() || [];
      existingRegions.forEach((r) => {
        if (r.id !== region.id) {
          r.remove();
        }
      });
    });

    regionsPlugin.on("region-created", (region) => {
      if (!region || !isCurrent) return;
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
      if (!region || !isCurrent) return;
      originalRegionWidth = region.end - region.start;
      setSelection({
        start: region.start,
        end: region.end,
      });
    });

    regionsPlugin.on("region-update", (region) => {
      if (!isCurrent) return;
      if (originalRegionWidth === null && region) {
        originalRegionWidth = region.end - region.start;
      }
    });

    regionsPlugin.on("region-updated", (region) => {
      if (!region || !isCurrent) return;
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

      const duration = wavesurfer.getDuration();

      if (previousUrl !== null && previousUrl !== url) {
        setCurrentTime(0);
        wavesurfer.seekTo(0);
        if (wasPlaying) {
          wavesurfer.play();
        }
      } else {
        if (duration > 0) {
          const currentTime = store.currentTime;
          const progress = Math.max(0, Math.min(1, currentTime / duration));
          wavesurfer.seekTo(progress);
        }
        if (wasPlaying && duration > 0) {
          wavesurfer.play();
        }
      }

      if (duration > 0) {
        const currentTime = store.currentTime;
        const progress = Math.max(0, Math.min(1, currentTime / duration));
        requestAnimationFrame(() => {
          try {
            wavesurfer?.seekTo(progress);
          } catch (err) {
            console.warn("Failed to seek after load:", err);
          }
        });
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
    if (!wavesurfer || !isAudioLoaded) return;
    try {
      const duration = wavesurfer.getDuration();
      if (!duration || duration <= 0) return;

      const maxDur =
        store.tracks.length > 0 ? Math.max(...store.tracks.map((t) => t.duration), 0) : 0;

      // If we're at or past the end, restart from the beginning
      let currentTime = store.currentTime;
      if (maxDur > 0 && currentTime >= maxDur - 0.01) {
        currentTime = 0;
        setCurrentTime(0);
      }

      const clampedTime = Math.max(0, Math.min(duration, currentTime));
      const seekPosition = clampedTime / duration;

      wavesurfer.seekTo(seekPosition);
      wavesurfer.play();

      if (isCurrent) {
        setCurrentTime(clampedTime);
        setPlaying(true);
      }
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
      if (isCurrent) {
        setCurrentTime(0);
      }
    } catch {
      if (isCurrent) {
        setCurrentTime(0);
      }
    }
  };

  const seekTo = (normalizedPosition: number) => {
    if (!wavesurfer) return;
    try {
      const duration = wavesurfer.getDuration();
      if (!duration || duration <= 0) return;

      const clampedPosition = Math.max(0, Math.min(1, normalizedPosition));
      const seekTime = clampedPosition * duration;
      wavesurfer.seekTo(clampedPosition);
      if (isCurrent) {
        setCurrentTime(seekTime);
      }
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
  };

  createEffect(() => {
    if (!autoLoad) return;
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
    const duration = wavesurfer.getDuration();
    if (!duration || duration <= 0) return;

    const container = containerRef();
    if (!container) return;

    const maxDuration = Math.max(...store.tracks.map((t) => t.duration), 0);
    if (maxDuration <= 0) return;

    const containerWidth =
      container.parentElement?.offsetWidth || container.parentElement?.clientWidth || 0;
    if (containerWidth <= 0) return;

    const pixelsPerSecond = (containerWidth / maxDuration) * (store.zoom / 100);
    const zoomForThisTrack = pixelsPerSecond;

    try {
      wavesurfer.zoom(zoomForThisTrack);
    } catch (err) {
      if (
        isAbortError(err) ||
        (err instanceof Error &&
          (err.message.includes("No audio loaded") || err.message.includes("aborted")))
      ) {
        return;
      }
    }
  });

  createEffect(() => {
    if (!wavesurfer || !isAudioLoaded) return;
    const wrapper = wavesurfer.getWrapper();
    if (!wrapper) return;

    const hideCursor = () => {
      try {
        const cursorElements = wrapper.querySelectorAll('[data-name="cursor"]');
        cursorElements.forEach((el) => {
          (el as HTMLElement).style.display = "none";
          (el as HTMLElement).style.visibility = "hidden";
          (el as HTMLElement).style.opacity = "0";
        });
      } catch {}
    };

    hideCursor();

    const observer = new MutationObserver(hideCursor);
    observer.observe(wrapper, { childList: true, subtree: true });

    return () => observer.disconnect();
  });

  createEffect(() => {
    if (!regionsPlugin || !isAudioLoaded) return;
    const selection = store.selection;
    const currentRegions = regionsPlugin.getRegions();

    if (!selection) {
      if (currentRegions.length > 0) {
        regionsPlugin.clearRegions();
      }
      return;
    }

    const duration = wavesurfer?.getDuration() || 0;
    if (duration <= 0) return;

    if (currentRegions.length === 0) {
      regionsPlugin.addRegion({
        start: selection.start,
        end: selection.end,
        color: "rgba(74, 158, 255, 0.3)",
        drag: isCurrent,
        resize: false,
      });
    } else {
      const region = currentRegions[0];
      if (
        region &&
        (Math.abs(region.start - selection.start) > 0.001 ||
          Math.abs(region.end - selection.end) > 0.001)
      ) {
        region.setOptions({
          start: selection.start,
          end: selection.end,
        });
      }
    }
  });

  const getCurrentTime = () => {
    if (!wavesurfer || !isAudioLoaded) return 0;
    try {
      return wavesurfer.getCurrentTime() || 0;
    } catch {
      return 0;
    }
  };

  const isPlaying = () => {
    if (!wavesurfer) return false;
    try {
      return wavesurfer.isPlaying();
    } catch {
      return false;
    }
  };

  return {
    loadAudio,
    play,
    pause,
    stop,
    seekTo,
    setZoom,
    clearSelection,
    clearAudio,
    getCurrentTime,
    isPlaying,
  };
};
