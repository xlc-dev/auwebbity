import { Component, createMemo, createEffect, createSignal } from "solid-js";
import { useAudioStore } from "../stores/audioStore";

interface TimeRulerProps {
  containerRef: () => HTMLDivElement | undefined;
}

export const TimeRuler: Component<TimeRulerProps> = (props) => {
  const { store } = useAudioStore();
  const [width, setWidth] = createSignal(0);

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

    const updateWidth = () => {
      const w = container.scrollWidth || container.offsetWidth || 0;
      setWidth(w);
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(container);

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
    const container = props.containerRef();
    const containerWidth = container?.scrollWidth || width() || 0;

    if (dur <= 0 || containerWidth <= 0) return [];

    const pixelsPerSecond = containerWidth / dur;
    const interval = getInterval(pixelsPerSecond);

    const result: Array<{ time: number; position: number }> = [];
    for (let time = 0; time <= dur; time += interval) {
      const position = time * pixelsPerSecond;
      if (position <= containerWidth) {
        result.push({ time, position });
      }
    }

    if (result.length === 0 && dur > 0) {
      result.push({ time: 0, position: 0 });
      result.push({ time: dur, position: containerWidth });
    }

    return result;
  });

  const effectiveWidth = createMemo(() => {
    const container = props.containerRef();
    const containerWidth = container?.scrollWidth || width() || 0;
    return containerWidth > 0 ? containerWidth : 0;
  });

  return (
    <div
      class="relative w-full h-5 sm:h-6 border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)] flex-shrink-0"
      style={{ width: effectiveWidth() > 0 ? `${effectiveWidth()}px` : "100%" }}
    >
      {markers().map((marker) => (
        <div
          class="absolute top-0 h-full pointer-events-none"
          style={{ left: `${marker.position}px` }}
        >
          <div class="w-px h-full bg-[var(--color-border)] opacity-30" />
          <span class="absolute top-0.5 left-0.5 text-[0.5rem] sm:text-[0.625rem] font-medium text-[var(--color-text-secondary)] tabular-nums whitespace-nowrap">
            {formatTime(marker.time)}
          </span>
        </div>
      ))}
    </div>
  );
};
