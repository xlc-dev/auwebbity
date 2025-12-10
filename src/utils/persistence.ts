import { AudioTrack, AudioState } from "../stores/audioStore";

const STORAGE_KEY = "auwebbity-state";
const DB_NAME = "auwebbity-audio";
const DB_VERSION = 1;

interface PersistedState {
  tracks: Omit<AudioTrack, "audioBuffer">[];
  currentTrackId: string | null;
  selection: { start: number; end: number } | null;
  zoom: number;
  currentTime: number;
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

export async function saveAudioBuffer(id: string, audioBuffer: AudioBuffer): Promise<void> {
  const db = await openDB();

  const channelData: Float32Array[] = [];
  for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
    channelData.push(audioBuffer.getChannelData(i));
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["audioBuffers"], "readwrite");
    const store = transaction.objectStore("audioBuffers");
    const request = store.put({
      id,
      channelData: channelData.map((arr) => Array.from(arr)),
      sampleRate: audioBuffer.sampleRate,
      numberOfChannels: audioBuffer.numberOfChannels,
      length: audioBuffer.length,
    });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function loadAudioBuffer(id: string): Promise<AudioBuffer | null> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["audioBuffers"], "readonly");
    const store = transaction.objectStore("audioBuffers");
    const request = store.get(id);

    request.onsuccess = () => {
      const result = request.result;
      if (!result) {
        resolve(null);
        return;
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

      resolve(audioBuffer);
    };

    request.onerror = () => reject(request.error);
  });
}

export async function saveState(state: AudioState): Promise<void> {
  try {
    const persistedState: PersistedState = {
      tracks: state.tracks.map((track) => ({
        id: track.id,
        name: track.name,
        audioUrl: track.audioUrl,
        duration: track.duration,
      })),
      currentTrackId: state.currentTrackId,
      selection: state.selection,
      zoom: state.zoom,
      currentTime: state.currentTime,
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
      const channelData: Float32Array[] = [];
      for (let i = 0; i < state.clipboard.numberOfChannels; i++) {
        channelData.push(state.clipboard.getChannelData(i));
      }

      await new Promise<void>((resolve, reject) => {
        const request = store.put({
          id: "clipboard",
          channelData: channelData.map((arr) => Array.from(arr)),
          sampleRate: state.clipboard.sampleRate,
          numberOfChannels: state.clipboard.numberOfChannels,
          length: state.clipboard.length,
        });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } else {
      await new Promise<void>((resolve, reject) => {
        const deleteRequest = store.delete("clipboard");
        deleteRequest.onsuccess = () => resolve();
        deleteRequest.onerror = () => reject(deleteRequest.error);
      });
    }
  } catch (error) {
    console.error("Failed to save state:", error);
  }
}

export async function loadState(): Promise<Partial<AudioState> | null> {
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

    return {
      tracks,
      currentTrackId: persistedState.currentTrackId,
      selection: persistedState.selection,
      zoom: persistedState.zoom,
      currentTime: persistedState.currentTime,
      clipboard,
      isPlaying: false,
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
    await new Promise<void>((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Failed to clear state:", error);
  }
}
