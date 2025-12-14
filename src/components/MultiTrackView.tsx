import {
  Component,
  For,
  Show,
  createSignal,
  onMount,
  onCleanup,
  createEffect,
  createMemo,
} from "solid-js";
import { useAudioStore, type WaveformRenderer } from "../stores/audioStore";
import { useWaveform } from "../hooks/useWaveform";
import { TimeRuler } from "./TimeRuler";
import { Tooltip } from "./Tooltip";
import { formatTime } from "../utils/timeUtils";

interface TrackRowProps {
  track: import("../stores/audioStore").AudioTrack;
  isCurrent: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate?: () => void;
  onRename: (name: string) => void;
  onColorChange: (color: string | null) => void;
  onVolumeChange?: (volume: number) => void;
  onPanChange?: (pan: number) => void;
  onMuteToggle?: () => void;
  onSoloToggle?: () => void;
  canDelete: boolean;
  onDragStart?: (trackId: string) => void;
  onDragEnd?: () => void;
  onDragOver?: (trackId: string, index: number) => void;
  isDragging?: boolean;
  dragOverIndex?: number | null;
  trackIndex?: number;
}

interface TrackRowPropsWithCallback extends TrackRowProps {
  onWaveformReady?: (waveform: ReturnType<typeof useWaveform>, trackId: string) => void;
  onContainerRef?: (container: HTMLDivElement) => void;
  onSelectionCreated?: (trackId: string) => void;
}

const TrackRow: Component<TrackRowPropsWithCallback> = (props) => {
  let containerRef: HTMLDivElement | undefined;
  let colorPickerRef: HTMLDivElement | undefined;
  let volumeSliderRef: HTMLDivElement | undefined;
  let panSliderRef: HTMLDivElement | undefined;
  const [isEditing, setIsEditing] = createSignal(false);
  const [editName, setEditName] = createSignal(props.track.name);
  const [showColorPicker, setShowColorPicker] = createSignal(false);
  const [isDraggingVolume, setIsDraggingVolume] = createSignal(false);
  const [isDraggingPan, setIsDraggingPan] = createSignal(false);
  const { store, setAudioStore } = useAudioStore();
  const [containerWidth, setContainerWidth] = createSignal(0);

  const cycleWaveformRenderer = () => {
    const renderers: WaveformRenderer[] = ["bars", "line", "spectrogram"];
    const currentRenderer: WaveformRenderer = props.track.waveformRenderer || "bars";
    const currentIndex = renderers.indexOf(currentRenderer);
    const nextIndex = (currentIndex + 1) % renderers.length;
    const nextRenderer: WaveformRenderer = renderers[nextIndex]!;
    setAudioStore("tracks", (tracks) =>
      tracks.map((t) => (t.id === props.track.id ? { ...t, waveformRenderer: nextRenderer } : t))
    );
  };

  const getWaveformRendererLabel = (renderer: WaveformRenderer): string => {
    switch (renderer) {
      case "bars":
        return "Bars";
      case "line":
        return "Line";
      case "spectrogram":
        return "Spectrogram";
      default:
        return "Bars";
    }
  };

  const waveform = useWaveform(() => containerRef, {
    autoLoad: false,
    isCurrent: props.isCurrent,
    trackId: props.track.id,
    onTrackSelect: props.onSelect,
    backgroundColor: props.track.backgroundColor,
    onSelectionCreated: props.onSelectionCreated,
    renderer: () => props.track.waveformRenderer || "bars",
  });

  const trackWidth = createMemo(() => {
    const maxDur =
      store.tracks.length > 0 ? Math.max(...store.tracks.map((t) => t.duration), 0) : 0;
    if (maxDur <= 0 || props.track.duration <= 0) return "100%";
    const width = containerWidth();
    if (width <= 0) return "100%";
    const pixelsPerSecond = (width / maxDur) * (store.zoom / 100);
    const trackWidthPx = props.track.duration * pixelsPerSecond;
    return `${trackWidthPx}px`;
  });

  createEffect(() => {
    const scrollContainer = containerRef?.parentElement;
    if (!scrollContainer) return;

    const updateWidth = () => {
      const width = scrollContainer.offsetWidth || scrollContainer.clientWidth || 0;
      if (width > 0) {
        setContainerWidth(width);
      }
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(scrollContainer);

    store.zoom;
    store.tracks.length;
    updateWidth();

    return () => observer.disconnect();
  });

  onMount(() => {
    if (props.track.audioUrl) {
      waveform.loadAudio(props.track.audioUrl);
    }
    props.onWaveformReady?.(waveform, props.track.id);
  });

  createEffect(() => {
    const audioUrl = props.track.audioUrl;
    if (audioUrl && waveform) {
      waveform.loadAudio(audioUrl);
    }
  });

  const handleContainerRef = (el: HTMLDivElement) => {
    containerRef = el;
    if (el) {
      props.onContainerRef?.(el);
    }
  };

  const handleRenameStart = (e: Event) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditName(props.track.name);
  };

  const handleRenameSubmit = () => {
    if (editName().trim()) {
      props.onRename(editName().trim());
    }
    setIsEditing(false);
  };

  const handleRenameCancel = () => {
    setIsEditing(false);
    setEditName(props.track.name);
  };

  const calculateVolumeFromX = (x: number, rect: DOMRect): number => {
    if (!rect || rect.width === 0) return props.track.volume;
    const relativeX = x - rect.left;
    const clampedX = Math.max(0, Math.min(rect.width, relativeX));
    const percentage = clampedX / rect.width;
    return Math.max(0, Math.min(1, percentage));
  };

  const calculatePanFromX = (x: number, rect: DOMRect): number => {
    if (!rect || rect.width === 0) return props.track.pan;
    const relativeX = x - rect.left;
    const clampedX = Math.max(0, Math.min(rect.width, relativeX));
    const percentage = clampedX / rect.width;
    return Math.max(-1, Math.min(1, percentage * 2 - 1));
  };

  const handleVolumeMouseDown = (e: MouseEvent) => {
    if (!volumeSliderRef) return;
    e.preventDefault();
    e.stopPropagation();

    const target = e.target as HTMLElement;
    const isThumb = target.hasAttribute("data-volume-thumb") || target.closest('[data-volume-thumb]');

    const rect = volumeSliderRef.getBoundingClientRect();
    if (rect && rect.width > 0) {
      const volume = calculateVolumeFromX(e.clientX, rect);
      if (!isNaN(volume) && isFinite(volume) && volume >= 0 && volume <= 1) {
        props.onVolumeChange?.(volume);
      }
    }

    setIsDraggingVolume(true);
  };

  createEffect(() => {
    if (!isDraggingVolume()) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!volumeSliderRef) return;
      e.preventDefault();
      const rect = volumeSliderRef.getBoundingClientRect();
      if (rect && rect.width > 0) {
        const volume = calculateVolumeFromX(e.clientX, rect);
        if (!isNaN(volume) && isFinite(volume) && volume >= 0 && volume <= 1) {
          props.onVolumeChange?.(volume);
        }
      }
    };

    const handleMouseUp = () => {
      setIsDraggingVolume(false);
    };

    document.addEventListener("mousemove", handleMouseMove, { passive: false });
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  });

  const handlePanMouseDown = (e: MouseEvent) => {
    if (!panSliderRef) return;
    e.preventDefault();
    e.stopPropagation();

    const target = e.target as HTMLElement;
    const isThumb = target.hasAttribute("data-pan-thumb") || target.closest('[data-pan-thumb]');

    const rect = panSliderRef.getBoundingClientRect();
    if (rect && rect.width > 0) {
      const pan = calculatePanFromX(e.clientX, rect);
      if (!isNaN(pan) && isFinite(pan) && pan >= -1 && pan <= 1) {
        props.onPanChange?.(pan);
      }
    }

    setIsDraggingPan(true);
  };

  createEffect(() => {
    if (!isDraggingPan()) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!panSliderRef) return;
      e.preventDefault();
      const rect = panSliderRef.getBoundingClientRect();
      if (rect && rect.width > 0) {
        const pan = calculatePanFromX(e.clientX, rect);
        if (!isNaN(pan) && isFinite(pan) && pan >= -1 && pan <= 1) {
          props.onPanChange?.(pan);
        }
      }
    };

    const handleMouseUp = () => {
      setIsDraggingPan(false);
    };

    document.addEventListener("mousemove", handleMouseMove, { passive: false });
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  });

  onMount(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showColorPicker() && colorPickerRef && !colorPickerRef.contains(e.target as Node)) {
        const button = (e.target as HTMLElement).closest('button[aria-label="Set Track Color"]');
        if (!button) {
          setShowColorPicker(false);
        }
      }
    };
    document.addEventListener("click", handleClickOutside);
    onCleanup(() => {
      document.removeEventListener("click", handleClickOutside);
    });
  });

  const handleDragStart = (e: DragEvent) => {
    e.dataTransfer!.effectAllowed = "move";
    e.dataTransfer!.setData("text/plain", props.track.id);
    props.onDragStart?.(props.track.id);
  };

  const handleDragEnd = () => {
    props.onDragEnd?.();
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer!.dropEffect = "move";
    if (props.trackIndex !== undefined) {
      const trackRow = (e.currentTarget as HTMLElement).closest(
        '[class*="flex"][class*="border-b"]'
      ) as HTMLElement;
      if (trackRow) {
        const rect = trackRow.getBoundingClientRect();
        const mouseY = e.clientY - rect.top;
        const trackHeight = rect.height;
        const midPoint = trackHeight / 2;
        const targetIndex = mouseY < midPoint ? props.trackIndex : props.trackIndex + 1;
        props.onDragOver?.(props.track.id, targetIndex);
      } else if (props.trackIndex !== undefined) {
        props.onDragOver?.(props.track.id, props.trackIndex);
      }
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
  };

  const handleDragHandleMouseDown = (e: MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      class="flex border-b border-[var(--color-border)] min-h-[150px] sm:min-h-[180px] md:min-h-[200px]"
      classList={{
        "opacity-50": props.isDragging,
      }}
    >
      <div
        class="w-48 sm:w-56 md:w-64 border-r border-[var(--color-border)] bg-[var(--color-bg-elevated)] flex flex-col p-2 sm:p-3 flex-shrink-0 relative"
        style={{
          "background-color": "var(--color-bg-elevated)",
        }}
      >
        <div class="flex items-start justify-between gap-2 mb-1.5 w-full">
          <div class="flex items-start gap-2 flex-1 min-w-0">
            <div
              class="w-6 h-6 flex items-center justify-center cursor-grab active:cursor-grabbing text-[var(--color-text)] hover:text-[var(--color-primary)] hover:bg-[var(--color-bg)] rounded flex-shrink-0 touch-none"
              draggable={true}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onMouseDown={handleDragHandleMouseDown}
              title="Drag to reorder tracks"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="9" cy="5" r="2" />
                <circle cx="9" cy="12" r="2" />
                <circle cx="9" cy="19" r="2" />
                <circle cx="15" cy="5" r="2" />
                <circle cx="15" cy="12" r="2" />
                <circle cx="15" cy="19" r="2" />
              </svg>
            </div>
            <div class="flex-1 min-w-0">
              <Show
                when={isEditing()}
                fallback={
                  <>
                    <button onClick={() => props.onSelect()} class="w-full text-left pt-0.5">
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRenameStart(e);
                        }}
                        class="text-sm font-medium text-[var(--color-text)] truncate leading-tight cursor-text"
                      >
                        {props.track.name}
                      </div>
                    </button>
                    <div class="text-xs text-[var(--color-text)] space-y-0.5 opacity-70 mt-1">
                      <div>Duration: {formatTime(props.track.duration)}</div>
                      <Show when={props.track.audioBuffer}>
                        <div>Channels: {props.track.audioBuffer!.numberOfChannels}</div>
                        <div>
                          Sample Rate: {Math.round(props.track.audioBuffer!.sampleRate / 1000)}kHz
                        </div>
                      </Show>
                    </div>
                    <div class="mt-2 space-y-1.5">
                      <div>
                        <div class="flex items-center justify-center mb-0.5">
                          <span class="text-[0.625rem] text-[var(--color-text-secondary)] font-medium mr-1">Pan</span>
                          <span class="text-[0.625rem] text-[var(--color-text-secondary)] tabular-nums font-medium">
                            {props.track.pan === 0 ? "0%" : props.track.pan > 0 ? `${Math.round(props.track.pan * 100)}%` : `${Math.round(Math.abs(props.track.pan) * 100)}%`}
                          </span>
                        </div>
                        <div class="flex items-center gap-1">
                          <span class="text-[0.625rem] text-[var(--color-text-secondary)] w-4 text-center">L</span>
                          <div
                            ref={panSliderRef}
                            class="relative h-5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-sm cursor-pointer"
                            style={{ width: "calc(100% - 4rem)" }}
                            onMouseDown={handlePanMouseDown}
                            title="Pan"
                          >
                            <div
                              class="absolute left-0 top-0 bottom-0 bg-[var(--color-primary)]/30 transition-all pointer-events-none"
                              style={{
                                width: `${((props.track.pan + 1) / 2) * 100}%`,
                              }}
                            />
                            <div
                              data-pan-thumb
                              class="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-4 w-2.5 bg-[var(--color-border)] border border-[var(--color-border-hover)] rounded cursor-grab active:cursor-grabbing transition-all hover:bg-[var(--color-border-hover)] hover:border-[var(--color-primary)] pointer-events-auto"
                              style={{
                                left: `${((props.track.pan + 1) / 2) * 100}%`,
                              }}
                            />
                          </div>
                          <span class="text-[0.625rem] text-[var(--color-text-secondary)] w-4 text-center">R</span>
                        </div>
                      </div>
                      <div>
                        <div class="flex items-center justify-center mb-0.5">
                          <span class="text-[0.625rem] text-[var(--color-text-secondary)] font-medium mr-1">Vol</span>
                          <span class="text-[0.625rem] text-[var(--color-text-secondary)] tabular-nums font-medium">
                            {Math.round(props.track.volume * 100)}%
                          </span>
                        </div>
                        <div class="flex items-center gap-1">
                          <span class="text-[0.625rem] text-[var(--color-text-secondary)] w-4 text-center">0</span>
                          <div
                            ref={volumeSliderRef}
                            class="relative h-5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-sm cursor-pointer"
                            style={{ width: "calc(100% - 4rem)" }}
                            onMouseDown={handleVolumeMouseDown}
                            title="Volume"
                          >
                            <div
                              class="absolute left-0 top-0 bottom-0 bg-[var(--color-primary)]/30 transition-all pointer-events-none"
                              style={{
                                width: `${props.track.volume * 100}%`,
                              }}
                            />
                            <div
                              data-volume-thumb
                              class="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-4 w-2.5 bg-[var(--color-border)] border border-[var(--color-border-hover)] rounded cursor-grab active:cursor-grabbing transition-all hover:bg-[var(--color-border-hover)] hover:border-[var(--color-primary)] pointer-events-auto"
                              style={{
                                left: `${props.track.volume * 100}%`,
                              }}
                            />
                          </div>
                          <span class="text-[0.625rem] text-[var(--color-text-secondary)] w-4 text-center">100</span>
                        </div>
                      </div>
                    </div>
                  </>
                }
              >
                <input
                  type="text"
                  value={editName()}
                  onInput={(e) => setEditName(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleRenameSubmit();
                    } else if (e.key === "Escape") {
                      handleRenameCancel();
                    }
                  }}
                  onBlur={handleRenameSubmit}
                  onClick={(e) => e.stopPropagation()}
                  class="w-full max-w-full box-border px-2 py-1 text-sm bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  style="width: 100%; max-width: 100%;"
                  autofocus
                />
                <div class="text-xs text-[var(--color-text)] space-y-0.5 opacity-70 mt-1">
                  <div>Duration: {formatTime(props.track.duration)}</div>
                  <Show when={props.track.audioBuffer}>
                    <div>Channels: {props.track.audioBuffer!.numberOfChannels}</div>
                    <div>
                      Sample Rate: {Math.round(props.track.audioBuffer!.sampleRate / 1000)}kHz
                    </div>
                  </Show>
                </div>
                <div class="mt-2 space-y-1.5">
                  <div>
                    <div class="flex items-center justify-center mb-0.5">
                      <span class="text-[0.625rem] text-[var(--color-text-secondary)] font-medium mr-1">Pan</span>
                      <span class="text-[0.625rem] text-[var(--color-text-secondary)] tabular-nums font-medium">
                        {props.track.pan === 0 ? "0%" : props.track.pan > 0 ? `${Math.round(props.track.pan * 100)}%` : `${Math.round(Math.abs(props.track.pan) * 100)}%`}
                      </span>
                    </div>
                    <div class="flex items-center gap-1">
                      <span class="text-[0.625rem] text-[var(--color-text-secondary)] w-4 text-center">L</span>
                      <div
                        ref={panSliderRef}
                        class="relative h-5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-sm cursor-pointer"
                        style={{ width: "calc(100% - 4rem)" }}
                        onMouseDown={handlePanMouseDown}
                        title="Pan"
                      >
                        <div
                          class="absolute left-0 top-0 bottom-0 bg-[var(--color-primary)]/30 transition-all pointer-events-none"
                          style={{
                            width: `${((props.track.pan + 1) / 2) * 100}%`,
                          }}
                        />
                        <div
                          data-pan-thumb
                          class="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-4 w-2.5 bg-[var(--color-border)] border border-[var(--color-border-hover)] rounded cursor-grab active:cursor-grabbing transition-all hover:bg-[var(--color-border-hover)] hover:border-[var(--color-primary)] pointer-events-auto"
                          style={{
                            left: `${((props.track.pan + 1) / 2) * 100}%`,
                          }}
                        />
                      </div>
                      <span class="text-[0.625rem] text-[var(--color-text-secondary)] w-4 text-center">R</span>
                    </div>
                  </div>
                  <div>
                    <div class="flex items-center justify-center mb-0.5">
                      <span class="text-[0.625rem] text-[var(--color-text-secondary)] font-medium mr-1">Vol</span>
                      <span class="text-[0.625rem] text-[var(--color-text-secondary)] tabular-nums font-medium">
                        {Math.round(props.track.volume * 100)}%
                      </span>
                    </div>
                    <div class="flex items-center gap-1">
                      <span class="text-[0.625rem] text-[var(--color-text-secondary)] w-4 text-center">0</span>
                      <div
                        ref={volumeSliderRef}
                        class="relative h-5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-sm cursor-pointer"
                        style={{ width: "calc(100% - 4rem)" }}
                        onMouseDown={handleVolumeMouseDown}
                        title="Volume"
                      >
                        <div
                          class="absolute left-0 top-0 bottom-0 bg-[var(--color-primary)]/30 transition-all pointer-events-none"
                          style={{
                            width: `${props.track.volume * 100}%`,
                          }}
                        />
                        <div
                          data-volume-thumb
                          class="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-4 w-2.5 bg-[var(--color-border)] border border-[var(--color-border-hover)] rounded cursor-grab active:cursor-grabbing transition-all hover:bg-[var(--color-border-hover)] hover:border-[var(--color-primary)] pointer-events-auto"
                          style={{
                            left: `${props.track.volume * 100}%`,
                          }}
                        />
                      </div>
                      <span class="text-[0.625rem] text-[var(--color-text-secondary)] w-4 text-center">100</span>
                    </div>
                  </div>
                </div>
              </Show>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-1 items-start flex-shrink-0">
            <div class="relative flex items-center">
              <Tooltip label="Set Track Color">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowColorPicker(!showColorPicker());
                  }}
                  class="p-1 rounded hover:bg-[var(--color-bg)] text-[var(--color-text)] transition-colors flex items-center justify-center cursor-pointer w-full aspect-square"
                  aria-label="Set Track Color"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 22q-2.05 0-3.875-.788t-3.187-2.15t-2.15-3.187T2 12q0-2.075.813-3.9t2.2-3.175T8.25 2.788T12.2 2q2 0 3.775.688t3.113 1.9t2.125 2.875T22 11.05q0 2.875-1.75 4.413T16 17h-1.85q-.225 0-.312.125t-.088.275q0 .3.375.863t.375 1.287q0 1.25-.687 1.85T12 22m-5.5-9q.65 0 1.075-.425T8 11.5t-.425-1.075T6.5 10t-1.075.425T5 11.5t.425 1.075T6.5 13m3-4q.65 0 1.075-.425T11 7.5t-.425-1.075T9.5 6t-1.075.425T8 7.5t.425 1.075T9.5 9m5 0q.65 0 1.075-.425T16 7.5t-.425-1.075T14.5 6t-1.075.425T13 7.5t.425 1.075T14.5 9m3 4q.65 0 1.075-.425T19 11.5t-.425-1.075T17.5 10t-1.075.425T16 11.5t.425 1.075T17.5 13M12 20q.225 0 .363-.125t.137-.325q0-.35-.375-.825T11.75 17.3q0-1.05.725-1.675T14.25 15H16q1.65 0 2.825-.962T20 11.05q0-3.025-2.312-5.038T12.2 4Q8.8 4 6.4 6.325T4 12q0 3.325 2.338 5.663T12 20" />
                  </svg>
                </button>
              </Tooltip>
              <Show when={showColorPicker()}>
                <div
                  ref={colorPickerRef}
                  class="absolute top-full left-0 mt-1 z-50 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg p-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div class="flex items-center gap-2">
                    {[
                      { color: null, label: "None" },
                      { color: "#22c55e", label: "Green" },
                      { color: "#f59e0b", label: "Amber" },
                      { color: "#ef4444", label: "Red" },
                      { color: "#a855f7", label: "Purple" },
                      { color: "#06b6d4", label: "Cyan" },
                    ].map((item) => (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          props.onColorChange(item.color);
                          setShowColorPicker(false);
                        }}
                        class="flex flex-col items-center gap-1.5 px-2 py-2 rounded hover:bg-[var(--color-bg)] transition-colors group"
                        aria-label={item.label}
                      >
                        <div
                          class="w-8 h-8 rounded border-2 transition-all cursor-pointer"
                          classList={{
                            "border-[var(--color-primary)] ring-2 ring-[var(--color-primary)] ring-offset-1 ring-offset-[var(--color-bg-elevated)]":
                              props.track.backgroundColor === item.color,
                            "border-[var(--color-border)] group-hover:border-[var(--color-primary)] group-hover:scale-110":
                              props.track.backgroundColor !== item.color,
                          }}
                          style={{
                            "background-color": item.color || "transparent",
                            "background-image": item.color
                              ? "none"
                              : "linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)",
                            "background-size": "8px 8px",
                            "background-position": "0 0, 0 4px, 4px -4px, -4px 0px",
                          }}
                        />
                        <span class="text-[0.625rem] text-[var(--color-text-secondary)] group-hover:text-[var(--color-text)] transition-colors">
                          {item.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </Show>
            </div>
            <div class="relative flex items-center">
              <Tooltip
                label={`Waveform: ${getWaveformRendererLabel(
                  (props.track.waveformRenderer || "bars") as WaveformRenderer
                )} (Click to cycle)`}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    cycleWaveformRenderer();
                  }}
                  class="p-1 rounded hover:bg-[var(--color-bg)] text-[var(--color-text)] transition-colors flex items-center justify-center cursor-pointer w-full aspect-square"
                  aria-label={`Waveform: ${getWaveformRendererLabel(
                    (props.track.waveformRenderer || "bars") as WaveformRenderer
                  )}`}
                >
                  <Show
                    when={(props.track.waveformRenderer || "bars") === "spectrogram"}
                    fallback={
                      <Show
                        when={(props.track.waveformRenderer || "bars") === "line"}
                        fallback={
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                          >
                            <path d="M2 12h20M4 8v8M8 4v16M12 6v12M16 8v8M20 10v4" />
                          </svg>
                        }
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                        >
                          <path d="M2 12h20M2 12c0-4 4-8 10-8s10 4 10 8M2 12c0 4 4 8 10 8s10-4 10-8" />
                        </svg>
                      </Show>
                    }
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <rect x="2" y="2" width="20" height="20" rx="2" />
                      <path d="M2 8h20M2 12h20M2 16h20" />
                      <path d="M6 2v20M12 2v20M18 2v20" />
                    </svg>
                  </Show>
                </button>
              </Tooltip>
            </div>
            <Tooltip label="Duplicate Track">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  props.onDuplicate?.();
                }}
                class="p-1 rounded hover:bg-[var(--color-bg)] text-[var(--color-text)] transition-colors flex items-center justify-center cursor-pointer w-full aspect-square disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Duplicate Track"
                disabled={!props.track.audioBuffer}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </button>
            </Tooltip>
            <Show when={props.canDelete}>
              <Tooltip label="Delete Track">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    props.onDelete();
                  }}
                  class="p-1 rounded hover:bg-[var(--color-danger)]/20 text-[var(--color-text)] hover:text-[var(--color-danger)] transition-colors flex items-center justify-center cursor-pointer w-full aspect-square"
                  aria-label="Delete Track"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </Tooltip>
            </Show>
            <Tooltip label={props.track.muted ? "Unmute" : "Mute"}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  props.onMuteToggle?.();
                }}
                class="p-1 rounded hover:bg-[var(--color-bg)] text-[var(--color-text)] transition-colors flex items-center justify-center cursor-pointer w-full aspect-square"
                classList={{
                  "text-[var(--color-danger)]": props.track.muted,
                }}
                aria-label={props.track.muted ? "Unmute" : "Mute"}
              >
                <Show
                  when={props.track.muted}
                  fallback={
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path d="M11 5L6 9H2v6h4l5 4V5z" />
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                    </svg>
                  }
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path d="M11 5L6 9H2v6h4l5 4V5z" />
                    <line x1="23" y1="9" x2="17" y2="15" />
                    <line x1="17" y1="9" x2="23" y2="15" />
                  </svg>
                </Show>
              </button>
            </Tooltip>
            <Tooltip label={props.track.soloed ? "Unsolo" : "Solo"}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  props.onSoloToggle?.();
                }}
                class="p-1 rounded hover:bg-[var(--color-bg)] text-[var(--color-text)] transition-colors flex items-center justify-center cursor-pointer w-full aspect-square"
                classList={{
                  "text-[var(--color-primary)]": props.track.soloed,
                }}
                aria-label={props.track.soloed ? "Unsolo" : "Solo"}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M11 5L6 9H2v6h4l5 4V5z" />
                  <Show when={props.track.soloed}>
                    <circle cx="18" cy="12" r="3" fill="currentColor" />
                  </Show>
                </svg>
              </button>
            </Tooltip>
          </div>
        </div>
      </div>
      <div class="flex-1 overflow-x-auto overflow-y-hidden [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-[var(--color-bg)] [&::-webkit-scrollbar-track]:rounded [&::-webkit-scrollbar-thumb]:bg-[var(--color-border)] [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:border [&::-webkit-scrollbar-thumb]:border-[var(--color-bg)] [&::-webkit-scrollbar-thumb]:hover:bg-[var(--color-border-hover)]">
        <div
          ref={handleContainerRef}
          class="min-h-[150px] sm:min-h-[180px] md:min-h-[200px] flex-shrink-0 [&_wave]:cursor-pointer [&>*]:overflow-visible [&_wave]:overflow-visible [&>*]:overflow-x-visible [&_wave]:overflow-x-visible"
          style={{
            width: trackWidth(),
            "background-color": props.track.backgroundColor || "transparent",
          }}
          onClick={(e) => {
            if (!props.isCurrent) {
              e.stopPropagation();
              props.onSelect();
            }
          }}
        />
      </div>
    </div>
  );
};

interface MultiTrackViewProps {
  onWaveformReady?: (waveform: ReturnType<typeof useWaveform>, trackId: string) => void;
  onSeekAll?: (time: number) => void;
  onSetRepeatStart?: (time: number) => void;
  onSetRepeatEnd?: (time: number) => void;
  onClearRepeat?: () => void;
  onSelectionCreated?: (trackId: string) => void;
}

export const MultiTrackView: Component<MultiTrackViewProps> = (props) => {
  const { store, setCurrentTrackId, deleteTrack, duplicateTrack, setAudioStore, reorderTracks } =
    useAudioStore();
  const [mainContainerRef, setMainContainerRef] = createSignal<HTMLDivElement | undefined>(
    undefined
  );
  const [tracksContainerRef, setTracksContainerRef] = createSignal<HTMLDivElement | undefined>(
    undefined
  );
  const [draggedTrackId, setDraggedTrackId] = createSignal<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = createSignal<number | null>(null);

  const handleContainerRef = (el: HTMLDivElement) => {
    if (!mainContainerRef()) {
      setMainContainerRef(el);
    }
  };

  const maxDuration = createMemo(() => Math.max(...store.tracks.map((t) => t.duration), 0));

  const playheadPosition = createMemo(() => {
    const container = mainContainerRef();
    if (!container) return 0;

    const maxDur = maxDuration();
    if (maxDur <= 0) return 0;

    store.currentTime;
    store.zoom;
    const rulerContainer = container.parentElement;
    if (!rulerContainer) return 0;
    const containerWidth = rulerContainer.offsetWidth || rulerContainer.clientWidth || 0;
    if (containerWidth <= 0) return 0;

    const pixelsPerSecond = (containerWidth / maxDur) * (store.zoom / 100);
    const fullTimelineWidth = maxDur * pixelsPerSecond;
    const position = store.currentTime * pixelsPerSecond;
    return Math.max(0, Math.min(fullTimelineWidth, position));
  });

  const repeatRegionPosition = createMemo(() => {
    if (!store.repeatRegion) return null;
    const container = mainContainerRef();
    if (!container) return null;

    const maxDur = maxDuration();
    if (maxDur <= 0) return null;

    const rulerContainer = container.parentElement;
    if (!rulerContainer) return null;
    const containerWidth = rulerContainer.offsetWidth || rulerContainer.clientWidth || 0;
    if (containerWidth <= 0) return null;

    const pixelsPerSecond = (containerWidth / maxDur) * (store.zoom / 100);
    const startPos = store.repeatRegion.start * pixelsPerSecond;
    const endPos = store.repeatRegion.end * pixelsPerSecond;
    return { start: startPos, end: endPos };
  });

  const [sidebarWidth, setSidebarWidth] = createSignal(192);

  createEffect(() => {
    const container = tracksContainerRef();
    if (!container) return;

    const firstTrackRow = container.querySelector(
      '[class*="flex"][class*="border-b"]'
    ) as HTMLElement;
    if (!firstTrackRow) return;

    const updateWidth = () => {
      const sidebar = firstTrackRow.firstElementChild as HTMLElement;
      if (sidebar) {
        const width = sidebar.offsetWidth;
        if (width > 0) {
          setSidebarWidth(width);
        }
      }
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(firstTrackRow);

    return () => observer.disconnect();
  });
  createEffect(() => {
    const rulerContainer = mainContainerRef()?.parentElement;
    const tracksContainer = tracksContainerRef();

    if (!rulerContainer || !tracksContainer) return;

    const syncScroll = () => {
      const scrollLeft = rulerContainer.scrollLeft;
      if (tracksContainer.scrollLeft !== scrollLeft) {
        tracksContainer.scrollLeft = scrollLeft;
      }
    };

    const syncScrollReverse = () => {
      const scrollLeft = tracksContainer.scrollLeft;
      if (rulerContainer.scrollLeft !== scrollLeft) {
        rulerContainer.scrollLeft = scrollLeft;
      }
    };

    rulerContainer.addEventListener("scroll", syncScroll);
    tracksContainer.addEventListener("scroll", syncScrollReverse);

    return () => {
      rulerContainer.removeEventListener("scroll", syncScroll);
      tracksContainer.removeEventListener("scroll", syncScrollReverse);
    };
  });

  const handleTrackSelect = (trackId: string) => {
    setCurrentTrackId(trackId);
  };

  const handleTrackDelete = async (trackId: string) => {
    if (store.tracks.length <= 1) {
      return;
    }
    await deleteTrack(trackId);
  };

  const handleTrackDuplicate = async (trackId: string) => {
    await duplicateTrack(trackId);
  };

  const handleTrackRename = (trackId: string, name: string) => {
    setAudioStore("tracks", (tracks) => tracks.map((t) => (t.id === trackId ? { ...t, name } : t)));
  };

  const handleTrackColorChange = (trackId: string, color: string | null) => {
    setAudioStore("tracks", (tracks) =>
      tracks.map((t) => (t.id === trackId ? { ...t, backgroundColor: color } : t))
    );
  };

  const handleTrackVolumeChange = (trackId: string, volume: number) => {
    if (isNaN(volume) || !isFinite(volume)) return;
    const clampedVolume = Math.max(0, Math.min(1, volume));
    setAudioStore("tracks", (tracks) =>
      tracks.map((t) => (t.id === trackId ? { ...t, volume: clampedVolume } : t))
    );
  };

  const handleTrackPanChange = (trackId: string, pan: number) => {
    if (isNaN(pan) || !isFinite(pan)) return;
    const clampedPan = Math.max(-1, Math.min(1, pan));
    setAudioStore("tracks", (tracks) =>
      tracks.map((t) => (t.id === trackId ? { ...t, pan: clampedPan } : t))
    );
  };

  const handleTrackMuteToggle = (trackId: string) => {
    setAudioStore("tracks", (tracks) =>
      tracks.map((t) => (t.id === trackId ? { ...t, muted: !t.muted } : t))
    );
  };

  const handleTrackSoloToggle = (trackId: string) => {
    setAudioStore("tracks", (tracks) => {
      const track = tracks.find((t) => t.id === trackId);
      if (!track) return tracks;
      const newSoloed = !track.soloed;

      return tracks.map((t) => ({
        ...t,
        soloed: t.id === trackId ? newSoloed : newSoloed ? false : t.soloed,
      }));
    });
  };

  return (
    <div class="w-full h-full relative flex flex-col overflow-hidden">
      <Show when={store.tracks.length > 0}>
        <div class="w-full h-full bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg relative flex flex-col overflow-hidden">
          <div class="flex border-b border-[var(--color-border)] flex-shrink-0 relative">
            <div class="w-48 sm:w-56 md:w-64 border-r border-[var(--color-border)] bg-[var(--color-bg-elevated)] flex-shrink-0 flex items-center px-2 py-1">
              <input
                type="text"
                value={store.projectName}
                onInput={(e) => setAudioStore("projectName", e.currentTarget.value)}
                placeholder="Project Name (required)"
                required
                class="w-full px-1.5 py-0.5 text-xs bg-[var(--color-bg)] border rounded text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] placeholder:text-[var(--color-text-secondary)] transition-colors"
                classList={{
                  "border-[var(--color-border)]": !!store.projectName?.trim(),
                  "border-[var(--color-recording)]": !store.projectName?.trim(),
                }}
              />
            </div>
            <div class="flex-1 overflow-x-auto overflow-y-hidden [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-[var(--color-bg)] [&::-webkit-scrollbar-track]:rounded [&::-webkit-scrollbar-thumb]:bg-[var(--color-border)] [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:border [&::-webkit-scrollbar-thumb]:border-[var(--color-bg)] [&::-webkit-scrollbar-thumb]:hover:bg-[var(--color-border-hover)]">
              <TimeRuler
                containerRef={mainContainerRef}
                onSeek={props.onSeekAll}
                onSetRepeatStart={props.onSetRepeatStart}
                onSetRepeatEnd={props.onSetRepeatEnd}
                onClearRepeat={props.onClearRepeat}
              />
            </div>
          </div>
          <div
            ref={setTracksContainerRef}
            class="flex-1 overflow-y-auto overflow-x-auto relative [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-[var(--color-bg)] [&::-webkit-scrollbar-track]:rounded [&::-webkit-scrollbar-thumb]:bg-[var(--color-border)] [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:border [&::-webkit-scrollbar-thumb]:border-[var(--color-bg)] [&::-webkit-scrollbar-thumb]:hover:bg-[var(--color-border-hover)]"
          >
            <div class="relative">
              <Show when={store.tracks.length > 0 && repeatRegionPosition()}>
                {(regionPos) => (
                  <div
                    class="absolute bg-yellow-500/20 border-y border-yellow-500/50 z-[15] pointer-events-none"
                    style={{
                      left: `${sidebarWidth() + regionPos().start}px`,
                      width: `${regionPos().end - regionPos().start}px`,
                      top: "0px",
                      height: `${store.tracks.length * 200}px`,
                    }}
                  />
                )}
              </Show>
              <Show
                when={
                  store.tracks.length > 0 &&
                  playheadPosition() >= 0 &&
                  !(store.currentTime >= maxDuration() - 0.01 && !store.isPlaying)
                }
              >
                <div
                  class="absolute w-[3px] bg-white z-[20] pointer-events-none"
                  style={{
                    left: `${sidebarWidth() + playheadPosition()}px`,
                    top: "0px",
                    height: `${store.tracks.length * 200}px`,
                  }}
                />
              </Show>
              <For each={store.tracks}>
                {(track, index) => {
                  const handleDragStart = (trackId: string) => {
                    setDraggedTrackId(trackId);
                  };

                  const handleDragEnd = async () => {
                    const draggedId = draggedTrackId();
                    const overIndex = dragOverIndex();
                    if (draggedId && overIndex !== null) {
                      const draggedIndex = store.tracks.findIndex((t) => t.id === draggedId);
                      if (draggedIndex !== -1 && draggedIndex !== overIndex) {
                        await reorderTracks(draggedIndex, overIndex);
                      }
                    }
                    setDraggedTrackId(null);
                    setDragOverIndex(null);
                  };

                  const handleDragOver = (trackId: string, targetIndex: number) => {
                    const draggedId = draggedTrackId();
                    if (draggedId && draggedId !== trackId) {
                      const draggedIndex = store.tracks.findIndex((t) => t.id === draggedId);
                      if (draggedIndex !== -1) {
                        let finalIndex = targetIndex;
                        if (targetIndex > draggedIndex) {
                          finalIndex = targetIndex - 1;
                        }
                        setDragOverIndex(Math.max(0, Math.min(store.tracks.length, finalIndex)));
                      }
                    }
                  };

                  const handleContainerDragOver = (e: DragEvent) => {
                    e.preventDefault();
                    e.dataTransfer!.dropEffect = "move";
                    const currentIndex = index();
                    const draggedId = draggedTrackId();
                    if (draggedId && draggedId !== track.id) {
                      const container = e.currentTarget as HTMLElement;
                      const rect = container.getBoundingClientRect();
                      const mouseY = e.clientY - rect.top;
                      const trackHeight = rect.height;
                      const midPoint = trackHeight / 2;
                      const targetIndex = mouseY < midPoint ? currentIndex : currentIndex + 1;
                      handleDragOver(track.id, targetIndex);
                    }
                  };

                  const currentIndex = index();
                  const isDragged = draggedTrackId() === track.id;
                  const dropIndex = dragOverIndex();

                  return (
                    <>
                      <Show when={dropIndex === currentIndex && !isDragged}>
                        <div class="h-1 bg-[var(--color-primary)] border-y border-[var(--color-primary)]" />
                      </Show>
                      <div
                        onDragOver={handleContainerDragOver}
                        onDrop={(e) => {
                          e.preventDefault();
                          handleDragEnd();
                        }}
                      >
                        <TrackRow
                          track={track}
                          isCurrent={track.id === store.currentTrackId}
                          onSelect={() => handleTrackSelect(track.id)}
                          onDelete={() => handleTrackDelete(track.id)}
                          onDuplicate={() => handleTrackDuplicate(track.id)}
                          onRename={(name) => handleTrackRename(track.id, name)}
                          onColorChange={(color) => handleTrackColorChange(track.id, color)}
                          onVolumeChange={(volume) => handleTrackVolumeChange(track.id, volume)}
                          onPanChange={(pan) => handleTrackPanChange(track.id, pan)}
                          onMuteToggle={() => handleTrackMuteToggle(track.id)}
                          onSoloToggle={() => handleTrackSoloToggle(track.id)}
                          canDelete={store.tracks.length > 1}
                          onWaveformReady={props.onWaveformReady}
                          onContainerRef={handleContainerRef}
                          onSelectionCreated={props.onSelectionCreated}
                          onDragStart={handleDragStart}
                          onDragEnd={handleDragEnd}
                          onDragOver={handleDragOver}
                          isDragging={isDragged}
                          dragOverIndex={dropIndex}
                          trackIndex={currentIndex}
                        />
                      </div>
                    </>
                  );
                }}
              </For>
            </div>
          </div>
        </div>
      </Show>
      <Show when={store.tracks.length === 0}>
        <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center text-[var(--color-text-secondary)] pointer-events-none text-xs sm:text-sm md:text-[0.9375rem] p-3 sm:p-4 md:p-6 lg:p-8 opacity-70 max-w-[90%]">
          <p>Import an audio file or start recording to begin editing</p>
        </div>
      </Show>
    </div>
  );
};
