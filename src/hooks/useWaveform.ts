import { onCleanup, createEffect } from "solid-js";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";
import SpectrogramPlugin from "wavesurfer.js/dist/plugins/spectrogram.esm.js";
import { useAudioStore, type WaveformRenderer } from "../stores/audioStore";
import { isAbortError } from "../utils/errorUtils";

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result || !result[1] || !result[2] || !result[3]) {
    return null;
  }
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

function darkenColor(hex: string, factor: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return rgbToHex(
    Math.max(0, Math.floor(rgb.r * factor)),
    Math.max(0, Math.floor(rgb.g * factor)),
    Math.max(0, Math.floor(rgb.b * factor))
  );
}

function lightenColor(hex: string, factor: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return rgbToHex(
    Math.min(255, Math.floor(rgb.r + (255 - rgb.r) * factor)),
    Math.min(255, Math.floor(rgb.g + (255 - rgb.g) * factor)),
    Math.min(255, Math.floor(rgb.b + (255 - rgb.b) * factor))
  );
}

function getWaveformColors(bgColor: string | null | undefined): {
  waveColor: string;
  progressColor: string;
} {
  if (!bgColor) {
    return {
      waveColor: "#30363d",
      progressColor: "#4a9eff",
    };
  }

  const darkened = darkenColor(bgColor, 0.3);
  const lightened = lightenColor(bgColor, 0.4);
  return {
    waveColor: darkened,
    progressColor: lightened,
  };
}

export const useWaveform = (
  containerRef: () => HTMLDivElement | undefined,
  options?: {
    autoLoad?: boolean;
    isCurrent?: boolean;
    trackId?: string;
    onTrackSelect?: (trackId: string) => void;
    backgroundColor?: string | null;
    onSelectionCreated?: (trackId: string) => void;
    renderer?: WaveformRenderer | (() => WaveformRenderer);
  }
) => {
  const autoLoad = options?.autoLoad !== false;
  const isCurrent = options?.isCurrent ?? true;
  const trackId = options?.trackId;
  const onTrackSelect = options?.onTrackSelect;
  const backgroundColor = options?.backgroundColor;
  const onSelectionCreated = options?.onSelectionCreated;
  let wavesurfer: WaveSurfer | null = null;
  let regionsPlugin: RegionsPlugin | null = null;
  let spectrogramPlugin: any | null = null;
  let dragSelectionCleanup: (() => void) | null = null;
  let isSeeking = false;
  let seekingTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let originalRegionWidth: number | null = null;
  let lastClampTime = 0;
  let isInitialized = false;
  let currentLoadAbortController: AbortController | null = null;
  let isAudioLoaded = false;
  let currentAudioUrl: string | null = null;
  let volumeUpdateTimeout: ReturnType<typeof setTimeout> | null = null;
  let lastEffectiveVolume: number | null = null;
  let upMixerNode: GainNode | null = null;
  let splitterNode: ChannelSplitterNode | null = null;
  let mergerNode: ChannelMergerNode | null = null;
  let leftGainNode: GainNode | null = null;
  let rightGainNode: GainNode | null = null;
  let lastPan: number | null = null;
  let customAudioContext: AudioContext | null = null;
  let customMediaSource: MediaElementAudioSourceNode | null = null;
  let isSettingUpPanning = false;
  const getRenderer = (): WaveformRenderer => {
    const renderer = options?.renderer;
    return typeof renderer === "function" ? renderer() : (renderer ?? "bars");
  };
  let currentRenderer: WaveformRenderer = getRenderer();

  const { store, setSelection, setCurrentTime, setPlaying } = useAudioStore();

  const createWaveform = (
    container: HTMLDivElement,
    rendererType: WaveformRenderer
  ): { instance: WaveSurfer; regionsPlugin: RegionsPlugin } => {
    const colors = getWaveformColors(backgroundColor);

    const baseOptions: any = {
      container,
      waveColor: colors.waveColor,
      progressColor: colors.progressColor,
      cursorColor: "transparent",
      cursorWidth: 0,
      height: 200,
      normalize: true,
      interact: false,
      dragToSeek: false,
    };

    if (rendererType === "line") {
      baseOptions.renderer = "line";
      baseOptions.lineWidth = 1;
    } else if (rendererType === "spectrogram") {
      baseOptions.renderer = "bars";
      baseOptions.barWidth = 2;
      baseOptions.barRadius = 1;
    } else {
      baseOptions.barWidth = 2;
      baseOptions.barRadius = 1;
    }

    const instance = WaveSurfer.create(baseOptions);

    const newRegionsPlugin = instance.registerPlugin(RegionsPlugin.create());
    regionsPlugin = newRegionsPlugin;

    if (rendererType === "spectrogram") {
      spectrogramPlugin = instance.registerPlugin(
        SpectrogramPlugin.create({
          labels: true,
          height: 200,
          splitChannels: false,
        })
      );
    }

    return { instance, regionsPlugin: newRegionsPlugin };
  };

  createEffect(() => {
    const container = containerRef();
    if (!container) return;
    if (isInitialized || wavesurfer !== null) return;
    isInitialized = true;

    const renderer = getRenderer();
    const waveformResult = createWaveform(container, renderer);
    wavesurfer = waveformResult.instance;
    regionsPlugin = waveformResult.regionsPlugin;
    currentRenderer = renderer;

    const setupPanning = () => {
        try {
          if (isSettingUpPanning) {
            return;
          }
          isSettingUpPanning = true;

          if (!wavesurfer || !isAudioLoaded) {
            isSettingUpPanning = false;
            return;
          }

          const media = (wavesurfer as any).media;
          const mediaElement = media instanceof HTMLAudioElement ? media : null;

          if (!mediaElement) {
            isSettingUpPanning = false;
            return;
          }

          if (splitterNode && leftGainNode && rightGainNode && upMixerNode) {
            isSettingUpPanning = false;
            return;
          }

          if (!customAudioContext) {
            customAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          }

          if (!customMediaSource) {
            try {
              customMediaSource = customAudioContext.createMediaElementSource(mediaElement);
            } catch (sourceErr) {
              if (sourceErr instanceof Error && sourceErr.message.includes("already connected")) {
                isSettingUpPanning = false;
                return;
              }
              throw sourceErr;
            }
          }

          setupSplitterMergerPanning(customAudioContext, customMediaSource);
          isSettingUpPanning = false;
        } catch (err) {
          isSettingUpPanning = false;
        }
      };

    const disconnectNode = (node: AudioNode | null) => {
      if (node) {
        try {
          node.disconnect();
        } catch {}
      }
    };

    const setupSplitterMergerPanning = (audioContext: AudioContext, gainNode: AudioNode) => {
        try {
          disconnectNode(upMixerNode);
          upMixerNode = null;
          disconnectNode(splitterNode);
          splitterNode = null;
          disconnectNode(mergerNode);
          mergerNode = null;
          disconnectNode(leftGainNode);
          leftGainNode = null;
          disconnectNode(rightGainNode);
          rightGainNode = null;

          const destination = audioContext.destination;

          upMixerNode = audioContext.createGain();
          upMixerNode.channelCount = 2;
          upMixerNode.channelCountMode = "explicit";
          upMixerNode.channelInterpretation = "speakers";

          splitterNode = audioContext.createChannelSplitter(2);
          mergerNode = audioContext.createChannelMerger(2);
          leftGainNode = audioContext.createGain();
          rightGainNode = audioContext.createGain();

          if (gainNode.disconnect) {
            try {
              gainNode.disconnect();
            } catch {}
          }

          gainNode.connect(upMixerNode);
          upMixerNode.connect(splitterNode);
          splitterNode.connect(leftGainNode, 0);
          splitterNode.connect(rightGainNode, 1);
          leftGainNode.connect(mergerNode, 0, 0);
          rightGainNode.connect(mergerNode, 0, 1);
          mergerNode.connect(destination);

          if (trackId) {
            const tracks = store.tracks;
            const track = tracks.find((t) => t.id === trackId);
            if (track) {
              const pan = track.pan ?? 0;
              const panValue = Math.max(-1, Math.min(1, isNaN(pan) || !isFinite(pan) ? 0 : pan));
              leftGainNode.gain.value = panValue > 0 ? 1 - panValue : 1;
              rightGainNode.gain.value = panValue > 0 ? 1 : 1 + panValue;
            }
          }
        } catch (err) {
        }
      };

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

      const duration = wavesurfer?.getDuration() || 0;
      if (duration > 0 && wavesurfer) {
        const currentTime = store.currentTime;
        const progress = Math.max(0, Math.min(1, currentTime / duration));
        try {
          wavesurfer.seekTo(progress);
        } catch (err) {
        }
      }

      requestAnimationFrame(() => {
        setTimeout(() => {
          if (isAudioLoaded && !isSettingUpPanning && splitterNode === null) {
            setupPanning();
          }
        }, 200);
      });

      if (trackId && wavesurfer) {
        const tracks = store.tracks;
        const track = tracks.find((t) => t.id === trackId);
        if (track) {
          const volume = track.volume;
          const muted = track.muted;
          const pan = track.pan ?? 0;
          if (!isNaN(volume) && isFinite(volume)) {
            const effectiveVolume = muted ? 0 : Math.max(0, Math.min(1, volume));
            const effectivePan = Math.max(-1, Math.min(1, isNaN(pan) || !isFinite(pan) ? 0 : pan));
            wavesurfer.setVolume(effectiveVolume);
            lastEffectiveVolume = effectiveVolume;
            lastPan = effectivePan;

            if (splitterNode && leftGainNode && rightGainNode) {
              const panValue = effectivePan;
              leftGainNode.gain.value = panValue > 0 ? 1 - panValue : 1;
              rightGainNode.gain.value = panValue > 0 ? 1 : 1 + panValue;
            }
          }
        }
      }
    });

    wavesurfer.on("play", () => {
      if (isCurrent) {
        setPlaying(true);
      }
      setTimeout(() => {
        if (isAudioLoaded && wavesurfer && !isSettingUpPanning && splitterNode === null) {
          setupPanning();
        }
      }, 100);
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
          const clampedTime = Math.min(time, maxDur);
          const timeToUse = isWaveformPlaying
            ? Math.min(Math.max(clampedTime, store.currentTime), maxDur)
            : Math.min(store.currentTime, maxDur);

          if (store.repeatRegion && isWaveformPlaying) {
            const { start, end } = store.repeatRegion;
            const isWithinRepeatRegion = timeToUse >= start - 0.01 && timeToUse <= end + 0.01;
            if (isWithinRepeatRegion && timeToUse >= end - 0.01) {
              setCurrentTime(start);
              const duration = wavesurfer?.getDuration() || 0;
              if (duration > 0) {
                const seekPosition = start / duration;
                try {
                  wavesurfer?.seekTo(seekPosition);
                } catch {}
              }
              return;
            }
          }

          if (timeToUse >= maxDur - 0.01) {
            setCurrentTime(maxDur);
            if (isCurrent) {
              setPlaying(false);
            }
          } else {
            const finalTime = isWaveformPlaying
              ? Math.min(clampedTime, maxDur)
              : Math.min(timeToUse, maxDur);
            setCurrentTime(finalTime);
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

      const duration = wavesurfer.getDuration() || 0;
      if (duration <= 0) return;

      const currentTime = store.currentTime;
      const progress = Math.max(0, Math.min(1, currentTime / duration));

      const isWaveformPlaying = wavesurfer.isPlaying();
      if (isWaveformPlaying && store.isPlaying && isCurrent) {
        const waveformTime = wavesurfer.getCurrentTime() || 0;
        const timeDiff = Math.abs(waveformTime - currentTime);
        if (timeDiff < 0.1) {
          return;
        }
      }

      try {
        wavesurfer.seekTo(progress);
      } catch (err) {
      }

      if (!isCurrent) return;

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
        }
      } else {
        try {
          if (wavesurfer.isPlaying()) {
            wavesurfer.pause();
          }
        } catch (err) {
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

    if (regionsPlugin) {
      regionsPlugin.on("region-initialized", (region) => {
        if (!region) return;
        if (trackId && onSelectionCreated) {
          onSelectionCreated(trackId);
        }
        const existingRegions = regionsPlugin?.getRegions() || [];
        existingRegions.forEach((r) => {
          if (r.id !== region.id) {
            r.remove();
          }
        });
      });

      regionsPlugin.on("region-created", (region) => {
        if (!region) return;
        if (!isCurrent && trackId && onTrackSelect) {
          onTrackSelect(trackId);
        }
        if (trackId && onSelectionCreated) {
          onSelectionCreated(trackId);
        }
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
        if (!isCurrent && trackId && onTrackSelect) {
          onTrackSelect(trackId);
        }
        if (trackId && onSelectionCreated) {
          onSelectionCreated(trackId);
        }
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
        if (!isCurrent && trackId && onTrackSelect) {
          onTrackSelect(trackId);
        }
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
        setSelection(null);
      });
    }

    return () => {};
  });

  createEffect(() => {
    const renderer = getRenderer();
    if (!wavesurfer || !isAudioLoaded) return;
    if (renderer === currentRenderer) return;

    const container = containerRef();
    if (!container) return;

    const wasPlaying = wavesurfer.isPlaying();
    const currentTime = wavesurfer.getCurrentTime();
    const currentUrl = currentAudioUrl;
    const currentSelection = store.selection;

    try {
      if (dragSelectionCleanup) {
        dragSelectionCleanup();
        dragSelectionCleanup = null;
      }
      if (spectrogramPlugin) {
        wavesurfer.unregisterPlugin(spectrogramPlugin);
        spectrogramPlugin = null;
      }
      wavesurfer.destroy();
    } catch {}

    isInitialized = false;
    isAudioLoaded = false;
    wavesurfer = null;
    regionsPlugin = null;

    isInitialized = true;
    currentRenderer = renderer;
    const waveformResult = createWaveform(container, renderer);
    wavesurfer = waveformResult.instance;
    const newRegionsPlugin = waveformResult.regionsPlugin;
    regionsPlugin = newRegionsPlugin;

    wavesurfer.on("ready", () => {
      isAudioLoaded = true;
      if (newRegionsPlugin) {
        newRegionsPlugin.clearRegions();
        setSelection(null);
        dragSelectionCleanup = newRegionsPlugin.enableDragSelection({
          color: "rgba(74, 158, 255, 0.3)",
          drag: true,
          resize: false,
        });
      }
    });

    wavesurfer.on("play", () => {
      if (isCurrent) {
        setPlaying(true);
      }
      setTimeout(() => {
        if (isAudioLoaded && wavesurfer && !isSettingUpPanning && splitterNode === null) {
          setupPanning();
        }
      }, 100);
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

    wavesurfer.on("timeupdate", (time) => {
      if (isSeeking) return;
      const isWaveformPlaying = wavesurfer?.isPlaying() ?? false;
      if (!isWaveformPlaying && !store.isPlaying) return;
      try {
        const maxDur =
          store.tracks.length > 0 ? Math.max(...store.tracks.map((t) => t.duration), 0) : 0;
        if (maxDur > 0) {
          const clampedTime = Math.min(time, maxDur);
          const timeToUse = isWaveformPlaying
            ? Math.min(Math.max(clampedTime, store.currentTime), maxDur)
            : Math.min(store.currentTime, maxDur);

          if (store.repeatRegion && isWaveformPlaying) {
            const { start, end } = store.repeatRegion;
            const isWithinRepeatRegion = timeToUse >= start - 0.01 && timeToUse <= end + 0.01;
            if (isWithinRepeatRegion && timeToUse >= end - 0.01) {
              setCurrentTime(start);
              const duration = wavesurfer?.getDuration() || 0;
              if (duration > 0) {
                const seekPosition = start / duration;
                try {
                  wavesurfer?.seekTo(seekPosition);
                } catch {}
              }
              return;
            }
          }

          if (timeToUse >= maxDur - 0.01) {
            setCurrentTime(maxDur);
            if (isCurrent) {
              setPlaying(false);
            }
          } else {
            const finalTime = isWaveformPlaying
              ? Math.min(clampedTime, maxDur)
              : Math.min(timeToUse, maxDur);
            setCurrentTime(finalTime);
          }
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
      setCurrentTime(time);
      seekingTimeoutId = setTimeout(() => {
        isSeeking = false;
        seekingTimeoutId = null;
      }, 100);
    });

    if (newRegionsPlugin) {
      newRegionsPlugin.on("region-created", (region: any) => {
        if (!region) return;
        if (!isCurrent && trackId && onTrackSelect) {
          onTrackSelect(trackId);
        }
        if (trackId && onSelectionCreated) {
          onSelectionCreated(trackId);
        }
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

      newRegionsPlugin.on("region-clicked", (region: any) => {
        if (!region) return;
        if (!isCurrent && trackId && onTrackSelect) {
          onTrackSelect(trackId);
        }
        if (trackId && onSelectionCreated) {
          onSelectionCreated(trackId);
        }
        originalRegionWidth = region.end - region.start;
        setSelection({
          start: region.start,
          end: region.end,
        });
      });

      newRegionsPlugin.on("region-updated", (region: any) => {
        if (!region) return;
        if (!isCurrent && trackId && onTrackSelect) {
          onTrackSelect(trackId);
        }
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

      newRegionsPlugin.on("region-removed", () => {
        setSelection(null);
      });
    }

    if (currentUrl) {
      loadAudio(currentUrl).then(() => {
        if (wasPlaying) {
          wavesurfer?.play();
        } else if (currentTime > 0) {
          const duration = wavesurfer?.getDuration() || 0;
          if (duration > 0) {
            wavesurfer?.seekTo(currentTime / duration);
          }
        }
        if (currentSelection && newRegionsPlugin) {
          newRegionsPlugin.addRegion({
            start: currentSelection.start,
            end: currentSelection.end,
            color: "rgba(74, 158, 255, 0.3)",
            drag: true,
            resize: false,
          });
        }
      });
    }
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
        if (spectrogramPlugin) {
          wavesurfer.unregisterPlugin(spectrogramPlugin);
          spectrogramPlugin = null;
        }
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
          const progress = Math.max(0, Math.min(1, store.currentTime / duration));
          wavesurfer.seekTo(progress);
          if (wasPlaying) {
            wavesurfer.play();
          }
        }
      }

      if (duration > 0) {
        const progress = Math.max(0, Math.min(1, store.currentTime / duration));
        requestAnimationFrame(() => {
          try {
            wavesurfer?.seekTo(progress);
          } catch (err) {
          }
        });
      }
    } catch (err) {
      if (abortController.signal.aborted || isAbortError(err)) return;
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
    if (!wavesurfer || !isAudioLoaded) return;
    backgroundColor;

    const wrapper = wavesurfer.getWrapper();
    if (!wrapper) return;

    const colors = getWaveformColors(backgroundColor);

    try {
      const wavePaths = wrapper.querySelectorAll("wave > path");
      wavePaths.forEach((path) => {
        (path as SVGPathElement).setAttribute("stroke", colors.waveColor);
      });

      const progressPaths = wrapper.querySelectorAll('[data-name="progress"] > path');
      progressPaths.forEach((path) => {
        (path as SVGPathElement).setAttribute("fill", colors.progressColor);
      });

      const progressElements = wrapper.querySelectorAll('[data-name="progress"]');
      progressElements.forEach((el) => {
        (el as HTMLElement).style.backgroundColor = colors.progressColor;
      });
    } catch {}
  });

  createEffect(() => {
    if (!regionsPlugin || !isAudioLoaded) return;
    const selection = store.selection;
    const currentRegions = regionsPlugin.getRegions();

    if (!isCurrent) {
      if (currentRegions.length > 0) {
        regionsPlugin.clearRegions();
      }
      return;
    }

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
        drag: true,
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

  createEffect(() => {
    if (!wavesurfer || !trackId || !isAudioLoaded) return;

    const tracks = store.tracks;
    const trackIndex = tracks.findIndex((t) => t.id === trackId);
    if (trackIndex === -1) return;

    const track = tracks[trackIndex];
    if (!track) return;

    const volume = track.volume;
    const muted = track.muted;
    const pan = track.pan ?? 0;

    if (isNaN(volume) || !isFinite(volume)) return;

    const effectiveVolume = muted ? 0 : Math.max(0, Math.min(1, volume));
    const effectivePan = Math.max(-1, Math.min(1, isNaN(pan) || !isFinite(pan) ? 0 : pan));

    if (effectiveVolume === lastEffectiveVolume && effectivePan === lastPan) return;
    lastEffectiveVolume = effectiveVolume;
    lastPan = effectivePan;

    if (volumeUpdateTimeout) {
      clearTimeout(volumeUpdateTimeout);
      volumeUpdateTimeout = null;
    }

    wavesurfer.setVolume(effectiveVolume);

    if (splitterNode && leftGainNode && rightGainNode) {
      const panValue = effectivePan;
      leftGainNode.gain.value = panValue > 0 ? 1 - panValue : 1;
      rightGainNode.gain.value = panValue > 0 ? 1 : 1 + panValue;
    } else {
      setTimeout(() => {
        if (isAudioLoaded && wavesurfer && !isSettingUpPanning && splitterNode === null) {
          setupPanning();
        }
      }, 100);
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
