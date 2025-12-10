import { createStore } from "solid-js/store";
import { saveState, loadState, clearState } from "../utils/persistence";
import { audioOperations } from "../utils/audioOperations";

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

interface HistoryState {
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
let lastSaveTime = 0;
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
    saveState(audioStore).catch(console.error);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      saveState(audioStore).catch(console.error);
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

    setAudioStore({
      ...savedState,
      tracks: tracksWithUrls,
      isPlaying: false,
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
    const now = Date.now();
    if (now - lastSaveTime > 2000) {
      lastSaveTime = now;
      scheduleSave();
    }
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
    audioStore.tracks.forEach((track) => {
      if (track.audioUrl) {
        URL.revokeObjectURL(track.audioUrl);
      }
    });

    await clearState();

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

    undoStack = [];
    redoStack = [];
    setAudioStore("undoStackLength", 0);
    setAudioStore("redoStackLength", 0);
  };

  const saveToHistory = async (trackId: string) => {
    const track = audioStore.tracks.find((t) => t.id === trackId);
    if (!track?.audioBuffer) {
      console.warn("saveToHistory: Track not found or no audio buffer", trackId);
      return;
    }

    const audioContext = new AudioContext();
    const clonedBuffer = audioContext.createBuffer(
      track.audioBuffer.numberOfChannels,
      track.audioBuffer.length,
      track.audioBuffer.sampleRate
    );

    for (let channel = 0; channel < track.audioBuffer.numberOfChannels; channel++) {
      const sourceData = track.audioBuffer.getChannelData(channel);
      const destData = clonedBuffer.getChannelData(channel);
      destData.set(sourceData);
    }

    const blob = await audioOperations.audioBufferToBlob(clonedBuffer);
    const audioUrl = URL.createObjectURL(blob);

    const historyState: HistoryState = {
      trackId,
      audioBuffer: clonedBuffer,
      audioUrl,
      duration: track.duration,
    };

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

  const undo = async (): Promise<boolean> => {
    if (undoStack.length === 0) return false;

    const currentTrack = getCurrentTrack();
    if (!currentTrack?.audioBuffer) return false;

    const audioContext = new AudioContext();
    const clonedBuffer = audioContext.createBuffer(
      currentTrack.audioBuffer.numberOfChannels,
      currentTrack.audioBuffer.length,
      currentTrack.audioBuffer.sampleRate
    );

    for (let channel = 0; channel < currentTrack.audioBuffer.numberOfChannels; channel++) {
      const sourceData = currentTrack.audioBuffer.getChannelData(channel);
      const destData = clonedBuffer.getChannelData(channel);
      destData.set(sourceData);
    }

    const blob = await audioOperations.audioBufferToBlob(clonedBuffer);
    const audioUrl = URL.createObjectURL(blob);

    const currentState: HistoryState = {
      trackId: currentTrack.id,
      audioBuffer: clonedBuffer,
      audioUrl,
      duration: currentTrack.duration,
    };

    redoStack.push(currentState);
    setAudioStore("redoStackLength", redoStack.length);

    const previousState = undoStack.pop()!;
    setAudioStore("undoStackLength", undoStack.length);
    const trackIndex = audioStore.tracks.findIndex((t) => t.id === previousState.trackId);
    if (trackIndex === -1) return false;

    if (currentTrack.audioUrl) {
      URL.revokeObjectURL(currentTrack.audioUrl);
    }

    const newBlob = await audioOperations.audioBufferToBlob(previousState.audioBuffer);
    const newUrl = URL.createObjectURL(newBlob);

    const audioContext2 = new AudioContext();
    const restoredBuffer = audioContext2.createBuffer(
      previousState.audioBuffer.numberOfChannels,
      previousState.audioBuffer.length,
      previousState.audioBuffer.sampleRate
    );

    for (let channel = 0; channel < previousState.audioBuffer.numberOfChannels; channel++) {
      const sourceData = previousState.audioBuffer.getChannelData(channel);
      const destData = restoredBuffer.getChannelData(channel);
      destData.set(sourceData);
    }

    setAudioStore("tracks", (tracks) => {
      const newTracks = [...tracks];
      const existingTrack = audioStore.tracks[trackIndex];
      if (existingTrack) {
        newTracks[trackIndex] = {
          ...existingTrack,
          audioBuffer: restoredBuffer,
          audioUrl: newUrl,
          duration: previousState.duration,
        };
      }
      return newTracks;
    });

    scheduleSave();
    return true;
  };

  const redo = async (): Promise<boolean> => {
    if (redoStack.length === 0) return false;

    const currentTrack = getCurrentTrack();
    if (!currentTrack?.audioBuffer) return false;

    const audioContext = new AudioContext();
    const clonedBuffer = audioContext.createBuffer(
      currentTrack.audioBuffer.numberOfChannels,
      currentTrack.audioBuffer.length,
      currentTrack.audioBuffer.sampleRate
    );

    for (let channel = 0; channel < currentTrack.audioBuffer.numberOfChannels; channel++) {
      const sourceData = currentTrack.audioBuffer.getChannelData(channel);
      const destData = clonedBuffer.getChannelData(channel);
      destData.set(sourceData);
    }

    const blob = await audioOperations.audioBufferToBlob(clonedBuffer);
    const audioUrl = URL.createObjectURL(blob);

    const currentState: HistoryState = {
      trackId: currentTrack.id,
      audioBuffer: clonedBuffer,
      audioUrl,
      duration: currentTrack.duration,
    };

    undoStack.push(currentState);
    setAudioStore("undoStackLength", undoStack.length);

    const nextState = redoStack.pop()!;
    setAudioStore("redoStackLength", redoStack.length);
    const trackIndex = audioStore.tracks.findIndex((t) => t.id === nextState.trackId);
    if (trackIndex === -1) return false;

    if (currentTrack.audioUrl) {
      URL.revokeObjectURL(currentTrack.audioUrl);
    }

    const newBlob = await audioOperations.audioBufferToBlob(nextState.audioBuffer);
    const newUrl = URL.createObjectURL(newBlob);

    const audioContext2 = new AudioContext();
    const restoredBuffer = audioContext2.createBuffer(
      nextState.audioBuffer.numberOfChannels,
      nextState.audioBuffer.length,
      nextState.audioBuffer.sampleRate
    );

    for (let channel = 0; channel < nextState.audioBuffer.numberOfChannels; channel++) {
      const sourceData = nextState.audioBuffer.getChannelData(channel);
      const destData = restoredBuffer.getChannelData(channel);
      destData.set(sourceData);
    }

    setAudioStore("tracks", (tracks) => {
      const newTracks = [...tracks];
      const existingTrack = audioStore.tracks[trackIndex];
      if (existingTrack) {
        newTracks[trackIndex] = {
          ...existingTrack,
          audioBuffer: restoredBuffer,
          audioUrl: newUrl,
          duration: nextState.duration,
        };
      }
      return newTracks;
    });

    scheduleSave();
    return true;
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
