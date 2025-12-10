import { createStore } from "solid-js/store";
import { saveState, loadState, clearState } from "../utils/persistence";
import { audioOperations } from "../utils/audioOperations";
import { cloneAudioBuffer } from "../utils/audioBufferUtils";

export interface AudioTrack {
  id: string;
  name: string;
  audioBuffer: AudioBuffer | null;
  audioUrl: string;
  duration: number;
}

export interface Selection {
  start: number;
  end: number;
}

export interface AudioState {
  tracks: AudioTrack[];
  currentTrackId: string | null;
  selection: Selection | null;
  zoom: number;
  isPlaying: boolean;
  currentTime: number;
  clipboard: AudioBuffer | null;
  undoStackLength: number;
  redoStackLength: number;
}

export interface HistoryState {
  trackId: string;
  audioBuffer: AudioBuffer;
  audioUrl: string;
  duration: number;
}

const [audioStore, setAudioStore] = createStore<AudioState>({
  tracks: [],
  currentTrackId: null,
  selection: null,
  zoom: 100,
  isPlaying: false,
  currentTime: 0,
  clipboard: null,
  undoStackLength: 0,
  redoStackLength: 0,
});

let saveTimeout: ReturnType<typeof setTimeout> | null = null;
const scheduleSave = () => {
  if (saveTimeout !== null) {
    clearTimeout(saveTimeout);
  }
  saveTimeout = setTimeout(() => {
    saveState(audioStore).catch(console.error);
  }, 500);
};

const MAX_HISTORY = 50;
let undoStack: HistoryState[] = [];
let redoStack: HistoryState[] = [];

let isInitialized = false;
export const initializeStore = async () => {
  if (isInitialized) return;
  isInitialized = true;

  window.addEventListener("beforeunload", () => {
    saveState(audioStore, undoStack, redoStack).catch(console.error);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      saveState(audioStore, undoStack, redoStack).catch(console.error);
    }
  });

  const savedState = await loadState();
  if (savedState && savedState.tracks) {
    const tracksWithUrls = await Promise.all(
      savedState.tracks.map(async (track) => {
        if (track.audioBuffer) {
          const blob = await audioOperations.audioBufferToBlob(track.audioBuffer);
          const audioUrl = URL.createObjectURL(blob);
          return {
            ...track,
            audioUrl,
          };
        }
        return track;
      })
    );

    if (savedState.undoStack) {
      undoStack.length = 0;
      undoStack.push(...savedState.undoStack);
    }
    if (savedState.redoStack) {
      redoStack.length = 0;
      redoStack.push(...savedState.redoStack);
    }

    setAudioStore({
      ...savedState,
      tracks: tracksWithUrls,
      isPlaying: false,
      undoStackLength: undoStack.length,
      redoStackLength: redoStack.length,
    });
  }
};

export const useAudioStore = () => {
  const addTrack = (track: Omit<AudioTrack, "id">) => {
    const id = crypto.randomUUID();
    setAudioStore("tracks", (tracks) => [...tracks, { ...track, id }]);
    setAudioStore("currentTrackId", id);
    scheduleSave();
    return id;
  };

  const setSelection = (selection: Selection | null) => {
    setAudioStore("selection", selection);
    scheduleSave();
  };

  const zoomIn = () => {
    setAudioStore("zoom", (z) => Math.min(1000, z * 1.5));
    scheduleSave();
  };

  const zoomOut = () => {
    setAudioStore("zoom", (z) => Math.max(10, z / 1.5));
    scheduleSave();
  };

  const resetZoom = () => {
    setAudioStore("zoom", 100);
    scheduleSave();
  };

  const setPlaying = (isPlaying: boolean) => {
    setAudioStore("isPlaying", isPlaying);
  };

  const setCurrentTime = (time: number) => {
    setAudioStore("currentTime", time);
  };

  const setClipboard = (buffer: AudioBuffer | null) => {
    setAudioStore("clipboard", buffer);
    scheduleSave();
  };

  const getCurrentTrack = (): AudioTrack | null => {
    if (!audioStore.currentTrackId) return null;
    return audioStore.tracks.find((t) => t.id === audioStore.currentTrackId) || null;
  };

  const updateAudioStore = <K extends keyof AudioState>(
    key: K,
    value: AudioState[K] | ((prev: AudioState[K]) => AudioState[K])
  ) => {
    setAudioStore(key, value);
    scheduleSave();
  };

  const resetStore = async () => {
    revokeTrackUrls(audioStore.tracks);

    await clearState();

    undoStack = [];
    redoStack = [];

    setAudioStore({
      tracks: [],
      currentTrackId: null,
      selection: null,
      zoom: 100,
      isPlaying: false,
      currentTime: 0,
      clipboard: null,
      undoStackLength: 0,
      redoStackLength: 0,
    });
  };

  const createHistoryState = async (
    trackId: string,
    audioBuffer: AudioBuffer,
    duration: number
  ): Promise<HistoryState> => {
    const clonedBuffer = cloneAudioBuffer(audioBuffer);
    const blob = await audioOperations.audioBufferToBlob(clonedBuffer);
    const audioUrl = URL.createObjectURL(blob);
    return { trackId, audioBuffer: clonedBuffer, audioUrl, duration };
  };

  const revokeTrackUrls = (tracks: AudioTrack[]): void => {
    tracks.forEach((track) => {
      if (track.audioUrl) {
        URL.revokeObjectURL(track.audioUrl);
      }
    });
  };

  const saveToHistory = async (trackId: string) => {
    const track = audioStore.tracks.find((t) => t.id === trackId);
    if (!track?.audioBuffer) {
      console.warn("saveToHistory: Track not found or no audio buffer", trackId);
      return;
    }

    const historyState = await createHistoryState(
      trackId,
      track.audioBuffer,
      track.duration
    );

    undoStack.push(historyState);
    if (undoStack.length > MAX_HISTORY) {
      const old = undoStack.shift();
      if (old?.audioUrl) {
        URL.revokeObjectURL(old.audioUrl);
      }
    }

    redoStack = [];
    setAudioStore("undoStackLength", undoStack.length);
    setAudioStore("redoStackLength", 0);
  };

  const applyHistoryState = async (
    direction: "undo" | "redo"
  ): Promise<boolean> => {
    const sourceStack = direction === "undo" ? undoStack : redoStack;
    const targetStack = direction === "undo" ? redoStack : undoStack;

    if (sourceStack.length === 0) return false;

    const currentTrack = getCurrentTrack();
    if (!currentTrack?.audioBuffer) return false;

    const currentState = await createHistoryState(
      currentTrack.id,
      currentTrack.audioBuffer,
      currentTrack.duration
    );

    targetStack.push(currentState);
    setAudioStore(direction === "undo" ? "redoStackLength" : "undoStackLength", targetStack.length);

    const stateToRestore = sourceStack.pop()!;
    setAudioStore(direction === "undo" ? "undoStackLength" : "redoStackLength", sourceStack.length);

    const trackIndex = audioStore.tracks.findIndex((t) => t.id === stateToRestore.trackId);
    if (trackIndex === -1) return false;

    if (currentTrack.audioUrl) {
      URL.revokeObjectURL(currentTrack.audioUrl);
    }

    const newBlob = await audioOperations.audioBufferToBlob(stateToRestore.audioBuffer);
    const newUrl = URL.createObjectURL(newBlob);
    const restoredBuffer = cloneAudioBuffer(stateToRestore.audioBuffer);

    setAudioStore("tracks", (tracks) => {
      const newTracks = [...tracks];
      const existingTrack = audioStore.tracks[trackIndex];
      if (existingTrack) {
        newTracks[trackIndex] = {
          ...existingTrack,
          audioBuffer: restoredBuffer,
          audioUrl: newUrl,
          duration: stateToRestore.duration,
        };
      }
      return newTracks;
    });

    scheduleSave();
    return true;
  };

  const undo = async (): Promise<boolean> => {
    return applyHistoryState("undo");
  };

  const redo = async (): Promise<boolean> => {
    return applyHistoryState("redo");
  };

  const canUndo = () => audioStore.undoStackLength > 0;
  const canRedo = () => audioStore.redoStackLength > 0;

  return {
    store: audioStore,
    setAudioStore: updateAudioStore,
    addTrack,
    setSelection,
    zoomIn,
    zoomOut,
    resetZoom,
    setPlaying,
    setCurrentTime,
    setClipboard,
    getCurrentTrack,
    resetStore,
    saveToHistory,
    undo,
    redo,
    canUndo,
    canRedo,
  };
};
