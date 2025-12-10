import { Component, createEffect, createSignal, onMount } from "solid-js";
import { useAudioStore } from "../stores/audioStore";

interface TimeRulerProps {
  containerRef: () => HTMLDivElement | undefined;
}

export const TimeRuler: Component<TimeRulerProps> = (props) => {
  const { store } = useAudioStore();
  let rulerRef: HTMLDivElement | undefined;
  const [rulerWidth, setRulerWidth] = createSignal(0);

  const currentTrack = () => store.tracks.find((t) => t.id === store.currentTrackId);
  const duration = () => currentTrack()?.duration || 0;

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const updateRulerWidth = () => {
    const container = props.containerRef();
    if (!container) return;

    const dur = duration();
    if (dur <= 0) {
      setRulerWidth(0);
      return;
    }

    let width = 0;

    const waveformElement = container.querySelector("wave") as HTMLElement;
    const svgElement = container.querySelector("svg") as HTMLElement;

    if (waveformElement) {
      width = Math.max(
        waveformElement.scrollWidth || 0,
        waveformElement.offsetWidth || 0,
        waveformElement.getBoundingClientRect().width || 0
      );
    }

    if (width === 0 && svgElement) {
      width = Math.max(
        svgElement.scrollWidth || 0,
        svgElement.offsetWidth || 0,
        svgElement.getBoundingClientRect().width || 0
      );
    }

    if (width === 0) {
      width = Math.max(
        container.scrollWidth || 0,
        container.offsetWidth || 0,
        container.getBoundingClientRect().width || 0
      );
    }

    if (width > 0) {
      setRulerWidth(width);
    } else if (container.offsetWidth > 0) {
      setRulerWidth(container.offsetWidth);
    }
  };

  onMount(() => {
    const container = props.containerRef();
    if (container) {
      const checkAndUpdate = () => {
        updateRulerWidth();
        setTimeout(updateRulerWidth, 50);
        setTimeout(updateRulerWidth, 200);
        setTimeout(updateRulerWidth, 500);
      };

      checkAndUpdate();

      const resizeObserver = new ResizeObserver(() => {
        setTimeout(updateRulerWidth, 10);
      });
      resizeObserver.observe(container);

      const mutationObserver = new MutationObserver(() => {
        setTimeout(updateRulerWidth, 10);
      });
      mutationObserver.observe(container, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["style", "class"],
      });

      const handleWaveformUpdate = () => {
        setTimeout(updateRulerWidth, 50);
        setTimeout(updateRulerWidth, 200);
        setTimeout(updateRulerWidth, 500);
      };

      container.addEventListener("waveform-updated", handleWaveformUpdate);

      return () => {
        resizeObserver.disconnect();
        mutationObserver.disconnect();
        container.removeEventListener("waveform-updated", handleWaveformUpdate);
      };
    }
  });

  createEffect(() => {
    const dur = duration();
    if (dur > 0) {
      updateRulerWidth();
      const timer1 = setTimeout(updateRulerWidth, 100);
      const timer2 = setTimeout(updateRulerWidth, 300);
      const timer3 = setTimeout(updateRulerWidth, 600);
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
      };
    }
  });

  createEffect(() => {
    const dur = duration();
    if (dur > 0) {
      setTimeout(updateRulerWidth, 100);
      setTimeout(updateRulerWidth, 300);
      setTimeout(updateRulerWidth, 600);
    }
  });

  createEffect(() => {
    store.zoom;
    setTimeout(updateRulerWidth, 50);
    setTimeout(updateRulerWidth, 200);
    setTimeout(updateRulerWidth, 500);
  });

  const getTimeMarkers = () => {
    const dur = duration();
    const width = rulerWidth();

    if (dur <= 0 || width <= 0) return [];

    const markers: Array<{ time: number; position: number }> = [];
    const pixelsPerSecond = width / dur;
    const interval = getInterval(dur, width);

    for (let time = 0; time <= dur; time += interval) {
      const position = time * pixelsPerSecond;
      if (position <= width) {
        markers.push({
          time,
          position,
        });
      }
    }

    if (markers.length === 0 && dur > 0) {
      markers.push({ time: 0, position: 0 });
      if (dur > 0) {
        markers.push({ time: dur, position: width });
      }
    }

    return markers;
  };

  const getInterval = (duration: number, width: number): number => {
    const pixelsPerSecond = width / duration;
    if (pixelsPerSecond > 100) return 1;
    if (pixelsPerSecond > 50) return 5;
    if (pixelsPerSecond > 20) return 10;
    if (pixelsPerSecond > 10) return 30;
    return 60;
  };

  return (
    <div class="time-ruler" ref={rulerRef} style={{ width: `${rulerWidth()}px` }}>
      {getTimeMarkers().map((marker) => (
        <div class="time-ruler-marker" style={{ left: `${marker.position}px` }}>
          <div class="time-ruler-line" />
          <span class="time-ruler-label">{formatTime(marker.time)}</span>
        </div>
      ))}
    </div>
  );
};
