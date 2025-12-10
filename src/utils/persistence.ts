import { AudioTrack, AudioState, HistoryState } from "../stores/audioStore";
import { audioOperations } from "./audioOperations";

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

export async function saveAudioBuffer(id: string, audioBuffer: AudioBuffer): Promise<void> {
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

export async function loadAudioBuffer(id: string): Promise<AudioBuffer | null> {
  const db = await openDB();

  const transaction = db.transaction(["audioBuffers"], "readonly");
  const store = transaction.objectStore("audioBuffers");
  const result = await promisifyRequest(store.get(id));

  if (!result) {
    return null;
  }

  const audioContext = new AudioContext();
  const audioBuffer = audioContext.createBuffer(
    result.numberOfChannels,
    result.length,
    result.sampleRate
  );

  for (let i = 0; i < result.numberOfChannels; i++) {
    const channelData = audioBuffer.getChannelData(i);
    const storedData = result.channelData[i];
    channelData.set(storedData);
  }

  return audioBuffer;
}

export async function saveState(
  state: AudioState,
  undoStack: HistoryState[] = [],
  redoStack: HistoryState[] = []
): Promise<void> {
  try {
    const persistedState: PersistedState = {
      tracks: state.tracks.map((track) => ({
        id: track.id,
        name: track.name,
        audioUrl: track.audioUrl,
        duration: track.duration,
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

export async function loadState(): Promise<
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
      persistedState.tracks.map(async (track) => {
        const audioBuffer = await loadAudioBuffer(track.id);
        return {
          ...track,
          audioBuffer,
        };
      })
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

export async function clearState(): Promise<void> {
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
