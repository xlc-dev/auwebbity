import { createSignal, Show, onMount, onCleanup, createEffect } from "solid-js";
import { MultiTrackView } from "./components/MultiTrackView";
import { Toolbar } from "./components/Toolbar";
import { ToastContainer } from "./components/Toast";
import { KeyboardShortcuts } from "./components/KeyboardShortcuts";
import { ConfirmationDialog } from "./components/ConfirmationDialog";
import { Spinner } from "./components/Spinner";
import { MobileBlocker } from "./components/MobileBlocker";
import { useAudioStore, initializeStore } from "./stores/audioStore";
import { useAudioRecorder } from "./hooks/useAudioRecorder";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useFileImport } from "./hooks/useFileImport";
import { useAudioOperations } from "./hooks/useAudioOperations";
import { useToast } from "./hooks/useToast";
import { audioOperations } from "./utils/audioOperations";
import { getErrorMessage } from "./utils/error";
import type { useWaveform } from "./hooks/useWaveform";

export default function App() {
  const {
    store,
    resetStore,
    undo,
    redo,
    canUndo,
    canRedo,
    setRepeatRegion,
    saveProject,
    loadProject,
    splitTrack,
  } = useAudioStore();
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
  const [isDragging, setIsDragging] = createSignal(false);
  const [isMobile, setIsMobile] = createSignal(false);
  let fileInputRef: HTMLInputElement | undefined;
  let projectInputRef: HTMLInputElement | undefined;

  const checkMobile = () => {
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
      userAgent.toLowerCase()
    );
    const isSmallScreen = window.innerWidth < 768;
    return isMobileDevice || isSmallScreen;
  };

  const fileImport = useFileImport();
  const audioOps = useAudioOperations();

  const handleFileImport = async (e: Event) => {
    try {
      const files = (e.target as HTMLInputElement).files;
      if (!files || files.length === 0) return;

      if (files.length === 1) {
        await fileImport.handleFileImport(e);
      } else {
        await fileImport.handleFiles(files);
      }
    } catch (err) {
      toast.addToast(getErrorMessage(err, "Failed to import audio"));
    }
  };

  const handleImportClick = () => {
    fileInputRef?.click();
  };

  const handleSaveProject = async () => {
    try {
      await saveProject();
      toast.addToast("Project saved successfully");
    } catch (err) {
      toast.addToast(getErrorMessage(err, "Failed to save project"));
    }
  };

  const handleLoadProject = () => {
    projectInputRef?.click();
  };

  const handleProjectLoad = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    try {
      stopAllTracks();
      waveformRef()?.stop();
      waveformRef()?.clearSelection();
      waveformMap().forEach((waveform) => {
        waveform.stop();
        waveform.clearSelection();
      });

      await loadProject(file);
      toast.addToast("Project loaded successfully");
      if (projectInputRef) {
        projectInputRef.value = "";
      }
    } catch (err) {
      toast.addToast(getErrorMessage(err, "Failed to load project"));
      if (projectInputRef) {
        projectInputRef.value = "";
      }
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer?.types.includes("Files")) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const relatedTarget = e.relatedTarget as Node | null;
    if (!relatedTarget || !(e.currentTarget as Node).contains(relatedTarget)) {
      setIsDragging(false);
    }
  };

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;

    try {
      await fileImport.handleFiles(files);
    } catch (err) {
      toast.addToast(getErrorMessage(err, "Failed to import audio"));
    }
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

  const handleExport = async (format: "wav" | "mp3" | "ogg", quality: string) => {
    if (store.tracks.length === 0) {
      toast.addToast("No audio tracks to export");
      return;
    }

    const projectName = store.projectName.trim();
    if (!projectName) {
      toast.addToast("Please enter a project name");
      return;
    }

    setIsExporting(true);
    try {
      const { mixTracksWithVolume } = await import("./utils/audioBuffer");
      const sampleRate = store.tracks.find((t) => t.audioBuffer)?.audioBuffer?.sampleRate ?? 44100;
      const mixedBuffer = mixTracksWithVolume(
        store.tracks.map((t) => ({
          audioBuffer: t.audioBuffer,
          volume: t.volume,
          pan: t.pan,
          muted: t.muted,
          soloed: t.soloed,
        })),
        sampleRate
      );

      if (!mixedBuffer) {
        toast.addToast("No audio to export");
        return;
      }

      const filename = `${projectName}.${format}`;
      await audioOperations.exportAudio(mixedBuffer, format, filename, quality);
    } catch (err) {
      toast.addToast(getErrorMessage(err, "Failed to export audio"));
    } finally {
      setIsExporting(false);
    }
  };

  const handleToggleRepeat = () => {
    if (store.repeatRegion) {
      setRepeatRegion(null);
    } else if (store.selection) {
      setRepeatRegion({
        start: store.selection.start,
        end: store.selection.end,
      });
    }
  };

  const clearAllSelections = () => {
    waveformMap().forEach((waveform) => waveform.clearSelection());
  };

  const createOperationHandler = (operation: () => Promise<void>, errorMessage: string) => () =>
    handleOperation(operation, errorMessage);

  useKeyboardShortcuts({
    waveform: waveformRef,
    onCut: createOperationHandler(() => audioOps.handleCut(waveformRef), "Failed to cut"),
    onCopy: createOperationHandler(() => audioOps.handleCopy(waveformRef), "Failed to copy"),
    onPaste: createOperationHandler(() => audioOps.handlePaste(waveformRef), "Failed to paste"),
    onDelete: createOperationHandler(() => audioOps.handleDelete(waveformRef), "Failed to delete"),
    onUndo: () => undo(),
    onRedo: () => redo(),
    onPlayPause: () => {
      if (store.isPlaying) {
        pauseAllTracks();
      } else {
        playAllTracks();
      }
    },
    onToggleRepeat: handleToggleRepeat,
    onClearAllSelections: clearAllSelections,
  });

  onMount(async () => {
    const mobile = checkMobile();
    setIsMobile(mobile);

    const handleResize = () => {
      setIsMobile(checkMobile());
    };

    window.addEventListener("resize", handleResize);

    onCleanup(() => {
      window.removeEventListener("resize", handleResize);
    });

    if (!mobile) {
      await initializeStore();
      setIsInitialized(true);
    }
  });

  createEffect(() => {
    const currentTrackId = store.currentTrackId;
    if (!currentTrackId) return;

    const map = waveformMap();
    const waveform = map.get(currentTrackId);
    if (waveform) {
      setWaveformRef(waveform);
    }
  });

  const [lastCurrentTime, setLastCurrentTime] = createSignal(store.currentTime);
  createEffect(() => {
    const repeatRegion = store.repeatRegion;
    const isPlaying = store.isPlaying;
    const currentTime = store.currentTime;

    if (repeatRegion && isPlaying) {
      const { start, end } = repeatRegion;
      const prevTime = lastCurrentTime();

      const wasWithinRepeat = prevTime >= start - 0.01 && prevTime <= end + 0.01;
      const isWithinRepeat = currentTime >= start - 0.01 && currentTime <= end + 0.01;

      if (wasWithinRepeat && isWithinRepeat && currentTime >= end - 0.01 && prevTime < end - 0.01) {
        seekAllTracks(start);
      }

      setLastCurrentTime(currentTime);
    } else {
      setLastCurrentTime(currentTime);
    }
  });

  const playAllTracks = () => {
    const map = waveformMap();
    const tracks = store.tracks;
    const trackMap = new Map(tracks.map((t) => [t.id, t]));
    const hasSoloedTracks = tracks.some((t) => t.soloed);

    map.forEach((waveform, trackId) => {
      const track = trackMap.get(trackId);
      if (!track) return;

      const shouldPlay = hasSoloedTracks ? track.soloed : !track.muted;

      if (shouldPlay) {
        waveform.play();
      } else {
        waveform.pause();
      }
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
    const tracks = store.tracks;
    const trackMap = new Map(tracks.map((t) => [t.id, t]));
    map.forEach((waveform, trackId) => {
      const track = trackMap.get(trackId);
      if (track && track.duration > 0) {
        const normalizedPosition = Math.max(0, Math.min(1, time / track.duration));
        waveform.seekTo(normalizedPosition);
      }
    });
  };

  const isLoading = () => fileImport.isLoading() || audioOps.isLoading();

  return (
    <main
      class="flex flex-col h-screen overflow-hidden bg-[var(--color-bg-secondary)] relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <Show when={isMobile()}>
        <MobileBlocker />
      </Show>
      <Show when={!isMobile()}>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          multiple
          onChange={handleFileImport}
          style={{ display: "none" }}
        />
        <input
          ref={projectInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleProjectLoad}
          style={{ display: "none" }}
        />
        <Show when={isDragging()}>
          <div class="fixed inset-0 z-[2000] bg-[var(--color-primary)]/20 border-4 border-dashed border-[var(--color-primary)] flex items-center justify-center pointer-events-none">
            <div class="bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg p-6 shadow-lg">
              <div class="flex flex-col items-center gap-3">
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="text-[var(--color-primary)]"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <p class="text-[var(--color-text)] font-medium text-lg">Drop audio files here</p>
                <p class="text-[var(--color-text-secondary)] text-sm">Release to add tracks</p>
              </div>
            </div>
          </div>
        </Show>
        <Show when={isInitialized()}>
          <div class="flex-1 relative overflow-auto bg-[var(--color-bg)] m-0 border-t border-[var(--color-border)] pb-[60px] sm:pb-[75px] md:pb-[85px] lg:pb-[95px] p-2 sm:p-3 md:p-4">
            <MultiTrackView
              onWaveformReady={(waveform, trackId) => {
                setWaveformMap((map) => {
                  const newMap = new Map(map);
                  newMap.set(trackId, waveform);
                  return newMap;
                });
              }}
              onSeekAll={seekAllTracks}
              onSelectionCreated={(trackId) => {
                const map = waveformMap();
                map.forEach((waveform, id) => {
                  if (id !== trackId) {
                    waveform.clearSelection();
                  }
                });
              }}
            />
          </div>
        </Show>
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
              } catch (err) {
                const error = recorder.error() || getErrorMessage(err, "Failed to start recording");
                toast.addToast(error);
                recorder.clearError();
              }
            }
          }}
          canUndo={canUndo()}
          canRedo={canRedo()}
          isExporting={isExporting()}
          hasSelection={store.selection !== null}
          recorder={recorder}
          onNormalize={(scope) =>
            handleOperation(
              () =>
                audioOps.handleNormalize(scope, (trackId) => waveformMap().get(trackId) || null),
              "Failed to normalize"
            )
          }
          onAmplify={(gain, scope) =>
            handleOperation(
              () =>
                audioOps.handleAmplify(
                  scope,
                  (trackId) => waveformMap().get(trackId) || null,
                  gain
                ),
              "Failed to amplify"
            )
          }
          onSilence={(scope) =>
            handleOperation(
              () => audioOps.handleSilence(scope, (trackId) => waveformMap().get(trackId) || null),
              "Failed to silence"
            )
          }
          onReverse={(scope) =>
            handleOperation(
              () => audioOps.handleReverse(scope, (trackId) => waveformMap().get(trackId) || null),
              "Failed to reverse"
            )
          }
          onFadeIn={(scope) =>
            handleOperation(
              () => audioOps.handleFadeIn(scope, (trackId) => waveformMap().get(trackId) || null),
              "Failed to fade in"
            )
          }
          onFadeOut={(scope) =>
            handleOperation(
              () => audioOps.handleFadeOut(scope, (trackId) => waveformMap().get(trackId) || null),
              "Failed to fade out"
            )
          }
          onReverb={(roomSize, wetLevel, scope) =>
            handleOperation(
              () =>
                audioOps.handleReverb(
                  scope,
                  (trackId) => waveformMap().get(trackId) || null,
                  roomSize,
                  wetLevel
                ),
              "Failed to apply reverb"
            )
          }
          onDelay={(delayTime, feedback, wetLevel, scope) =>
            handleOperation(
              () =>
                audioOps.handleDelay(
                  scope,
                  (trackId) => waveformMap().get(trackId) || null,
                  delayTime,
                  feedback,
                  wetLevel
                ),
              "Failed to apply delay"
            )
          }
          onNoiseReduction={(reductionAmount, scope) =>
            handleOperation(
              () =>
                audioOps.handleNoiseReduction(
                  scope,
                  (trackId) => waveformMap().get(trackId) || null,
                  reductionAmount
                ),
              "Failed to apply noise reduction"
            )
          }
          onChangeSpeed={(speedFactor, scope) =>
            handleOperation(
              () =>
                audioOps.handleChangeSpeed(
                  scope,
                  (trackId) => waveformMap().get(trackId) || null,
                  speedFactor
                ),
              "Failed to change speed"
            )
          }
          onChangePitch={(pitchFactor, scope) =>
            handleOperation(
              () =>
                audioOps.handleChangePitch(
                  scope,
                  (trackId) => waveformMap().get(trackId) || null,
                  pitchFactor
                ),
              "Failed to change pitch"
            )
          }
          onCompressor={(threshold, ratio, attack, release, knee, scope) =>
            handleOperation(
              () =>
                audioOps.handleCompressor(
                  scope,
                  (trackId) => waveformMap().get(trackId) || null,
                  threshold,
                  ratio,
                  attack,
                  release,
                  knee
                ),
              "Failed to apply compressor"
            )
          }
          onLimiter={(threshold, release, scope) =>
            handleOperation(
              () =>
                audioOps.handleLimiter(
                  scope,
                  (trackId) => waveformMap().get(trackId) || null,
                  threshold,
                  release
                ),
              "Failed to apply limiter"
            )
          }
          onEq={(frequency, gain, q, scope) =>
            handleOperation(
              () =>
                audioOps.handleEq(
                  scope,
                  (trackId) => waveformMap().get(trackId) || null,
                  frequency,
                  gain,
                  q
                ),
              "Failed to apply EQ"
            )
          }
          onHighPassFilter={(cutoffFrequency, scope) =>
            handleOperation(
              () =>
                audioOps.handleHighPassFilter(
                  scope,
                  (trackId) => waveformMap().get(trackId) || null,
                  cutoffFrequency
                ),
              "Failed to apply high-pass filter"
            )
          }
          onLowPassFilter={(cutoffFrequency, scope) =>
            handleOperation(
              () =>
                audioOps.handleLowPassFilter(
                  scope,
                  (trackId) => waveformMap().get(trackId) || null,
                  cutoffFrequency
                ),
              "Failed to apply low-pass filter"
            )
          }
          onCut={createOperationHandler(() => audioOps.handleCut(waveformRef), "Failed to cut")}
          onCopy={createOperationHandler(() => audioOps.handleCopy(waveformRef), "Failed to copy")}
          onPaste={createOperationHandler(
            () => audioOps.handlePaste(waveformRef),
            "Failed to paste"
          )}
          onDelete={createOperationHandler(
            () => audioOps.handleDelete(waveformRef),
            "Failed to delete"
          )}
          onSplit={async () => {
            const currentTrack = store.tracks.find((t) => t.id === store.currentTrackId);
            if (!currentTrack?.audioBuffer) return;

            const splitTime = store.selection?.start ?? store.currentTime;
            if (splitTime <= 0 || splitTime >= currentTrack.duration) {
              toast.addToast("Cannot split at this position");
              return;
            }

            try {
              await splitTrack(currentTrack.id, splitTime);
              toast.addToast("Track split successfully");
            } catch (err) {
              toast.addToast(getErrorMessage(err, "Failed to split track"));
            }
          }}
          onHelpClick={() => setShowShortcuts(true)}
          onSaveProject={handleSaveProject}
          onLoadProject={handleLoadProject}
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
      </Show>
    </main>
  );
}
