import { Component, createMemo, createEffect, createSignal } from "solid-js";
import { useAudioStore } from "../stores/audioStore";

interface TimeRulerProps {
  containerRef: () => HTMLDivElement | undefined;
}

export const TimeRuler: Component<TimeRulerProps> = (props) => {
  const { store } = useAudioStore();
  const [width, setWidth] = createSignal(0);

  const currentTrack = () => store.tracks.find((t) => t.id === store.currentTrackId);
  const duration = () => currentTrack()?.duration || 0;

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getInterval = (duration: number, width: number): number => {
    const pixelsPerSecond = width / duration;
    if (pixelsPerSecond > 100) return 1;
    if (pixelsPerSecond > 50) return 5;
    if (pixelsPerSecond > 20) return 10;
    if (pixelsPerSecond > 10) return 30;
    return 60;
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

    container.addEventListener("waveform-updated", updateWidth);

    return () => {
      observer.disconnect();
      container.removeEventListener("waveform-updated", updateWidth);
    };
  });

  createEffect(() => {
    store.zoom;
    const container = props.containerRef();
    if (container) {
      setTimeout(() => {
        const w = container.scrollWidth || container.offsetWidth || 0;
        setWidth(w);
      }, 100);
    }
  });

  const markers = createMemo(() => {
    const dur = duration();
    const container = props.containerRef();
    const w = width() || container?.scrollWidth || container?.offsetWidth || 0;

    if (dur <= 0) return [];

    const result: Array<{ time: number; position: number }> = [];
    const effectiveWidth = w > 0 ? w : 1000;
    const pixelsPerSecond = effectiveWidth / dur;
    const interval = getInterval(dur, effectiveWidth);

    for (let time = 0; time <= dur; time += interval) {
      const position = time * pixelsPerSecond;
      if (position <= effectiveWidth) {
        result.push({ time, position });
      }
    }

    if (result.length === 0 && dur > 0) {
      result.push({ time: 0, position: 0 });
      result.push({ time: dur, position: effectiveWidth });
    }

    return result;
  });

  const container = props.containerRef();
  const effectiveWidth = width() || container?.scrollWidth || container?.offsetWidth || 0;

  return (
    <div
      class="relative w-full min-w-fit h-10 border-b border-[var(--color-border)] bg-gradient-to-b from-[var(--color-bg-elevated)] to-[var(--color-bg)] flex-shrink-0 py-2 px-4 m-0 mb-2 rounded-tl-lg rounded-tr-lg"
      style={{ width: effectiveWidth > 0 ? `${effectiveWidth}px` : "100%" }}
    >
      {markers().map((marker) => (
        <div
          class="absolute top-0 h-full pointer-events-none"
          style={{ left: `${marker.position}px` }}
        >
          <div class="w-px h-full bg-[var(--color-border)] opacity-40" />
          <span class="absolute top-2.5 left-1 text-[0.6875rem] font-medium text-[var(--color-text)] tabular-nums whitespace-nowrap bg-[var(--color-bg-elevated)] py-0.5 px-1.5 leading-tight rounded border border-[var(--color-border)]">
            {formatTime(marker.time)}
          </span>
        </div>
      ))}
    </div>
  );
};
