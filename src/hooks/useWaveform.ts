import { onCleanup, onMount } from "solid-js";
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
  let lastValidStart: number | null = null;
  let lastValidEnd: number | null = null;

  const { store, setSelection, setCurrentTime, setPlaying } = useAudioStore();

  onMount(() => {
    const container = containerRef();
    if (!container) return;

    wavesurfer = WaveSurfer.create({
      container,
      waveColor: "#30363d",
      progressColor: "#4a9eff",
      cursorColor: "#c9d1d9",
      barWidth: 2,
      barRadius: 1,
      responsive: true,
      height: 200,
      normalize: true,
      interact: true,
      dragToSeek: false,
    });

    regionsPlugin = wavesurfer.registerPlugin(RegionsPlugin.create());

    wavesurfer.on("ready", () => {
      console.log("Waveform ready");
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
      const time = wavesurfer?.getCurrentTime() || 0;
      pausedTime = time;
      setCurrentTime(time);
    });

    wavesurfer.on("finish", () => {
      setPlaying(false);
      const dur = wavesurfer?.getDuration() || 0;
      if (dur > 0) {
        setCurrentTime(
          Math.max(dur, store.tracks.find((t) => t.id === store.currentTrackId)?.duration || dur)
        );
      }
    });

    wavesurfer.on("timeupdate", (time) => {
      if (isSeeking || !store.isPlaying) return;
      const dur = wavesurfer?.getDuration() || 0;
      if (dur > 0 && time >= dur - 0.01) {
        setCurrentTime(dur);
      } else {
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

    wavesurfer.on("click", (relativeX, event) => {
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
        wavesurfer.seekTo(relativeX);
        setTimeout(() => {
          isSeeking = false;
        }, 100);
      }
    });

    regionsPlugin.on("region-initialized", (region) => {
      isDragging = true;
      const existingRegions = regionsPlugin?.getRegions() || [];
      existingRegions.forEach((r) => {
        if (r.id !== region.id) {
          r.remove();
        }
      });
    });

    regionsPlugin.on("region-created", (region) => {
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
      originalRegionWidth = region.end - region.start;
    });

    regionsPlugin.on("region-update-start", (region) => {
      if (originalRegionWidth === null) {
        originalRegionWidth = region.end - region.start;
      }
      lastValidStart = region.start;
      lastValidEnd = region.end;
    });

    regionsPlugin.on("region-updated", (region) => {
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

      lastValidStart = clampedStart;
      lastValidEnd = clampedEnd;

      const now = performance.now();
      const needsClamping = widthChanged ||
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

    regionsPlugin.on("region-update-end", (region) => {
      const duration = wavesurfer?.getDuration() || 0;
      if (duration > 0 && originalRegionWidth !== null) {
        const regionWidth = originalRegionWidth;
        let clampedStart = Math.max(0, Math.min(region.start, duration - regionWidth));
        let clampedEnd = clampedStart + regionWidth;

        if (clampedEnd > duration) {
          clampedEnd = duration;
          clampedStart = Math.max(0, duration - regionWidth);
        }

        if (
          Math.abs(region.start - clampedStart) > 0.001 ||
          Math.abs(region.end - clampedEnd) > 0.001
        ) {
          region.setOptions({ start: clampedStart, end: clampedEnd });
          setSelection({
            start: clampedStart,
            end: clampedEnd,
          });
        }
      }

      originalRegionWidth = null;
      lastClampTime = 0;
      lastValidStart = null;
      lastValidEnd = null;
    });

    regionsPlugin.on("region-clicked", (region) => {
      setSelection({
        start: region.start,
        end: region.end,
      });
    });

    regionsPlugin.on("region-removed", () => {
      isDragging = false;
      setSelection(null);
    });
  });

  const loadAudio = async (url: string) => {
    if (!wavesurfer) return;
    await wavesurfer.load(url);
  };

  const play = () => {
    if (!wavesurfer) return;
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
  };

  const pause = () => {
    wavesurfer?.pause();
  };

  const stop = () => {
    wavesurfer?.stop();
    setCurrentTime(0);
  };

  const seekTo = (normalizedPosition: number) => {
    if (!wavesurfer) return;
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
  };

  const setZoom = (zoom: number) => {
    if (!wavesurfer) return;
    wavesurfer.zoom(zoom);
  };

  const clearSelection = () => {
    if (!regionsPlugin) return;
    regionsPlugin.clearRegions();
    setSelection(null);
  };

  const clearAudio = () => {
    if (!wavesurfer) return;
    wavesurfer.stop();
    wavesurfer.seekTo(0);
    wavesurfer.empty();
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
