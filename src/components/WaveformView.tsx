import { Component, onMount, Show } from "solid-js";
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

  const hasTracks = () => store.tracks.length > 0;

  return (
    <div class="w-full h-full relative flex flex-col items-center p-2 sm:p-4 md:p-6 lg:p-8 overflow-hidden">
      <Show when={hasTracks()}>
        <div class="w-full max-w-[1200px] bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg relative flex flex-col h-full overflow-hidden">
          <div class="flex-1 overflow-x-auto overflow-y-hidden [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-[var(--color-bg)] [&::-webkit-scrollbar-track]:rounded [&::-webkit-scrollbar-thumb]:bg-[var(--color-border)] [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:border [&::-webkit-scrollbar-thumb]:border-[var(--color-bg)] [&::-webkit-scrollbar-thumb]:hover:bg-[var(--color-border-hover)]">
            <div class="flex flex-col">
              <TimeRuler containerRef={() => containerRef} />
              <div
                ref={containerRef}
                class="min-h-[150px] sm:min-h-[180px] md:min-h-[200px] flex-shrink-0 [&_wave]:cursor-pointer [&_[data-name='cursor']]:!w-[3px] [&_[data-name='cursor']]:!bg-[#4a9eff] [&_[data-name='cursor']]:!z-[10] [&_[data-name='progress']]:!bg-[rgba(74,158,255,0.4)] [&>*]:overflow-visible [&_wave]:overflow-visible [&>*]:overflow-x-visible [&_wave]:overflow-x-visible"
              />
            </div>
          </div>
        </div>
      </Show>
      {!hasTracks() && (
        <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center text-[var(--color-text-secondary)] pointer-events-none text-xs sm:text-sm md:text-[0.9375rem] p-3 sm:p-4 md:p-6 lg:p-8 opacity-70 max-w-[90%]">
          <p>Import an audio file or start recording to begin editing</p>
        </div>
      )}
    </div>
  );
};
