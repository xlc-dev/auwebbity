import { createStore } from "solid-js/store";
import { audioOperations } from "../utils/audioOperations";
import { cloneAudioBuffer } from "../utils/audioBufferUtils";

export interface AudioTrack {
  id: string;
  name: string;
  audioBuffer: AudioBuffer | null;
  audioUrl: string;
  duration: number;
  backgroundColor: string | null;
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
  repeatRegion: { start: number; end: number } | null;
}

export interface HistoryState {
  trackId: string;
  audioBuffer: AudioBuffer;
  audioUrl: string;
  duration: number;
}

const STORAGE_KEY = "auwebbity-state";
const DB_NAME = "auwebbity-audio";
const DB_VERSION = 1;

interface PersistedHistoryState {
  trackId: string;
  audioUrl: string;
  duration: number;
  bufferId: string;
}

interface PersistedState {
  tracks: Omit<AudioTrack, "audioBuffer">[];
  currentTrackId: string | null;
  undoStack?: PersistedHistoryState[];
  redoStack?: PersistedHistoryState[];
}

async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains("audioBuffers")) {
        db.createObjectStore("audioBuffers", { keyPath: "id" });
      }
    };
  });
}

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function extractChannelData(audioBuffer: AudioBuffer): Float32Array[] {
  const channelData: Float32Array[] = [];
  for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
    channelData.push(audioBuffer.getChannelData(i));
  }
  return channelData;
}

async function saveAudioBuffer(id: string, audioBuffer: AudioBuffer): Promise<void> {
  const db = await openDB();
  const channelData = extractChannelData(audioBuffer);

  const transaction = db.transaction(["audioBuffers"], "readwrite");
  const store = transaction.objectStore("audioBuffers");
  await promisifyRequest(
    store.put({
      id,
      channelData: channelData.map((arr) => Array.from(arr)),
      sampleRate: audioBuffer.sampleRate,
      numberOfChannels: audioBuffer.numberOfChannels,
      length: audioBuffer.length,
    })
  );
}

async function loadAudioBuffer(id: string): Promise<AudioBuffer | null> {
  const db = await openDB();

  const transaction = db.transaction(["audioBuffers"], "readonly");
  const store = transaction.objectStore("audioBuffers");
  const result = await promisifyRequest(store.get(id));

  if (!result) {
    return null;
  }

  const audioContext = new AudioContext();
  const bufferLength = Math.max(1, result.length);
  const audioBuffer = audioContext.createBuffer(
    result.numberOfChannels,
    bufferLength,
    result.sampleRate
  );

  for (let i = 0; i < result.numberOfChannels; i++) {
    const channelData = audioBuffer.getChannelData(i);
    const storedData = result.channelData[i];
    channelData.set(storedData);
  }

  return audioBuffer;
}

async function saveState(
  state: AudioState,
  undoStack: HistoryState[] = [],
  redoStack: HistoryState[] = []
): Promise<void> {
  try {
    const persistedState: PersistedState = {
      tracks: state.tracks.map(({ audioBuffer, ...track }) => ({
        ...track,
        backgroundColor: track.backgroundColor || null,
      })),
      currentTrackId: state.currentTrackId,
      undoStack: await Promise.all(
        undoStack.map(async (historyState, index) => {
          const bufferId = `undo-${historyState.trackId}-${index}`;
          await saveAudioBuffer(bufferId, historyState.audioBuffer);
          return {
            trackId: historyState.trackId,
            audioUrl: historyState.audioUrl,
            duration: historyState.duration,
            bufferId,
          };
        })
      ),
      redoStack: await Promise.all(
        redoStack.map(async (historyState, index) => {
          const bufferId = `redo-${historyState.trackId}-${index}`;
          await saveAudioBuffer(bufferId, historyState.audioBuffer);
          return {
            trackId: historyState.trackId,
            audioUrl: historyState.audioUrl,
            duration: historyState.duration,
            bufferId,
          };
        })
      ),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedState));

    for (const track of state.tracks) {
      if (track.audioBuffer) {
        await saveAudioBuffer(track.id, track.audioBuffer);
      }
    }

    const db = await openDB();
    const transaction = db.transaction(["audioBuffers"], "readwrite");
    const store = transaction.objectStore("audioBuffers");

    if (state.clipboard) {
      const clipboard = state.clipboard;
      const channelData = extractChannelData(clipboard);

      await promisifyRequest(
        store.put({
          id: "clipboard",
          channelData: channelData.map((arr) => Array.from(arr)),
          sampleRate: clipboard.sampleRate,
          numberOfChannels: clipboard.numberOfChannels,
          length: clipboard.length,
        })
      );
    } else {
      await promisifyRequest(store.delete("clipboard"));
    }
  } catch (error) {
    console.error("Failed to save state:", error);
  }
}

async function loadState(): Promise<
  | (Partial<AudioState> & {
      undoStack?: HistoryState[];
      redoStack?: HistoryState[];
    })
  | null
> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const persistedState: PersistedState = JSON.parse(stored);

    const tracks: AudioTrack[] = await Promise.all(
      persistedState.tracks.map(async (track) => ({
        ...track,
        audioBuffer: await loadAudioBuffer(track.id),
        backgroundColor: track.backgroundColor || null,
      }))
    );

    let clipboard: AudioBuffer | null = null;
    try {
      clipboard = await loadAudioBuffer("clipboard");
    } catch {}

    const restoreHistoryStack = async (
      persistedStack: PersistedHistoryState[]
    ): Promise<HistoryState[]> => {
      return Promise.all(
        persistedStack.map(async (persisted) => {
          const audioBuffer = await loadAudioBuffer(persisted.bufferId);
          if (!audioBuffer) {
            throw new Error(`Failed to load history buffer ${persisted.bufferId}`);
          }
          const blob = await audioOperations.audioBufferToBlob(audioBuffer);
          const audioUrl = URL.createObjectURL(blob);
          return {
            trackId: persisted.trackId,
            audioBuffer,
            audioUrl,
            duration: persisted.duration,
          };
        })
      );
    };

    const undoStack: HistoryState[] = persistedState.undoStack
      ? await restoreHistoryStack(persistedState.undoStack)
      : [];

    const redoStack: HistoryState[] = persistedState.redoStack
      ? await restoreHistoryStack(persistedState.redoStack)
      : [];

    return {
      tracks,
      currentTrackId: persistedState.currentTrackId,
      clipboard,
      isPlaying: false,
      undoStack,
      redoStack,
    };
  } catch (error) {
    console.error("Failed to load state:", error);
    return null;
  }
}

async function clearState(): Promise<void> {
  try {
    localStorage.removeItem(STORAGE_KEY);
    const db = await openDB();
    const transaction = db.transaction(["audioBuffers"], "readwrite");
    const store = transaction.objectStore("audioBuffers");
    await promisifyRequest(store.clear());
  } catch (error) {
    console.error("Failed to clear state:", error);
  }
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
  repeatRegion: null,
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
      tracks: tracksWithUrls,
      currentTrackId: savedState.currentTrackId || null,
      selection: null,
      zoom: 100,
      isPlaying: false,
      currentTime: 0,
      clipboard: savedState.clipboard || null,
      undoStackLength: undoStack.length,
      redoStackLength: redoStack.length,
      repeatRegion: null,
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
  };

  const zoomIn = () => {
    setAudioStore("zoom", (z) => Math.min(1000, z * 1.5));
  };

  const zoomOut = () => {
    setAudioStore("zoom", (z) => Math.max(10, z / 1.5));
  };

  const resetZoom = () => {
    setAudioStore("zoom", 100);
  };

  const setPlaying = (isPlaying: boolean) => {
    setAudioStore("isPlaying", isPlaying);
  };

  const setCurrentTime = (time: number) => {
    setAudioStore("currentTime", time);
  };

  const setRepeatRegion = (region: { start: number; end: number } | null) => {
    setAudioStore("repeatRegion", region);
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
      repeatRegion: null,
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

    const historyState = await createHistoryState(trackId, track.audioBuffer, track.duration);

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

  const applyHistoryState = async (direction: "undo" | "redo"): Promise<boolean> => {
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

  const setCurrentTrackId = (trackId: string | null) => {
    setAudioStore("currentTrackId", trackId);
    setAudioStore("selection", null);
    scheduleSave();
  };

  const deleteTrack = (trackId: string) => {
    const track = audioStore.tracks.find((t) => t.id === trackId);
    if (!track) return;

    if (track.audioUrl) {
      URL.revokeObjectURL(track.audioUrl);
    }

    setAudioStore("tracks", (tracks) => tracks.filter((t) => t.id !== trackId));

    if (audioStore.currentTrackId === trackId) {
      const remainingTracks = audioStore.tracks.filter((t) => t.id !== trackId);
      setAudioStore("currentTrackId", remainingTracks[0]?.id ?? null);
    }

    setAudioStore("selection", null);
    scheduleSave();
  };

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
    setRepeatRegion,
    setClipboard,
    getCurrentTrack,
    resetStore,
    saveToHistory,
    undo,
    redo,
    canUndo,
    canRedo,
    setCurrentTrackId,
    deleteTrack,
  };
};
