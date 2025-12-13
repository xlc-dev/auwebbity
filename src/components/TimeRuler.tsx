import { Component, createMemo, createEffect, createSignal, onCleanup, Show } from "solid-js";
import { useAudioStore } from "../stores/audioStore";

interface TimeRulerProps {
  containerRef: () => HTMLDivElement | undefined;
  onSeek?: (time: number) => void;
  onSetRepeatStart?: (time: number) => void;
  onSetRepeatEnd?: (time: number) => void;
  onClearRepeat?: () => void;
}

export const TimeRuler: Component<TimeRulerProps> = (props) => {
  const { store, setCurrentTime } = useAudioStore();
  const [width, setWidth] = createSignal(0);
  const [selectingRepeatStart, setSelectingRepeatStart] = createSignal(false);

  const duration = () => Math.max(...store.tracks.map((t) => t.duration), 0);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;

    if (mins === 0) {
      if (seconds < 1) {
        return `${seconds.toFixed(1)}`;
      }
      return `${secs.toFixed(secs < 10 ? 1 : 0)}`;
    }

    return `${mins}:${Math.floor(secs).toString().padStart(2, "0")}`;
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
    if (!container) return;

    const scrollContainer = container.parentElement;
    if (!scrollContainer) return;

    const updateWidth = () => {
      const w = scrollContainer.offsetWidth || scrollContainer.clientWidth || 0;
      setWidth(w);
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(scrollContainer);

    const checkWidth = () => {
      requestAnimationFrame(updateWidth);
    };

    store.zoom;
    store.tracks.length;
    store.currentTrackId;
    checkWidth();

    return () => {
      observer.disconnect();
    };
  });

  const markers = createMemo(() => {
    const dur = duration();
    if (dur <= 0) return [];

    const containerWidth = width();
    if (containerWidth <= 0) return [];

    const pixelsPerSecond = (containerWidth / dur) * (store.zoom / 100);
    const timelineWidth = dur * pixelsPerSecond;
    const interval = getInterval(pixelsPerSecond);

    const result: Array<{ time: number; position: number }> = [];
    for (let time = 0; time <= dur; time += interval) {
      const position = time * pixelsPerSecond;
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
    const dur = duration();
    if (dur <= 0) return 0;

    const containerWidth = width();
    if (containerWidth <= 0) return 0;

    const pixelsPerSecond = (containerWidth / dur) * (store.zoom / 100);
    const timelineWidth = dur * pixelsPerSecond;

    return Math.min(Math.ceil(timelineWidth), Math.ceil(containerWidth * (store.zoom / 100)));
  });

  const repeatMarkerPositions = createMemo(() => {
    if (!store.repeatRegion) return null;
    const dur = duration();
    if (dur <= 0) return null;

    const containerWidth = width();
    if (containerWidth <= 0) return null;

    const pixelsPerSecond = (containerWidth / dur) * (store.zoom / 100);
    const startPos = store.repeatRegion.start * pixelsPerSecond;
    const endPos = store.repeatRegion.end * pixelsPerSecond;
    return { start: startPos, end: endPos };
  });

  const getTimeFromEvent = (e: MouseEvent): number | null => {
    const dur = duration();
    if (dur <= 0) return null;

    const target = e.currentTarget as HTMLElement;
    if (!target) return null;

    const rect = target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const containerWidth = width();
    if (containerWidth <= 0) return null;

    const pixelsPerSecond = (containerWidth / dur) * (store.zoom / 100);
    const timelineWidth = dur * pixelsPerSecond;
    const progress = Math.max(0, Math.min(1, x / timelineWidth));
    return progress * dur;
  };

  let selectionTimeout: ReturnType<typeof setTimeout> | null = null;

  const handleDoubleClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (store.repeatRegion) {
      if (props.onClearRepeat) {
        props.onClearRepeat();
      }
      setSelectingRepeatStart(false);
      if (selectionTimeout) {
        clearTimeout(selectionTimeout);
        selectionTimeout = null;
      }
      return;
    }

    const startTime = getTimeFromEvent(e);
    if (startTime === null) return;

    setSelectingRepeatStart(true);
    if (props.onSetRepeatStart) {
      props.onSetRepeatStart(startTime);
    }

    if (selectionTimeout) {
      clearTimeout(selectionTimeout);
    }
    selectionTimeout = setTimeout(() => {
      setSelectingRepeatStart(false);
      selectionTimeout = null;
    }, 5000);
  };

  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    if (store.repeatRegion && props.onClearRepeat) {
      props.onClearRepeat();
    }
  };

  const handleClick = (e: MouseEvent) => {
    if (selectingRepeatStart()) {
      e.preventDefault();
      e.stopPropagation();

      const endTime = getTimeFromEvent(e);
      if (endTime === null) return;

      setSelectingRepeatStart(false);
      if (selectionTimeout) {
        clearTimeout(selectionTimeout);
        selectionTimeout = null;
      }
      if (props.onSetRepeatEnd) {
        props.onSetRepeatEnd(endTime);
      }
      return;
    }

    const newTime = getTimeFromEvent(e);
    if (newTime === null) return;

    setCurrentTime(newTime);
    if (props.onSeek) {
      props.onSeek(newTime);
    }
  };

  return (
    <div
      class="relative w-full h-7 sm:h-8 border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)] flex-shrink-0 overflow-hidden"
      classList={{
        "cursor-pointer": !selectingRepeatStart(),
        "cursor-crosshair": selectingRepeatStart(),
      }}
      style={{
        width: effectiveWidth() > 0 ? `${effectiveWidth()}px` : "100%",
        "max-width": "100%",
      }}
      onClick={handleClick}
      onDblClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      title={
        selectingRepeatStart()
          ? "Click to set repeat end point"
          : store.repeatRegion
            ? "Double-click or press R to clear repeat"
            : "Double-click to set repeat start"
      }
    >
      <Show when={selectingRepeatStart()}>
        <div class="absolute inset-0 bg-blue-500/10 border-b-2 border-blue-500/50 z-[10] pointer-events-none" />
      </Show>
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
    </div>
  );

  onCleanup(() => {
    if (selectionTimeout) {
      clearTimeout(selectionTimeout);
    }
  });
};
