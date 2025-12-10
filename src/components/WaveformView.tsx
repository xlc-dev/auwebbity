import { Component, createEffect, onMount, Show } from "solid-js";
import { useWaveform } from "../hooks/useWaveform";
import { useAudioStore } from "../stores/audioStore";
import { TimeRuler } from "./TimeRuler";

interface WaveformViewProps {
  onWaveformReady?: (waveform: ReturnType<typeof useWaveform>) => void;
}

export const WaveformView: Component<WaveformViewProps> = (props) => {
  let containerRef: HTMLDivElement | undefined;
  const { store } = useAudioStore();
  const waveform = useWaveform(() => containerRef);

  onMount(() => {
    props.onWaveformReady?.(waveform);
  });

  createEffect(() => {
    const currentTrack = store.tracks.find((t) => t.id === store.currentTrackId);
    if (currentTrack?.audioUrl) {
      waveform.loadAudio(currentTrack.audioUrl);
      setTimeout(() => {
        if (containerRef) {
          const event = new Event("waveform-updated");
          containerRef.dispatchEvent(event);
        }
      }, 500);
    } else if (store.tracks.length === 0) {
      waveform.clearAudio();
    }
  });

  createEffect(() => {
    waveform.setZoom(store.zoom);
  });

  const hasTracks = () => store.tracks.length > 0;

  return (
    <div class="waveform-container">
      <Show when={hasTracks()}>
        <div class="waveform-track-background">
          <div class="waveform-scroll-wrapper">
            <TimeRuler containerRef={() => containerRef} />
            <div ref={containerRef} class="waveform-view" />
          </div>
        </div>
      </Show>
      {!hasTracks() && (
        <div class="waveform-empty">
          <p>Import an audio file or start recording to begin editing</p>
        </div>
      )}
    </div>
  );
};
