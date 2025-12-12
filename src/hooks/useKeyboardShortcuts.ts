import { onMount, onCleanup } from "solid-js";
import { useAudioStore } from "../stores/audioStore";

interface UseKeyboardShortcutsOptions {
  waveform: () => ReturnType<typeof import("./useWaveform").useWaveform> | null;
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDelete: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onPlayPause?: () => void;
  onClearRepeat?: () => void;
}

export const useKeyboardShortcuts = (options: UseKeyboardShortcutsOptions) => {
  const { store } = useAudioStore();

  const handleKeyDown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const isInput =
      target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

    if (e.code === "Space" || e.key === " ") {
      if (isInput) return;

      e.preventDefault();

      if (options.onPlayPause) {
        options.onPlayPause();
      } else {
        const waveform = options.waveform();
        if (!waveform) return;

        const currentTrack = store.tracks.find((t) => t.id === store.currentTrackId);
        if (!currentTrack) return;

        if (store.isPlaying) {
          waveform.pause();
        } else {
          waveform.play();
        }
      }
      return;
    }

    if (isInput) return;

    if ((e.ctrlKey || e.metaKey) && e.key === "x") {
      e.preventDefault();
      if (store.selection) {
        options.onCut();
      }
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === "c") {
      e.preventDefault();
      if (store.selection) {
        options.onCopy();
      }
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === "v") {
      e.preventDefault();
      if (store.clipboard) {
        options.onPaste();
      }
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
      e.preventDefault();
      options.onUndo();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
      e.preventDefault();
      options.onRedo();
      return;
    }

    if ((e.key === "Delete" || e.key === "Backspace") && store.selection) {
      e.preventDefault();
      options.onDelete();
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      if (store.selection) {
        options.waveform()?.clearSelection();
      }
      return;
    }

    if (e.key === "r" || e.key === "R") {
      e.preventDefault();
      if (store.repeatRegion && options.onClearRepeat) {
        options.onClearRepeat();
      }
      return;
    }
  };

  onMount(() => {
    window.addEventListener("keydown", handleKeyDown);
  });

  onCleanup(() => {
    window.removeEventListener("keydown", handleKeyDown);
  });
};
