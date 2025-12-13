import { Component, Show, createSignal, For } from "solid-js";
import { useAudioStore } from "../stores/audioStore";
import { Tooltip } from "./Tooltip";
import { formatTime } from "../utils/timeUtils";

interface TrackListProps {
  onAddTrack?: () => void;
}

export const TrackList: Component<TrackListProps> = (props) => {
  const { store, setCurrentTrackId, deleteTrack, duplicateTrack, setAudioStore } = useAudioStore();
  const [editingTrackId, setEditingTrackId] = createSignal<string | null>(null);
  const [editName, setEditName] = createSignal("");

  const handleTrackClick = (trackId: string) => {
    setCurrentTrackId(trackId);
  };

  const handleDeleteTrack = async (trackId: string, e: Event) => {
    e.stopPropagation();
    if (store.tracks.length <= 1) {
      return;
    }
    await deleteTrack(trackId);
  };

  const handleDuplicateTrack = async (trackId: string, e: Event) => {
    e.stopPropagation();
    const track = store.tracks.find((t) => t.id === trackId);
    if (track?.audioBuffer) {
      await duplicateTrack(trackId);
    }
  };

  const handleRenameStart = (trackId: string, e?: Event) => {
    if (e) {
      e.stopPropagation();
    }
    const track = store.tracks.find((t) => t.id === trackId);
    if (track) {
      setEditingTrackId(trackId);
      setEditName(track.name);
    }
  };

  const handleRenameSubmit = (trackId: string) => {
    const track = store.tracks.find((t) => t.id === trackId);
    if (track && editName().trim()) {
      setAudioStore("tracks", (tracks) =>
        tracks.map((t) => (t.id === trackId ? { ...t, name: editName().trim() } : t))
      );
    }
    setEditingTrackId(null);
    setEditName("");
  };

  const handleRenameCancel = () => {
    setEditingTrackId(null);
    setEditName("");
  };

  return (
    <div class="w-full sm:w-64 border-r border-[var(--color-border)] bg-[var(--color-bg-elevated)] flex flex-col h-full">
      <div class="p-3 border-b border-[var(--color-border)] flex items-center justify-between">
        <h2 class="text-sm font-semibold text-[var(--color-text)]">Tracks</h2>
        <Tooltip label="Add Track">
          <button
            onClick={props.onAddTrack}
            class="flex items-center justify-center w-6 h-6 rounded hover:bg-[var(--color-hover)] text-[var(--color-text)] transition-colors"
            aria-label="Add Track"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </Tooltip>
      </div>
      <div class="flex-1 overflow-y-auto">
        <Show
          when={store.tracks.length > 0}
          fallback={
            <div class="p-4 text-center text-sm text-[var(--color-text-secondary)]">
              <p>No tracks yet</p>
              <p class="text-xs mt-1">Import or record to add tracks</p>
            </div>
          }
        >
          <For each={store.tracks}>
            {(track) => {
              const isCurrent = () => track.id === store.currentTrackId;
              const isEditing = () => editingTrackId() === track.id;

              return (
                <div
                  class="p-2 border-b border-[var(--color-border)] cursor-pointer transition-colors hover:bg-[var(--color-hover)]"
                  classList={{
                    "bg-[var(--color-hover)]": isCurrent(),
                  }}
                  onClick={() => handleTrackClick(track.id)}
                >
                  <div class="flex items-center justify-between gap-2">
                    <div class="flex-1 min-w-0">
                      <Show
                        when={isEditing()}
                        fallback={
                          <div
                            class="cursor-text"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!isEditing()) {
                                handleRenameStart(track.id);
                              }
                            }}
                          >
                            <div class="text-sm font-medium text-[var(--color-text)] truncate">
                              {track.name}
                            </div>
                            <div class="text-xs text-[var(--color-text-secondary)] mt-0.5">
                              {formatTime(track.duration)}
                            </div>
                          </div>
                        }
                      >
                        <input
                          type="text"
                          value={editName()}
                          onInput={(e) => setEditName(e.currentTarget.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleRenameSubmit(track.id);
                            } else if (e.key === "Escape") {
                              handleRenameCancel();
                            }
                          }}
                          onBlur={() => handleRenameSubmit(track.id)}
                          onClick={(e) => e.stopPropagation()}
                          class="w-full max-w-full box-border px-2 py-1 text-sm bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                          style="width: 100%; max-width: 100%;"
                          autofocus
                        />
                      </Show>
                    </div>
                    <div class="flex items-center gap-1 flex-shrink-0">
                      <Tooltip label="Duplicate Track">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDuplicateTrack(track.id, e);
                          }}
                          class="p-1 rounded hover:bg-[var(--color-bg)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                          aria-label="Duplicate Track"
                          disabled={!track.audioBuffer}
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                          >
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                        </button>
                      </Tooltip>
                      <Show when={store.tracks.length > 1}>
                        <Tooltip label="Delete Track">
                          <button
                            onClick={(e) => handleDeleteTrack(track.id, e)}
                            class="p-1 rounded hover:bg-[var(--color-danger)]/20 text-[var(--color-text-secondary)] hover:text-[var(--color-danger)] transition-colors"
                            aria-label="Delete Track"
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2"
                            >
                              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </Tooltip>
                      </Show>
                    </div>
                  </div>
                  <Show when={isCurrent() && !isEditing()}>
                    <div class="mt-1 text-xs text-[var(--color-text-secondary)]">Current</div>
                  </Show>
                </div>
              );
            }}
          </For>
        </Show>
      </div>
    </div>
  );
};
