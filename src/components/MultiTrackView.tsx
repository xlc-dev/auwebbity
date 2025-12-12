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
import { useAudioStore } from "../stores/audioStore";
import { useWaveform } from "../hooks/useWaveform";
import { TimeRuler } from "./TimeRuler";
import { formatTime } from "../utils/timeUtils";

interface TrackRowProps {
  track: import("../stores/audioStore").AudioTrack;
  isCurrent: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
  onColorChange: (color: string | null) => void;
  canDelete: boolean;
}

interface TrackRowPropsWithCallback extends TrackRowProps {
  onWaveformReady?: (waveform: ReturnType<typeof useWaveform>, trackId: string) => void;
  onContainerRef?: (container: HTMLDivElement) => void;
  onSelectionCreated?: (trackId: string) => void;
}

const TrackRow: Component<TrackRowPropsWithCallback> = (props) => {
  let containerRef: HTMLDivElement | undefined;
  let colorPickerRef: HTMLDivElement | undefined;
  const [isEditing, setIsEditing] = createSignal(false);
  const [editName, setEditName] = createSignal(props.track.name);
  const [showColorPicker, setShowColorPicker] = createSignal(false);
  const { store } = useAudioStore();
  const [containerWidth, setContainerWidth] = createSignal(0);

  const waveform = useWaveform(() => containerRef, {
    autoLoad: false,
    isCurrent: props.isCurrent,
    trackId: props.track.id,
    onTrackSelect: props.onSelect,
    backgroundColor: props.track.backgroundColor,
    onSelectionCreated: props.onSelectionCreated,
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

  return (
    <div
      class="flex border-b border-[var(--color-border)] min-h-[150px] sm:min-h-[180px] md:min-h-[200px]"
      style={{
        "background-color": props.track.backgroundColor || "transparent",
      }}
    >
      <div class="w-48 sm:w-56 md:w-64 border-r border-[var(--color-border)] bg-[var(--color-bg-elevated)] flex flex-col p-2 sm:p-3 flex-shrink-0">
        <div class="flex items-center justify-between gap-2 mb-2">
          <Show
            when={isEditing()}
            fallback={
              <>
                <button onClick={() => props.onSelect()} class="flex-1 text-left min-w-0">
                  <div class="text-sm font-medium text-[var(--color-text)] truncate">
                    {props.track.name}
                  </div>
                  <div class="text-xs text-[var(--color-text)] mt-0.5 opacity-70">
                    {formatTime(props.track.duration)}
                  </div>
                </button>
                <div class="flex items-center gap-1">
                  <div class="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowColorPicker(!showColorPicker());
                      }}
                      class="p-1 rounded hover:bg-[var(--color-bg)] text-[var(--color-text)] transition-colors flex items-center justify-center"
                      aria-label="Set Track Color"
                      title="Set Track Color"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
                        <line x1="7" y1="2" x2="7" y2="22" />
                        <line x1="17" y1="2" x2="17" y2="22" />
                        <line x1="2" y1="12" x2="22" y2="12" />
                        <line x1="2" y1="7" x2="7" y2="7" />
                        <line x1="2" y1="17" x2="7" y2="17" />
                        <line x1="17" y1="17" x2="22" y2="17" />
                        <line x1="17" y1="7" x2="22" y2="7" />
                      </svg>
                    </button>
                    <Show when={showColorPicker()}>
                      <div
                        ref={colorPickerRef}
                        class="absolute top-full left-0 mt-1 z-50 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg p-2 shadow-lg"
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
                  <button
                    onClick={handleRenameStart}
                    class="p-1 rounded hover:bg-[var(--color-bg)] text-[var(--color-text)] transition-colors flex items-center justify-center"
                    aria-label="Rename Track"
                    title="Rename Track"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <Show when={props.canDelete}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        props.onDelete();
                      }}
                      class="p-1 rounded hover:bg-[var(--color-danger)]/20 text-[var(--color-text)] hover:text-[var(--color-danger)] transition-colors flex items-center justify-center"
                      aria-label="Delete Track"
                      title="Delete Track"
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
                  </Show>
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
              class="flex-1 px-2 py-1 text-sm bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              autofocus
            />
          </Show>
        </div>
        <div class="text-xs text-[var(--color-text)] space-y-1 opacity-70">
          <div>Duration: {formatTime(props.track.duration)}</div>
          {props.track.audioBuffer && (
            <div>Channels: {props.track.audioBuffer.numberOfChannels}</div>
          )}
          {props.track.audioBuffer && (
            <div>Sample Rate: {Math.round(props.track.audioBuffer.sampleRate / 1000)}kHz</div>
          )}
        </div>
      </div>
      <div class="flex-1 overflow-x-auto overflow-y-hidden [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-[var(--color-bg)] [&::-webkit-scrollbar-track]:rounded [&::-webkit-scrollbar-thumb]:bg-[var(--color-border)] [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:border [&::-webkit-scrollbar-thumb]:border-[var(--color-bg)] [&::-webkit-scrollbar-thumb]:hover:bg-[var(--color-border-hover)]">
        <div
          ref={handleContainerRef}
          class="min-h-[150px] sm:min-h-[180px] md:min-h-[200px] flex-shrink-0 [&_wave]:cursor-pointer [&>*]:overflow-visible [&_wave]:overflow-visible [&>*]:overflow-x-visible [&_wave]:overflow-x-visible"
          style={{
            width: trackWidth(),
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
  const { store, setCurrentTrackId, deleteTrack, setAudioStore } = useAudioStore();
  const [mainContainerRef, setMainContainerRef] = createSignal<HTMLDivElement | undefined>(
    undefined
  );
  const [tracksContainerRef, setTracksContainerRef] = createSignal<HTMLDivElement | undefined>(
    undefined
  );

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

  const handleTrackDelete = (trackId: string) => {
    if (store.tracks.length <= 1) {
      return;
    }
    deleteTrack(trackId);
  };

  const handleTrackRename = (trackId: string, name: string) => {
    setAudioStore("tracks", (tracks) => tracks.map((t) => (t.id === trackId ? { ...t, name } : t)));
  };

  const handleTrackColorChange = (trackId: string, color: string | null) => {
    setAudioStore("tracks", (tracks) =>
      tracks.map((t) => (t.id === trackId ? { ...t, backgroundColor: color } : t))
    );
  };

  return (
    <div class="w-full h-full relative flex flex-col overflow-hidden">
      <Show when={store.tracks.length > 0}>
        <div class="w-full h-full bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg relative flex flex-col overflow-hidden">
          <div class="flex border-b border-[var(--color-border)] flex-shrink-0 relative">
            <div class="w-48 sm:w-56 md:w-64 border-r border-[var(--color-border)] bg-[var(--color-bg-elevated)] flex-shrink-0"></div>
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
                {(track) => (
                  <TrackRow
                    track={track}
                    isCurrent={track.id === store.currentTrackId}
                    onSelect={() => handleTrackSelect(track.id)}
                    onDelete={() => handleTrackDelete(track.id)}
                    onRename={(name) => handleTrackRename(track.id, name)}
                    onColorChange={(color) => handleTrackColorChange(track.id, color)}
                    canDelete={store.tracks.length > 1}
                    onWaveformReady={props.onWaveformReady}
                    onContainerRef={handleContainerRef}
                    onSelectionCreated={props.onSelectionCreated}
                  />
                )}
              </For>
            </div>
          </div>
        </div>
      </Show>
      {store.tracks.length === 0 && (
        <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center text-[var(--color-text-secondary)] pointer-events-none text-xs sm:text-sm md:text-[0.9375rem] p-3 sm:p-4 md:p-6 lg:p-8 opacity-70 max-w-[90%]">
          <p>Import an audio file or start recording to begin editing</p>
        </div>
      )}
    </div>
  );
};
