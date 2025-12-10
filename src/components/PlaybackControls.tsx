import { Component, onCleanup, onMount } from "solid-js";
import { useAudioStore } from "../stores/audioStore";
import { Button } from "./Button";

interface PlaybackControlsProps {
  waveform?: ReturnType<typeof import("../hooks/useWaveform").useWaveform>;
}

export const PlaybackControls: Component<PlaybackControlsProps> = (props) => {
  const { store, setCurrentTime } = useAudioStore();

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handlePlayPause = () => {
    if (!props.waveform) return;
    if (store.isPlaying) {
      props.waveform.pause();
    } else {
      props.waveform.play();
    }
  };

  const handleStop = () => {
    if (!props.waveform) return;
    props.waveform.stop();
  };

  let seekbarRef: HTMLDivElement | undefined;
  let isDragging = false;

  const updateSeek = (e: MouseEvent) => {
    if (!props.waveform || !store.tracks.length || !seekbarRef) return;
    const rect = seekbarRef.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    const progress = Math.max(0, Math.min(1, x / width));
    const duration = store.tracks.find((t) => t.id === store.currentTrackId)?.duration || 0;
    const newTime = progress * duration;
    props.waveform.seekTo(newTime / duration);
    setCurrentTime(newTime);
  };

  const handleSeek = (e: MouseEvent) => {
    updateSeek(e);
  };

  const handleMouseDown = (e: MouseEvent) => {
    isDragging = true;
    updateSeek(e);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      updateSeek(e);
    }
  };

  const handleMouseUp = () => {
    isDragging = false;
  };

  onMount(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  });

  onCleanup(() => {
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
  });

  const currentTrack = () => store.tracks.find((t) => t.id === store.currentTrackId);
  const duration = () => currentTrack()?.duration || 0;
  const progress = () => {
    const dur = duration();
    if (dur <= 0) return 0;
    const time = store.currentTime;
    if (time >= dur - 0.01) return 1;
    const progressValue = time / dur;
    return Math.min(1, Math.max(0, progressValue));
  };

  return (
    <div class="flex items-center gap-2 sm:gap-3 md:gap-4 justify-center flex-1 min-w-0">
      <div class="flex gap-1 sm:gap-1.5">
        <Button
          icon={
            store.isPlaying ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            )
          }
          label={store.isPlaying ? "Pause" : "Play"}
          onClick={handlePlayPause}
          disabled={!currentTrack()}
          variant="secondary"
        />
        <Button
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h12v12H6z" />
            </svg>
          }
          label="Stop"
          onClick={handleStop}
          disabled={!currentTrack()}
          variant="secondary"
        />
      </div>
      <div class="flex items-center gap-1 text-xs sm:text-[0.8125rem] font-medium text-[var(--color-text-secondary)] tabular-nums min-w-[60px] sm:min-w-[80px] justify-center">
        <span>{formatTime(store.currentTime)}</span>
        <span class="mx-1 text-[var(--color-text-secondary)]">/</span>
        <span>{formatTime(duration())}</span>
      </div>
      <div
        ref={seekbarRef}
        class="relative w-[150px] sm:w-[200px] md:w-[250px] lg:w-[300px] h-1.5 bg-[var(--color-border)] rounded-sm cursor-pointer overflow-hidden transition-[height] duration-200 hover:h-2"
        onClick={handleSeek}
        onMouseDown={handleMouseDown}
      >
        <div
          class="absolute top-0 left-0 h-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] rounded transition-[width] duration-[100ms] linear"
          style={{ width: `${progress() * 100}%` }}
        />
      </div>
    </div>
  );
};
