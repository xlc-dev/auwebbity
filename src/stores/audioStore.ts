import { createStore } from "solid-js/store";
import { audioOperations } from "../utils/audioOperations";
import { cloneAudioBuffer } from "../utils/audioBuffer";
import { exportProject, importProject, downloadProject } from "../utils/project";
import { getAudioContext } from "../utils/audioContext";
import { cloneTrackWithBuffer, createTrackFromBufferWithUrl } from "../utils/trackHelpers";

export interface AudioTrack {
  id: string;
  name: string;
  audioBuffer: AudioBuffer | null;
  audioUrl: string;
  duration: number;
  backgroundColor: string | null;
  volume: number;
  pan: number;
  muted: boolean;
  soloed: boolean;
  waveformRenderer: WaveformRenderer;
}

export interface Selection {
  start: number;
  end: number;
}

export type WaveformRenderer = "bars" | "line" | "spectrogram";

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
  markers: number[];
  projectName: string;
}

interface ProjectSnapshot {
  tracks: Array<{
    id: string;
    name: string;
    audioBuffer: AudioBuffer | null;
    audioUrl: string;
    duration: number;
    backgroundColor: string | null;
    volume: number;
    pan: number;
    muted: boolean;
    soloed: boolean;
    waveformRenderer: WaveformRenderer;
  }>;
  currentTrackId: string | null;
}

const STORAGE_KEY = "auwebbity-state";
const DB_NAME = "auwebbity-audio";
const DB_VERSION = 1;

interface PersistedSnapshot {
  tracks: Array<{
    id: string;
    name: string;
    audioUrl: string;
    duration: number;
    backgroundColor: string | null;
    volume: number;
    pan: number;
    muted: boolean;
    soloed: boolean;
    waveformRenderer: WaveformRenderer;
    bufferId: string | null;
  }>;
  currentTrackId: string | null;
}

interface PersistedState {
  tracks: Omit<AudioTrack, "audioBuffer">[];
  currentTrackId: string | null;
  undoStack?: PersistedSnapshot[];
  redoStack?: PersistedSnapshot[];
  projectName?: string;
  markers?: number[];
}

let dbCache: IDBDatabase | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;

async function openDB(): Promise<IDBDatabase> {
  if (dbCache) return dbCache;
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
    request.onsuccess = () => {
      dbCache = request.result;
      dbPromise = null;
      dbCache.onclose = () => {
        dbCache = null;
      };
      dbCache.onerror = () => {
        dbCache = null;
      };
      resolve(dbCache);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains("audioBuffers")) {
        db.createObjectStore("audioBuffers", { keyPath: "id" });
      }
    };
  });

  return dbPromise;
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

  const audioContext = getAudioContext();
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
  undoStack: ProjectSnapshot[] = [],
  redoStack: ProjectSnapshot[] = []
): Promise<void> {
  try {
    const persistSnapshot = async (
      snapshot: ProjectSnapshot,
      prefix: string
    ): Promise<PersistedSnapshot> => {
      return {
        tracks: await Promise.all(
          snapshot.tracks.map(async (track) => {
            let bufferId: string | null = null;
            if (track.audioBuffer) {
              bufferId = `${prefix}-${track.id}-${Date.now()}-${Math.random()}`;
              await saveAudioBuffer(bufferId, track.audioBuffer);
            }
            return {
              id: track.id,
              name: track.name,
              audioUrl: track.audioUrl,
              duration: track.duration,
              backgroundColor: track.backgroundColor,
              volume: track.volume,
              pan: track.pan,
              muted: track.muted,
              soloed: track.soloed,
              waveformRenderer: track.waveformRenderer,
              bufferId,
            };
          })
        ),
        currentTrackId: snapshot.currentTrackId,
      };
    };

    const persistedState: PersistedState = {
      tracks: state.tracks.map(({ audioBuffer, ...track }) => ({
        ...track,
        backgroundColor: track.backgroundColor || null,
      })),
      currentTrackId: state.currentTrackId,
      projectName: state.projectName,
      markers: state.markers,
      undoStack: await Promise.all(
        undoStack.map((snapshot, index) => persistSnapshot(snapshot, `undo-${index}`))
      ),
      redoStack: await Promise.all(
        redoStack.map((snapshot, index) => persistSnapshot(snapshot, `redo-${index}`))
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
      undoStack?: ProjectSnapshot[];
      redoStack?: ProjectSnapshot[];
    })
  | null
> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const persistedState: PersistedState = JSON.parse(stored);

    const currentTrackId = persistedState.currentTrackId;
    const loadTrackBuffer = async (trackId: string) => {
      try {
        const buffer = await loadAudioBuffer(trackId);
        if (buffer) {
          const blob = await audioOperations.audioBufferToBlob(buffer);
          const audioUrl = URL.createObjectURL(blob);
          setAudioStore("tracks", (tracks) => {
            const newTracks = [...tracks];
            const trackIndex = newTracks.findIndex((t) => t.id === trackId);
            if (trackIndex !== -1 && newTracks[trackIndex]) {
              newTracks[trackIndex] = {
                ...newTracks[trackIndex]!,
                audioBuffer: buffer,
                audioUrl,
              };
            }
            return newTracks;
          });
        }
      } catch (error) {
        console.error(`Failed to load audio buffer for track ${trackId}:`, error);
      }
    };

    const tracks: AudioTrack[] = persistedState.tracks.map((track) => ({
      ...track,
      audioBuffer: null,
      audioUrl: "",
      backgroundColor: track.backgroundColor || null,
      volume: track.volume ?? 1,
      pan: track.pan ?? 0,
      muted: track.muted ?? false,
      soloed: track.soloed ?? false,
      waveformRenderer: track.waveformRenderer || "bars",
    }));

    const loadCurrentTrack = async () => {
      if (!currentTrackId) return;
      const trackIndex = tracks.findIndex((t) => t.id === currentTrackId);
      if (trackIndex === -1) return;

      try {
        const audioBuffer = await loadAudioBuffer(currentTrackId);
        if (audioBuffer) {
          const blob = await audioOperations.audioBufferToBlob(audioBuffer);
          const audioUrl = URL.createObjectURL(blob);
          setAudioStore("tracks", (tracks) =>
            tracks.map((t) =>
              t.id === currentTrackId
                ? {
                    ...t,
                    audioBuffer,
                    audioUrl,
                  }
                : t
            )
          );
        }
      } catch (error) {
        console.error(`Failed to load current track buffer:`, error);
      }
    };

    loadCurrentTrack().catch(() => {});

    persistedState.tracks.forEach((track, index) => {
      if (track.id === currentTrackId) return;

      if (typeof requestIdleCallback !== "undefined") {
        requestIdleCallback(
          () => {
            loadTrackBuffer(track.id).catch(() => {});
          },
          { timeout: index < 5 ? 1000 : 3000 }
        );
      } else {
        setTimeout(
          () => {
            loadTrackBuffer(track.id).catch(() => {});
          },
          index < 5 ? 100 : 500
        );
      }
    });

    if (typeof requestIdleCallback !== "undefined") {
      requestIdleCallback(
        () => {
          loadAudioBuffer("clipboard")
            .then((buffer) => {
              if (buffer) {
                setAudioStore("clipboard", buffer);
              }
            })
            .catch(() => {});
        },
        { timeout: 3000 }
      );
    } else {
      setTimeout(() => {
        loadAudioBuffer("clipboard")
          .then((buffer) => {
            if (buffer) {
              setAudioStore("clipboard", buffer);
            }
          })
          .catch(() => {});
      }, 300);
    }

    const restoreSnapshot = async (persisted: PersistedSnapshot): Promise<ProjectSnapshot> => {
      const restoredTracks = await Promise.all(
        persisted.tracks.map(async (track) => {
          let audioBuffer: AudioBuffer | null = null;
          let audioUrl = track.audioUrl;
          if (track.bufferId) {
            audioBuffer = await loadAudioBuffer(track.bufferId);
            if (audioBuffer) {
              const blob = await audioOperations.audioBufferToBlob(audioBuffer);
              audioUrl = URL.createObjectURL(blob);
            }
          }
          return {
            id: track.id,
            name: track.name,
            audioBuffer,
            audioUrl,
            duration: track.duration,
            backgroundColor: track.backgroundColor,
            volume: track.volume,
            pan: track.pan ?? 0,
            muted: track.muted,
            soloed: track.soloed,
            waveformRenderer: track.waveformRenderer || "bars",
          };
        })
      );
      return {
        tracks: restoredTracks,
        currentTrackId: persisted.currentTrackId,
      };
    };

    const undoStack: ProjectSnapshot[] = [];
    const redoStack: ProjectSnapshot[] = [];

    if (persistedState.undoStack && persistedState.undoStack.length > 0) {
      if (typeof requestIdleCallback !== "undefined") {
        requestIdleCallback(
          () => {
            Promise.all(persistedState.undoStack!.map(restoreSnapshot))
              .then((stack) => {
                undoStack.length = 0;
                undoStack.push(...stack);
                setAudioStore("undoStackLength", undoStack.length);
              })
              .catch(() => {});
          },
          { timeout: 5000 }
        );
      } else {
        setTimeout(() => {
          Promise.all(persistedState.undoStack!.map(restoreSnapshot))
            .then((stack) => {
              undoStack.length = 0;
              undoStack.push(...stack);
              setAudioStore("undoStackLength", undoStack.length);
            })
            .catch(console.error);
        }, 500);
      }
    }

    if (persistedState.redoStack && persistedState.redoStack.length > 0) {
      if (typeof requestIdleCallback !== "undefined") {
        requestIdleCallback(
          () => {
            Promise.all(persistedState.redoStack!.map(restoreSnapshot))
              .then((stack) => {
                redoStack.length = 0;
                redoStack.push(...stack);
                setAudioStore("redoStackLength", redoStack.length);
              })
              .catch(() => {});
          },
          { timeout: 5000 }
        );
      } else {
        setTimeout(() => {
          Promise.all(persistedState.redoStack!.map(restoreSnapshot))
            .then((stack) => {
              redoStack.length = 0;
              redoStack.push(...stack);
              setAudioStore("redoStackLength", redoStack.length);
            })
            .catch(console.error);
        }, 500);
      }
    }

    return {
      tracks,
      currentTrackId: persistedState.currentTrackId,
      clipboard: null,
      isPlaying: false,
      undoStack,
      redoStack,
      markers: persistedState.markers || [],
      projectName: persistedState.projectName || "",
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
  markers: [],
  projectName: "",
});

const SAVE_DEBOUNCE_MS = 1000;

let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let saveScheduled = false;

const scheduleSave = () => {
  if (saveScheduled) return;
  saveScheduled = true;
  if (saveTimeout !== null) {
    clearTimeout(saveTimeout);
  }
  saveTimeout = setTimeout(() => {
    saveScheduled = false;
    saveState(audioStore).catch(() => {});
  }, SAVE_DEBOUNCE_MS);
};

const MAX_HISTORY = 50;
let undoStack: ProjectSnapshot[] = [];
let redoStack: ProjectSnapshot[] = [];

let isInitialized = false;
export const initializeStore = async () => {
  if (isInitialized) return;
  isInitialized = true;

  window.addEventListener("beforeunload", () => {
    saveState(audioStore, undoStack, redoStack).catch(() => {});
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      saveState(audioStore, undoStack, redoStack).catch(() => {});
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
      markers: [],
      projectName: savedState.projectName || "",
    });
  }
};

export const useAudioStore = () => {
  const addTrack = async (track: Omit<AudioTrack, "id">) => {
    await saveToHistory();
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

  const addMarker = (time: number) => {
    setAudioStore("markers", (markers) => {
      const existingMarker = markers.find((m) => Math.abs(m - time) < 0.01);
      if (existingMarker !== undefined) return markers;
      const newMarkers = [...markers, time].sort((a, b) => a - b);
      return newMarkers;
    });
    scheduleSave();
  };

  const removeMarker = (time: number) => {
    setAudioStore("markers", (markers) => {
      return markers.filter((m) => Math.abs(m - time) >= 0.01);
    });
    scheduleSave();
  };

  const clearMarkers = () => {
    setAudioStore("markers", []);
    scheduleSave();
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
      markers: [],
      projectName: "",
    });
  };

  const revokeTrackUrls = (tracks: AudioTrack[]): void => {
    tracks.forEach((track) => {
      if (track.audioUrl) {
        URL.revokeObjectURL(track.audioUrl);
      }
    });
  };

  const createSnapshot = async (): Promise<ProjectSnapshot> => {
    const tracks = await Promise.all(
      audioStore.tracks.map(async (track) => {
        let audioBuffer: AudioBuffer | null = null;
        let audioUrl = track.audioUrl;
        if (track.audioBuffer) {
          audioBuffer = cloneAudioBuffer(track.audioBuffer);
          const blob = await audioOperations.audioBufferToBlob(audioBuffer);
          audioUrl = URL.createObjectURL(blob);
        }
        return {
          id: track.id,
          name: track.name,
          audioBuffer,
          audioUrl,
          duration: track.duration,
          backgroundColor: track.backgroundColor,
          volume: track.volume,
          pan: track.pan,
          muted: track.muted,
          soloed: track.soloed,
          waveformRenderer: track.waveformRenderer,
        };
      })
    );
    return {
      tracks,
      currentTrackId: audioStore.currentTrackId,
    };
  };

  const saveToHistory = async () => {
    const snapshot = await createSnapshot();
    undoStack.push(snapshot);
    if (undoStack.length > MAX_HISTORY) {
      const old = undoStack.shift();
      if (old) {
        revokeTrackUrls(old.tracks);
      }
    }
    redoStack.forEach((snapshot) => revokeTrackUrls(snapshot.tracks));
    redoStack = [];
    setAudioStore("undoStackLength", undoStack.length);
    setAudioStore("redoStackLength", 0);
  };

  const restoreSnapshot = async (snapshot: ProjectSnapshot) => {
    revokeTrackUrls(audioStore.tracks);
    const restoredTracks = await Promise.all(
      snapshot.tracks.map(async (track) => {
        let audioUrl = track.audioUrl;
        if (track.audioBuffer) {
          const blob = await audioOperations.audioBufferToBlob(track.audioBuffer);
          audioUrl = URL.createObjectURL(blob);
        }
        return {
          ...track,
          audioBuffer: track.audioBuffer ? cloneAudioBuffer(track.audioBuffer) : null,
          audioUrl,
        };
      })
    );
    setAudioStore({
      tracks: restoredTracks,
      currentTrackId: snapshot.currentTrackId,
      selection: null,
    });
    scheduleSave();
  };

  const undo = async (): Promise<boolean> => {
    if (undoStack.length === 0) return false;
    const currentSnapshot = await createSnapshot();
    redoStack.push(currentSnapshot);
    setAudioStore("redoStackLength", redoStack.length);
    const snapshotToRestore = undoStack.pop()!;
    setAudioStore("undoStackLength", undoStack.length);
    await restoreSnapshot(snapshotToRestore);
    return true;
  };

  const redo = async (): Promise<boolean> => {
    if (redoStack.length === 0) return false;
    const currentSnapshot = await createSnapshot();
    undoStack.push(currentSnapshot);
    setAudioStore("undoStackLength", undoStack.length);
    const snapshotToRestore = redoStack.pop()!;
    setAudioStore("redoStackLength", redoStack.length);
    await restoreSnapshot(snapshotToRestore);
    return true;
  };

  const canUndo = () => audioStore.undoStackLength > 0;
  const canRedo = () => audioStore.redoStackLength > 0;

  const setCurrentTrackId = (trackId: string | null) => {
    setAudioStore("currentTrackId", trackId);
    setAudioStore("selection", null);
    scheduleSave();
  };

  const deleteTrack = async (trackId: string) => {
    const track = audioStore.tracks.find((t) => t.id === trackId);
    if (!track) return;

    await saveToHistory();

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

  const reorderTracks = async (fromIndex: number, toIndex: number) => {
    await saveToHistory();
    setAudioStore("tracks", (tracks) => {
      const newTracks = [...tracks];
      const [movedTrack] = newTracks.splice(fromIndex, 1);
      if (movedTrack) {
        newTracks.splice(toIndex, 0, movedTrack);
      }
      return newTracks;
    });
    scheduleSave();
  };

  const duplicateTrack = async (trackId: string) => {
    const track = audioStore.tracks.find((t) => t.id === trackId);
    if (!track || !track.audioBuffer) return;

    await saveToHistory();

    const { track: newTrackData, audioUrl } = await cloneTrackWithBuffer(
      track,
      `${track.name} Copy`
    );

    const newId = crypto.randomUUID();
    const newTrack: AudioTrack = {
      ...newTrackData,
      id: newId,
      audioUrl,
    };

    const trackIndex = audioStore.tracks.findIndex((t) => t.id === trackId);
    setAudioStore("tracks", (tracks) => {
      const newTracks = [...tracks];
      newTracks.splice(trackIndex + 1, 0, newTrack);
      return newTracks;
    });
    setAudioStore("currentTrackId", newId);
    scheduleSave();
  };

  const splitTrack = async (trackId: string, splitTime: number) => {
    const track = audioStore.tracks.find((t) => t.id === trackId);
    if (!track || !track.audioBuffer) return;

    if (splitTime <= 0 || splitTime >= track.duration) return;

    await saveToHistory();

    const { left, right } = await audioOperations.split(track.audioBuffer, splitTime);

    const { track: leftTrackData, audioUrl: leftUrl } = await createTrackFromBufferWithUrl(
      left,
      `${track.name} (1)`,
      track
    );
    const { track: rightTrackData, audioUrl: rightUrl } = await createTrackFromBufferWithUrl(
      right,
      `${track.name} (2)`,
      track
    );

    const leftId = crypto.randomUUID();
    const rightId = crypto.randomUUID();

    const leftTrack: AudioTrack = {
      ...leftTrackData,
      id: leftId,
      audioUrl: leftUrl,
    };

    const rightTrack: AudioTrack = {
      ...rightTrackData,
      id: rightId,
      audioUrl: rightUrl,
    };

    const trackIndex = audioStore.tracks.findIndex((t) => t.id === trackId);
    if (track.audioUrl) {
      URL.revokeObjectURL(track.audioUrl);
    }

    setAudioStore("tracks", (tracks) => {
      const newTracks = [...tracks];
      newTracks.splice(trackIndex, 1, leftTrack, rightTrack);
      return newTracks;
    });

    if (audioStore.currentTrackId === trackId) {
      setAudioStore("currentTrackId", leftId);
    }

    setAudioStore("selection", null);
    scheduleSave();
  };

  const saveProject = async (): Promise<void> => {
    const projectName = audioStore.projectName.trim();
    if (!projectName) {
      throw new Error("Please enter a project name before saving");
    }
    const blob = await exportProject(audioStore);
    downloadProject(blob, projectName);
  };

  const loadProject = async (file: File): Promise<void> => {
    revokeTrackUrls(audioStore.tracks);
    const loadedState = await importProject(file);

    setAudioStore({
      tracks: loadedState.tracks,
      currentTrackId: loadedState.currentTrackId,
      selection: null,
      zoom: loadedState.zoom,
      isPlaying: false,
      currentTime: 0,
      clipboard: null,
      undoStackLength: 0,
      redoStackLength: 0,
      repeatRegion: loadedState.repeatRegion,
      markers: loadedState.markers || [],
      projectName: loadedState.projectName,
    });

    undoStack.forEach((snapshot) => revokeTrackUrls(snapshot.tracks));
    redoStack.forEach((snapshot) => revokeTrackUrls(snapshot.tracks));
    undoStack = [];
    redoStack = [];

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
    addMarker,
    removeMarker,
    clearMarkers,
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
    reorderTracks,
    duplicateTrack,
    splitTrack,
    saveProject,
    loadProject,
  };
};
