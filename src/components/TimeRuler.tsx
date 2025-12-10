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
    const w = width();

    if (dur <= 0 || w <= 0) return [];

    const result: Array<{ time: number; position: number }> = [];
    const pixelsPerSecond = w / dur;
    const interval = getInterval(dur, w);

    for (let time = 0; time <= dur; time += interval) {
      const position = time * pixelsPerSecond;
      if (position <= w) {
        result.push({ time, position });
      }
    }

    if (result.length === 0 && dur > 0) {
      result.push({ time: 0, position: 0 });
      result.push({ time: dur, position: w });
    }

    return result;
  });

  return (
    <div class="time-ruler" style={{ width: `${width() || "100%"}` }}>
      {markers().map((marker) => (
        <div class="time-ruler-marker" style={{ left: `${marker.position}px` }}>
          <div class="time-ruler-line" />
          <span class="time-ruler-label">{formatTime(marker.time)}</span>
        </div>
      ))}
    </div>
  );
};
