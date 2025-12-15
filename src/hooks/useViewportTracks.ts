import { createSignal, createEffect, onCleanup, Accessor } from "solid-js";
import type { AudioTrack } from "../stores/audioStore";

interface ViewportTrack {
  track: AudioTrack;
  index: number;
  isVisible: boolean;
}

const TRACK_HEIGHT = 200;
const VIEWPORT_PADDING = 2;

export function useViewportTracks(
  tracks: Accessor<AudioTrack[]>,
  containerRef: Accessor<HTMLElement | undefined>
) {
  const [visibleTracks, setVisibleTracks] = createSignal<ViewportTrack[]>([]);
  const [isIntersecting, setIsIntersecting] = createSignal(true);

  createEffect(() => {
    const container = containerRef();
    if (!container) {
      setVisibleTracks([]);
      return;
    }

    let rafId: number | null = null;
    let lastStartIndex = -1;
    let lastEndIndex = -1;

    const updateVisibleTracks = () => {
      const scrollTop = container.scrollTop;
      const containerHeight = container.clientHeight;

      const allTracks = tracks();
      if (allTracks.length === 0) {
        setVisibleTracks([]);
        return;
      }

      const startIndex = Math.max(0, Math.floor(scrollTop / TRACK_HEIGHT) - VIEWPORT_PADDING);
      const endIndex = Math.min(
        allTracks.length - 1,
        Math.ceil((scrollTop + containerHeight) / TRACK_HEIGHT) + VIEWPORT_PADDING
      );

      if (startIndex === lastStartIndex && endIndex === lastEndIndex) {
        return;
      }

      lastStartIndex = startIndex;
      lastEndIndex = endIndex;

      const visible: ViewportTrack[] = [];
      for (let i = startIndex; i <= endIndex; i++) {
        if (i >= 0 && i < allTracks.length) {
          visible.push({
            track: allTracks[i]!,
            index: i,
            isVisible: i >= startIndex && i <= endIndex,
          });
        }
      }

      setVisibleTracks(visible);
    };

    const throttledUpdate = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        updateVisibleTracks();
        rafId = null;
      });
    };

    updateVisibleTracks();

    container.addEventListener("scroll", throttledUpdate, { passive: true });

    const resizeObserver = new ResizeObserver(throttledUpdate);
    resizeObserver.observe(container);

    const tracksList = tracks();
    if (tracksList.length > 0) {
      updateVisibleTracks();
    }

    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        setIsIntersecting(entries[0]?.isIntersecting ?? false);
      },
      { threshold: 0 }
    );
    intersectionObserver.observe(container);

    onCleanup(() => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      container.removeEventListener("scroll", throttledUpdate);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
    });
  });

  return {
    visibleTracks,
    isIntersecting,
  };
}
