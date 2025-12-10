import { createSignal, Show, onMount, onCleanup, createEffect } from "solid-js";
import { WaveformView } from "./components/WaveformView";
import { PlaybackControls } from "./components/PlaybackControls";
import { SelectionToolbar } from "./components/SelectionToolbar";
import { ZoomControls } from "./components/ZoomControls";
import { FloatingButton } from "./components/FloatingButton";
import { ToastContainer } from "./components/Toast";
import { KeyboardShortcuts } from "./components/KeyboardShortcuts";
import { Dropdown } from "./components/Dropdown";
import { ConfirmationDialog } from "./components/ConfirmationDialog";
import { Spinner } from "./components/Spinner";
import { useAudioStore, initializeStore } from "./stores/audioStore";
import { useAudioRecorder } from "./hooks/useAudioRecorder";
import { useWaveform } from "./hooks/useWaveform";
import { audioOperations } from "./utils/audioOperations";

import "./app.css";

export default function App() {
  const {
    store,
    addTrack,
    setSelection,
    setClipboard,
    getCurrentTrack,
    setAudioStore,
    resetStore,
    saveToHistory,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useAudioStore();
  const recorder = useAudioRecorder();
  const [waveformRef, setWaveformRef] = createSignal<ReturnType<typeof useWaveform> | null>(null);
  const [toasts, setToasts] = createSignal<
    Array<{ id: string; message: string; type?: "error" | "success" | "info" }>
  >([]);
  const [isInitialized, setIsInitialized] = createSignal(false);
  const [showResetDialog, setShowResetDialog] = createSignal(false);
  const [showShortcuts, setShowShortcuts] = createSignal(false);
  const [isLoading, setIsLoading] = createSignal(false);
  let fileInputRef: HTMLInputElement | undefined;

  const addToast = (message: string, type: "error" | "success" | "info" = "error") => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const isInput =
      target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

    if (e.code === "Space" || e.key === " ") {
      if (isInput) return;

      e.preventDefault();
      const waveform = waveformRef();
      if (!waveform) return;

      const currentTrack = getCurrentTrack();
      if (!currentTrack) return;

      if (store.isPlaying) {
        waveform.pause();
      } else {
        waveform.play();
      }
      return;
    }

    if (isInput) return;

    if ((e.ctrlKey || e.metaKey) && e.key === "x") {
      e.preventDefault();
      if (store.selection) {
        handleCut();
      }
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === "c") {
      e.preventDefault();
      if (store.selection) {
        handleCopy();
      }
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === "v") {
      e.preventDefault();
      if (store.clipboard) {
        handlePaste();
      }
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
      e.preventDefault();
      handleUndo();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
      e.preventDefault();
      handleRedo();
      return;
    }

    if ((e.key === "Delete" || e.key === "Backspace") && store.selection) {
      e.preventDefault();
      handleDelete();
      return;
    }

    if (e.key === "Escape" && store.selection) {
      e.preventDefault();
      waveformRef()?.clearSelection();
      return;
    }
  };

  onMount(async () => {
    window.addEventListener("keydown", handleKeyDown);

    await initializeStore();
    setIsInitialized(true);
  });

  createEffect(() => {
    if (isInitialized() && waveformRef()) {
      const currentTrack = getCurrentTrack();
      if (currentTrack?.audioUrl) {
        waveformRef()?.loadAudio(currentTrack.audioUrl);
      }
    }
  });

  onCleanup(() => {
    window.removeEventListener("keydown", handleKeyDown);
  });

  const handleFileImport = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    setIsLoading(true);
    try {
      const audioUrl = URL.createObjectURL(file);
      const audioContext = new AudioContext();
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      addTrack({
        name: file.name,
        audioBuffer,
        audioUrl,
        duration: audioBuffer.duration,
      });
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to import audio");
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef?.click();
  };

  const handleCut = async () => {
    const currentTrack = getCurrentTrack();
    if (!currentTrack?.audioBuffer || !store.selection) return;

    setIsLoading(true);
    try {
      await saveToHistory(currentTrack.id);

      setClipboard(null);

      const copiedBuffer = await audioOperations.copy(
        currentTrack.audioBuffer,
        store.selection.start,
        store.selection.end
      );
      setClipboard(copiedBuffer);

      const { before, after } = await audioOperations.cut(
        currentTrack.audioBuffer,
        store.selection.start,
        store.selection.end
      );

      const audioContext = new AudioContext();
      const newLength = before.length + after.length;
      const newBuffer = audioContext.createBuffer(
        currentTrack.audioBuffer.numberOfChannels,
        newLength,
        currentTrack.audioBuffer.sampleRate
      );

      for (let channel = 0; channel < newBuffer.numberOfChannels; channel++) {
        const newData = newBuffer.getChannelData(channel);
        const beforeData = before.getChannelData(channel);
        const afterData = after.getChannelData(channel);

        for (let i = 0; i < before.length; i++) {
          newData[i] = beforeData[i];
        }
        for (let i = 0; i < after.length; i++) {
          newData[before.length + i] = afterData[i];
        }
      }

      const blob = await audioOperations.audioBufferToBlob(newBuffer);
      const newUrl = URL.createObjectURL(blob);

      const trackIndex = store.tracks.findIndex((t) => t.id === currentTrack.id);
      if (trackIndex !== -1) {
        setAudioStore("tracks", trackIndex, {
          ...currentTrack,
          audioBuffer: newBuffer,
          audioUrl: newUrl,
          duration: newBuffer.duration,
        });
      }

      setSelection(null);
      waveformRef()?.clearSelection();
      const updatedTrack = getCurrentTrack();
      if (updatedTrack?.audioUrl) {
        waveformRef()?.loadAudio(updatedTrack.audioUrl);
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to cut");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    const currentTrack = getCurrentTrack();
    if (!currentTrack?.audioBuffer || !store.selection) return;

    const copiedBuffer = await audioOperations.copy(
      currentTrack.audioBuffer,
      store.selection.start,
      store.selection.end
    );

    setClipboard(copiedBuffer);
    setSelection(null);
    waveformRef()?.clearSelection();
  };

  const handlePaste = async () => {
    const currentTrack = getCurrentTrack();
    if (!currentTrack?.audioBuffer || !store.clipboard) return;

    setIsLoading(true);
    try {
      const trackId = currentTrack.id;
      await saveToHistory(trackId);

      const insertTime = store.currentTime;
      const newBuffer = await audioOperations.paste(
        currentTrack.audioBuffer,
        store.clipboard,
        insertTime
      );

      const blob = await audioOperations.audioBufferToBlob(newBuffer);
      const newUrl = URL.createObjectURL(blob);

      const trackIndex = store.tracks.findIndex((t) => t.id === trackId);
      if (trackIndex !== -1) {
        setAudioStore("tracks", trackIndex, {
          ...currentTrack,
          audioBuffer: newBuffer,
          audioUrl: newUrl,
          duration: newBuffer.duration,
        });
        const updatedTrack = getCurrentTrack();
        if (updatedTrack?.audioUrl) {
          waveformRef()?.loadAudio(updatedTrack.audioUrl);
        }
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to paste");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    const currentTrack = getCurrentTrack();
    if (!currentTrack?.audioBuffer || !store.selection) return;

    setIsLoading(true);
    try {
      await saveToHistory(currentTrack.id);

      const { before, after } = await audioOperations.cut(
        currentTrack.audioBuffer,
        store.selection.start,
        store.selection.end
      );

      const audioContext = new AudioContext();
      const newLength = before.length + after.length;
      const newBuffer = audioContext.createBuffer(
        currentTrack.audioBuffer.numberOfChannels,
        newLength,
        currentTrack.audioBuffer.sampleRate
      );

      for (let channel = 0; channel < newBuffer.numberOfChannels; channel++) {
        const newData = newBuffer.getChannelData(channel);
        const beforeData = before.getChannelData(channel);
        const afterData = after.getChannelData(channel);

        for (let i = 0; i < before.length; i++) {
          newData[i] = beforeData[i];
        }
        for (let i = 0; i < after.length; i++) {
          newData[before.length + i] = afterData[i];
        }
      }

      const blob = await audioOperations.audioBufferToBlob(newBuffer);
      const newUrl = URL.createObjectURL(blob);

      const trackIndex = store.tracks.findIndex((t) => t.id === currentTrack.id);
      if (trackIndex !== -1) {
        setAudioStore("tracks", trackIndex, {
          ...currentTrack,
          audioBuffer: newBuffer,
          audioUrl: newUrl,
          duration: newBuffer.duration,
        });
      }

      setSelection(null);
      waveformRef()?.clearSelection();
      const updatedTrack = getCurrentTrack();
      if (updatedTrack?.audioUrl) {
        waveformRef()?.loadAudio(updatedTrack.audioUrl);
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUndo = async () => {
    const success = await undo();
    if (success) {
      const updatedTrack = getCurrentTrack();
      if (updatedTrack?.audioUrl) {
        waveformRef()?.loadAudio(updatedTrack.audioUrl);
      }
    }
  };

  const handleRedo = async () => {
    const success = await redo();
    if (success) {
      const updatedTrack = getCurrentTrack();
      if (updatedTrack?.audioUrl) {
        waveformRef()?.loadAudio(updatedTrack.audioUrl);
      }
    }
  };

  const [isExporting, setIsExporting] = createSignal(false);
  const [exportFormat, setExportFormat] = createSignal<"wav" | "mp3" | "ogg">("wav");

  const handleReset = () => {
    setShowResetDialog(true);
  };

  const handleResetConfirm = async () => {
    setShowResetDialog(false);

    waveformRef()?.stop();
    waveformRef()?.clearSelection();
    waveformRef()?.clearAudio();

    await resetStore();
  };

  const handleExport = async () => {
    const currentTrack = getCurrentTrack();
    if (!currentTrack?.audioBuffer) {
      addToast("No audio track to export");
      return;
    }

    setIsExporting(true);

    try {
      const format = exportFormat();
      const filename = currentTrack.name
        ? `${currentTrack.name.replace(/\.[^/.]+$/, "")}.${format}`
        : undefined;
      await audioOperations.exportAudio(currentTrack.audioBuffer, format, filename);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to export audio");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <main class="app">
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        onChange={handleFileImport}
        style={{ display: "none" }}
      />
      <Show when={isInitialized()}>
        <div class="app__canvas">
          <WaveformView onWaveformReady={setWaveformRef} />
          <SelectionToolbar
            onCut={handleCut}
            onCopy={handleCopy}
            onPaste={handlePaste}
            onDelete={handleDelete}
          />
        </div>
      </Show>

      <div class="app__footer">
        <div class="app__footer-content">
          <div class="app__footer-left">
            <FloatingButton
              icon={
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M3 7v6h6" />
                  <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
                </svg>
              }
              label="Undo"
              onClick={handleUndo}
              disabled={!canUndo()}
              variant="secondary"
            />
            <FloatingButton
              icon={
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M21 7v6h-6" />
                  <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" />
                </svg>
              }
              label="Redo"
              onClick={handleRedo}
              disabled={!canRedo()}
              variant="secondary"
            />
            <FloatingButton
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z" />
                </svg>
              }
              label="Import Audio"
              onClick={handleImportClick}
              variant="secondary"
            />
            <Show when={recorder.isRecording()}>
              <div class="recording-indicator">
                <span class="recording-indicator__dot"></span>
                <span>Recording</span>
              </div>
            </Show>
            <FloatingButton
              icon={
                recorder.isRecording() ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
                  </svg>
                )
              }
              label={recorder.isRecording() ? "Stop Recording" : "Start Recording"}
              onClick={async () => {
                if (recorder.isRecording()) {
                  recorder.stopRecording();
                } else {
                  try {
                    await recorder.startRecording();
                  } catch (err) {
                    addToast(err instanceof Error ? err.message : "Failed to start recording");
                  }
                  if (recorder.error()) {
                    addToast(recorder.error()!);
                    recorder.clearError();
                  }
                }
              }}
              classList={{
                "floating-button--recording": recorder.isRecording(),
              }}
              variant={recorder.isRecording() ? undefined : "primary"}
            />
          </div>
          <div class="app__footer-center">
            <PlaybackControls waveform={waveformRef()} />
          </div>
          <div class="app__footer-right">
            <ZoomControls />
            <div class="export-controls">
              <Dropdown
                options={[
                  { value: "wav", label: "WAV" },
                  { value: "mp3", label: "MP3" },
                  { value: "ogg", label: "OGG" },
                ]}
                value={exportFormat()}
                onChange={(value) => setExportFormat(value as "wav" | "mp3" | "ogg")}
                disabled={isExporting() || !getCurrentTrack()}
              />
              <FloatingButton
                icon={
                  isExporting() ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
                    </svg>
                  )
                }
                label={isExporting() ? "Exporting..." : "Export Audio"}
                onClick={handleExport}
                disabled={!getCurrentTrack() || isExporting()}
                variant="secondary"
              />
            </div>
            <FloatingButton
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                </svg>
              }
              label="Delete All"
              onClick={handleReset}
              variant="danger"
              disabled={store.tracks.length === 0}
            />
          </div>
        </div>
      </div>
      <ToastContainer toasts={toasts()} onDismiss={removeToast} />
      <KeyboardShortcuts isOpen={showShortcuts()} onClose={() => setShowShortcuts(false)} />
      <Show when={isLoading()}>
        <div class="loading-overlay">
          <Spinner size="large" />
        </div>
      </Show>
      <ConfirmationDialog
        isOpen={showResetDialog()}
        title="Delete All"
        message="Are you sure you want to delete everything? This will permanently delete all tracks and clear all progress."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleResetConfirm}
        onCancel={() => setShowResetDialog(false)}
      />
    </main>
  );
}
