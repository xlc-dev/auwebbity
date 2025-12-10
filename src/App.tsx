import { createSignal, Show, onMount, createEffect } from "solid-js";
import { WaveformView } from "./components/WaveformView";
import { SelectionToolbar } from "./components/SelectionToolbar";
import { Toolbar } from "./components/Toolbar";
import { ToastContainer } from "./components/Toast";
import { KeyboardShortcuts } from "./components/KeyboardShortcuts";
import { ConfirmationDialog } from "./components/ConfirmationDialog";
import { Spinner } from "./components/Spinner";
import { useAudioStore, initializeStore } from "./stores/audioStore";
import { useAudioRecorder } from "./hooks/useAudioRecorder";
import { useWaveform } from "./hooks/useWaveform";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useFileImport } from "./hooks/useFileImport";
import { useAudioOperations } from "./hooks/useAudioOperations";
import { audioOperations } from "./utils/audioOperations";

export default function App() {
  const { store, getCurrentTrack, resetStore, undo, redo, canUndo, canRedo } = useAudioStore();
  const recorder = useAudioRecorder();
  const [waveformRef, setWaveformRef] = createSignal<ReturnType<typeof useWaveform> | null>(null);
  const [toasts, setToasts] = createSignal<
    Array<{ id: string; message: string; type?: "error" | "success" | "info" }>
  >([]);
  const [isInitialized, setIsInitialized] = createSignal(false);
  const [showResetDialog, setShowResetDialog] = createSignal(false);
  const [showShortcuts, setShowShortcuts] = createSignal(false);
  const [isExporting, setIsExporting] = createSignal(false);
  const [exportFormat, setExportFormat] = createSignal<"wav" | "mp3" | "ogg">("wav");
  let fileInputRef: HTMLInputElement | undefined;

  const fileImport = useFileImport();
  const audioOps = useAudioOperations();

  const addToast = (message: string, type: "error" | "success" | "info" = "error") => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleFileImport = async (e: Event) => {
    try {
      await fileImport.handleFileImport(e);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to import audio");
    }
  };

  const handleImportClick = () => {
    fileInputRef?.click();
  };

  const handleCut = async () => {
    try {
      await audioOps.handleCut(waveformRef);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to cut");
    }
  };

  const handleCopy = async () => {
    try {
      await audioOps.handleCopy(waveformRef);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to copy");
    }
  };

  const handlePaste = async () => {
    try {
      await audioOps.handlePaste(waveformRef);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to paste");
    }
  };

  const handleDelete = async () => {
    try {
      await audioOps.handleDelete(waveformRef);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to delete");
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

  useKeyboardShortcuts({
    waveform: waveformRef,
    onCut: handleCut,
    onCopy: handleCopy,
    onPaste: handlePaste,
    onDelete: handleDelete,
    onUndo: handleUndo,
    onRedo: handleRedo,
  });

  onMount(async () => {
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

  const isLoading = () => fileImport.isLoading() || audioOps.isLoading();

  return (
    <main class="flex flex-col h-screen overflow-hidden bg-[var(--color-bg-secondary)] relative">
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        onChange={handleFileImport}
        style={{ display: "none" }}
      />
      <Show when={isInitialized()}>
        <div class="flex-1 relative overflow-auto bg-[var(--color-bg)] m-0 pb-[70px] sm:pb-[80px] md:pb-[90px] lg:pb-[100px] border-t border-[var(--color-border)]">
          <WaveformView onWaveformReady={setWaveformRef} />
        </div>
      </Show>
      <SelectionToolbar
        onCut={handleCut}
        onCopy={handleCopy}
        onPaste={handlePaste}
        onDelete={handleDelete}
      />
      <Toolbar
        waveform={waveformRef() ?? undefined}
        onImportClick={handleImportClick}
        onExport={handleExport}
        onReset={handleReset}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onRecordClick={async () => {
          if (recorder.isRecording()) {
            recorder.stopRecording();
          } else {
            try {
              await recorder.startRecording();
              // Only check for errors if no exception was thrown
              if (recorder.error()) {
                addToast(recorder.error()!);
                recorder.clearError();
              }
            } catch (err) {
              // If an error was thrown, check if recorder also has an error set
              // to avoid duplicate toasts
              const recorderError = recorder.error();
              if (recorderError) {
                addToast(recorderError);
                recorder.clearError();
              } else {
                addToast(err instanceof Error ? err.message : "Failed to start recording");
              }
            }
          }
        }}
        canUndo={canUndo()}
        canRedo={canRedo()}
        exportFormat={exportFormat()}
        setExportFormat={setExportFormat}
        isExporting={isExporting()}
        hasSelection={store.selection !== null}
      />
      <ToastContainer toasts={toasts()} onDismiss={removeToast} />
      <KeyboardShortcuts isOpen={showShortcuts()} onClose={() => setShowShortcuts(false)} />
      <Show when={isLoading()}>
        <div class="fixed inset-0 bg-black/50 z-[1500] flex items-center justify-center backdrop-blur-[2px]">
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
