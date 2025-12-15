import { Component, createMemo, createEffect, createSignal, Show, For } from "solid-js";
import { useAudioStore } from "../stores/audioStore";

interface TimeRulerProps {
  containerRef: () => HTMLDivElement | undefined;
}

export const TimeRuler: Component<TimeRulerProps> = (props) => {
  const { store, removeMarker } = useAudioStore();
  const [width, setWidth] = createSignal(0);

  const duration = createMemo(() => {
    const tracks = store.tracks;
    return tracks.length > 0 ? Math.max(...tracks.map((t) => t.duration), 0) : 0;
  });

  const pixelsPerSecond = createMemo(() => {
    const dur = duration();
    if (dur <= 0) return 0;

    const containerWidth = width();
    if (containerWidth <= 0) return 0;

    const zoom = store.zoom;
    if (zoom <= 100) {
      return containerWidth / dur;
    }

    return (containerWidth / dur) * (zoom / 100);
  });

  const formatTime = (seconds: number): string => {
    const pps = pixelsPerSecond();
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;

    if (pps > 500) {
      if (mins === 0) {
        return `${seconds.toFixed(2)}s`;
      }
      const secsStr = secs.toFixed(2);
      return `${mins}:${secsStr.padStart(5, "0")}`;
    } else if (pps > 200) {
      if (mins === 0) {
        return `${seconds.toFixed(1)}s`;
      }
      const secsStr = secs.toFixed(1);
      return `${mins}:${secsStr.padStart(4, "0")}`;
    } else if (pps > 100) {
      if (mins === 0) {
        return `${Math.floor(secs)}s`;
      }
      return `${mins}:${Math.floor(secs).toString().padStart(2, "0")}`;
    } else {
      if (mins === 0) {
        return `${Math.floor(secs)}s`;
      }
      return `${mins}:${Math.floor(secs).toString().padStart(2, "0")}`;
    }
  };

  const getInterval = (pixelsPerSecond: number): number => {
    if (pixelsPerSecond > 500) return 0.1;
    if (pixelsPerSecond > 200) return 0.5;
    if (pixelsPerSecond > 100) return 1;
    if (pixelsPerSecond > 50) return 5;
    if (pixelsPerSecond > 20) return 10;
    if (pixelsPerSecond > 10) return 30;
    if (pixelsPerSecond > 5) return 60;
    return 120;
  };

  createEffect(() => {
    const container = props.containerRef();
    if (!container) {
      const checkContainer = () => {
        const c = props.containerRef();
        if (c) {
          const scrollContainer = c.parentElement;
          if (scrollContainer) {
            const updateWidth = () => {
              const w = scrollContainer.offsetWidth || scrollContainer.clientWidth || 0;
              if (w > 0) {
                setWidth(w);
              }
            };
            updateWidth();
            const observer = new ResizeObserver(updateWidth);
            observer.observe(scrollContainer);
            return () => observer.disconnect();
          }
        }
        return undefined;
      };
      const timeout = setTimeout(checkContainer, 0);
      return () => clearTimeout(timeout);
    }

    const scrollContainer = container.parentElement;
    if (!scrollContainer) return;

    const updateWidth = () => {
      const w = scrollContainer.offsetWidth || scrollContainer.clientWidth || 0;
      if (w > 0) {
        setWidth(w);
      }
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(scrollContainer);

    const zoom = store.zoom;
    const tracksLength = store.tracks.length;
    if (zoom !== undefined || tracksLength !== undefined) {
      requestAnimationFrame(updateWidth);
    }

    return () => {
      observer.disconnect();
    };
  });

  const markers = createMemo(() => {
    const dur = duration();
    if (dur <= 0) return [];

    const pps = pixelsPerSecond();
    if (pps <= 0) return [];

    const timelineWidth = dur * pps;
    const interval = getInterval(pps);

    const result: Array<{ time: number; position: number }> = [];
    for (let time = 0; time <= dur; time += interval) {
      const position = time * pps;
      if (position <= timelineWidth) {
        result.push({ time, position });
      }
    }

    if (result.length === 0 && dur > 0) {
      result.push({ time: 0, position: 0 });
      result.push({ time: dur, position: timelineWidth });
    }

    return result;
  });

  const effectiveWidth = createMemo(() => {
    const containerWidth = width();
    if (containerWidth <= 0) return 0;

    const zoom = store.zoom;
    if (zoom <= 100) {
      return containerWidth;
    }

    const dur = duration();
    if (dur <= 0) return containerWidth;

    const pps = pixelsPerSecond();
    if (pps <= 0) return containerWidth;

    const timelineWidth = dur * pps;
    const calculatedWidth = Math.ceil(timelineWidth);

    return Math.max(containerWidth, calculatedWidth);
  });

  const repeatMarkerPositions = createMemo(() => {
    const repeatRegion = store.repeatRegion;
    if (!repeatRegion) return null;

    const dur = duration();
    if (dur <= 0) return null;

    const pps = pixelsPerSecond();
    if (pps <= 0) return null;

    const startPos = repeatRegion.start * pps;
    const endPos = repeatRegion.end * pps;
    return { start: startPos, end: endPos };
  });

  const markerPositions = createMemo(() => {
    const markers = store.markers;
    if (!markers || markers.length === 0) return [];

    const dur = duration();
    if (dur <= 0) return [];

    const pps = pixelsPerSecond();
    if (pps <= 0) return [];

    return markers.map((time) => ({
      time,
      position: time * pps,
    }));
  });

  return (
    <div
      class="relative w-full h-7 sm:h-8 border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)] flex-shrink-0 overflow-hidden pointer-events-none"
      style={{
        width: effectiveWidth() > 0 ? `${effectiveWidth()}px` : "100%",
        "max-width": "100%",
      }}
    >
      {markers().map((marker) => {
        const effWidth = effectiveWidth();
        const constrainedPos =
          effWidth > 0 ? Math.min(marker.position, effWidth - 1) : marker.position;
        return (
          <div
            class="absolute top-0 h-full pointer-events-none"
            style={{ left: `${constrainedPos}px` }}
          >
            <div class="w-px h-full bg-[var(--color-border)] opacity-30" />
            <span class="absolute top-0.5 left-0.5 text-[0.5rem] sm:text-[0.625rem] font-medium text-[var(--color-text-secondary)] tabular-nums whitespace-nowrap">
              {formatTime(marker.time)}
            </span>
          </div>
        );
      })}
      <Show when={store.repeatRegion && repeatMarkerPositions()}>
        {(pos) => {
          const effWidth = effectiveWidth();
          const startPos = Math.max(6, Math.min(pos().start, effWidth - 6));
          const endPos = Math.max(6, Math.min(pos().end, effWidth - 6));
          return (
            <>
              <div
                class="absolute top-0 w-0 h-0 border-r-[6px] border-r-yellow-500 border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent z-[25] pointer-events-none"
                style={{ left: `${startPos - 6}px` }}
              />
              <div
                class="absolute top-0 w-0 h-0 border-l-[6px] border-l-yellow-500 border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent z-[25] pointer-events-none"
                style={{ left: `${endPos}px` }}
              />
            </>
          );
        }}
      </Show>
      <For each={markerPositions()}>
        {(marker) => {
          const effWidth = effectiveWidth();
          const constrainedPos = Math.max(0, Math.min(marker.position, effWidth - 1));
          return (
            <div
              class="absolute top-0 w-0 h-0 border-l-[4px] border-l-blue-500 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent z-[20] cursor-pointer hover:border-l-blue-400 hover:scale-110 transition-all pointer-events-auto"
              style={{ left: `${constrainedPos}px` }}
              onClick={(e) => {
                e.stopPropagation();
                removeMarker(marker.time);
              }}
              title="Click to delete marker"
            />
          );
        }}
      </For>
    </div>
  );
};
