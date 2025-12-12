import { createSignal, Show, onMount, createEffect } from "solid-js";
import { MultiTrackView } from "./components/MultiTrackView";
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
import { useToast } from "./hooks/useToast";
import { audioOperations } from "./utils/audioOperations";
import { formatDateForFilename } from "./utils/dateUtils";
import { getErrorMessage } from "./utils/errorUtils";

export default function App() {
  const { store, getCurrentTrack, resetStore, undo, redo, canUndo, canRedo, setRepeatRegion } =
    useAudioStore();
  const recorder = useAudioRecorder();
  const [waveformRef, setWaveformRef] = createSignal<ReturnType<typeof useWaveform> | null>(null);
  const [waveformMap, setWaveformMap] = createSignal<Map<string, ReturnType<typeof useWaveform>>>(
    new Map()
  );
  const toast = useToast();
  const [isInitialized, setIsInitialized] = createSignal(false);
  const [showResetDialog, setShowResetDialog] = createSignal(false);
  const [showShortcuts, setShowShortcuts] = createSignal(false);
  const [isExporting, setIsExporting] = createSignal(false);
  const [exportFormat, setExportFormat] = createSignal<"wav" | "mp3" | "ogg">("wav");
  let fileInputRef: HTMLInputElement | undefined;

  const fileImport = useFileImport();
  const audioOps = useAudioOperations();

  const handleFileImport = async (e: Event) => {
    try {
      await fileImport.handleFileImport(e);
    } catch (err) {
      toast.addToast(getErrorMessage(err, "Failed to import audio"));
    }
  };

  const handleImportClick = () => {
    fileInputRef?.click();
  };

  const handleOperation = async (operation: () => Promise<void>, errorMessage: string) => {
    try {
      await operation();
    } catch (err) {
      toast.addToast(getErrorMessage(err, errorMessage));
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
      toast.addToast("No audio track to export");
      return;
    }

    setIsExporting(true);
    try {
      const format = exportFormat();
      const filename = `recording_${formatDateForFilename()}.${format}`;
      await audioOperations.exportAudio(currentTrack.audioBuffer, format, filename);
    } catch (err) {
      toast.addToast(getErrorMessage(err, "Failed to export audio"));
    } finally {
      setIsExporting(false);
    }
  };

  const handleSetRepeatStart = (time: number) => {
    setRepeatRegion({ start: time, end: time });
  };

  const handleSetRepeatEnd = (time: number) => {
    if (store.repeatRegion) {
      const start = store.repeatRegion.start;
      setRepeatRegion({ start, end: Math.max(start, time) });
    }
  };

  const handleClearRepeat = () => {
    setRepeatRegion(null);
  };

  useKeyboardShortcuts({
    waveform: waveformRef,
    onCut: () => handleOperation(() => audioOps.handleCut(waveformRef), "Failed to cut"),
    onCopy: () => handleOperation(() => audioOps.handleCopy(waveformRef), "Failed to copy"),
    onPaste: () => handleOperation(() => audioOps.handlePaste(waveformRef), "Failed to paste"),
    onDelete: () => handleOperation(() => audioOps.handleDelete(waveformRef), "Failed to delete"),
    onUndo: () => undo(),
    onRedo: () => redo(),
    onPlayPause: () => {
      if (store.isPlaying) {
        pauseAllTracks();
      } else {
        playAllTracks();
      }
    },
    onClearRepeat: handleClearRepeat,
  });

  onMount(async () => {
    await initializeStore();
    setIsInitialized(true);
  });

  createEffect(() => {
    const currentTrackId = store.currentTrackId;
    const map = waveformMap();
    if (currentTrackId) {
      const waveform = map.get(currentTrackId);
      if (waveform) {
        setWaveformRef(waveform);
      }
    }
  });

  const [lastCurrentTime, setLastCurrentTime] = createSignal(store.currentTime);
  createEffect(() => {
    if (store.repeatRegion && store.isPlaying) {
      const { start, end } = store.repeatRegion;
      const currentTime = store.currentTime;
      const prevTime = lastCurrentTime();

      const wasWithinRepeat = prevTime >= start - 0.01 && prevTime <= end + 0.01;
      const isWithinRepeat = currentTime >= start - 0.01 && currentTime <= end + 0.01;

      if (wasWithinRepeat && isWithinRepeat && currentTime >= end - 0.01 && prevTime < end - 0.01) {
        seekAllTracks(start);
      }

      setLastCurrentTime(currentTime);
    } else {
      setLastCurrentTime(store.currentTime);
    }
  });

  const playAllTracks = () => {
    const map = waveformMap();
    map.forEach((waveform) => {
      waveform.play();
    });
  };

  const pauseAllTracks = () => {
    const map = waveformMap();
    map.forEach((waveform) => {
      waveform.pause();
    });
  };

  const stopAllTracks = () => {
    const map = waveformMap();
    map.forEach((waveform) => {
      waveform.stop();
    });
  };

  const seekAllTracks = (time: number) => {
    const map = waveformMap();
    map.forEach((waveform, trackId) => {
      const track = store.tracks.find((t) => t.id === trackId);
      if (track && track.duration > 0) {
        const normalizedPosition = Math.max(0, Math.min(1, time / track.duration));
        waveform.seekTo(normalizedPosition);
      }
    });
  };

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
        <div class="flex-1 relative overflow-auto bg-[var(--color-bg)] m-0 border-t border-[var(--color-border)] pb-[70px] sm:pb-[80px] md:pb-[90px] lg:pb-[100px] p-2 sm:p-3 md:p-4">
          <MultiTrackView
            onWaveformReady={(waveform, trackId) => {
              setWaveformMap((map) => {
                const newMap = new Map(map);
                newMap.set(trackId, waveform);
                return newMap;
              });
            }}
            onSeekAll={seekAllTracks}
            onSetRepeatStart={handleSetRepeatStart}
            onSetRepeatEnd={handleSetRepeatEnd}
            onClearRepeat={handleClearRepeat}
          />
        </div>
      </Show>
      <SelectionToolbar
        onCut={() => handleOperation(() => audioOps.handleCut(waveformRef), "Failed to cut")}
        onCopy={() => handleOperation(() => audioOps.handleCopy(waveformRef), "Failed to copy")}
        onPaste={() => handleOperation(() => audioOps.handlePaste(waveformRef), "Failed to paste")}
        onDelete={() =>
          handleOperation(() => audioOps.handleDelete(waveformRef), "Failed to delete")
        }
      />
      <Toolbar
        waveform={waveformRef() ?? undefined}
        onPlayAll={playAllTracks}
        onPauseAll={pauseAllTracks}
        onStopAll={stopAllTracks}
        onSeekAll={seekAllTracks}
        onImportClick={handleImportClick}
        onExport={handleExport}
        onReset={handleReset}
        onUndo={() => undo()}
        onRedo={() => redo()}
        onRecordClick={async () => {
          if (recorder.isRecording()) {
            recorder.stopRecording();
          } else {
            try {
              await recorder.startRecording();
              if (recorder.error()) {
                toast.addToast(recorder.error()!);
                recorder.clearError();
              }
            } catch (err) {
              const recorderError = recorder.error();
              if (recorderError) {
                toast.addToast(recorderError);
                recorder.clearError();
              } else {
                toast.addToast(getErrorMessage(err, "Failed to start recording"));
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
        recorder={recorder}
      />
      <ToastContainer toasts={toast.toasts()} onDismiss={toast.removeToast} />
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
