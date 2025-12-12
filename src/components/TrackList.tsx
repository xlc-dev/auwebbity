import { Component, Show, createSignal, For } from "solid-js";
import { useAudioStore } from "../stores/audioStore";
import { Tooltip } from "./Tooltip";
import { formatTime } from "../utils/timeUtils";

interface TrackListProps {
  onAddTrack?: () => void;
}

export const TrackList: Component<TrackListProps> = (props) => {
  const { store, setCurrentTrackId, deleteTrack, setAudioStore } = useAudioStore();
  const [editingTrackId, setEditingTrackId] = createSignal<string | null>(null);
  const [editName, setEditName] = createSignal("");

  const handleTrackClick = (trackId: string) => {
    setCurrentTrackId(trackId);
  };

  const handleDeleteTrack = (trackId: string, e: Event) => {
    e.stopPropagation();
    if (store.tracks.length <= 1) {
      return;
    }
    deleteTrack(trackId);
  };

  const handleRenameStart = (trackId: string, e: Event) => {
    e.stopPropagation();
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
                  <Show
                    when={isEditing()}
                    fallback={
                      <>
                        <div class="flex items-center justify-between gap-2">
                          <div class="flex-1 min-w-0">
                            <div class="text-sm font-medium text-[var(--color-text)] truncate">
                              {track.name}
                            </div>
                            <div class="text-xs text-[var(--color-text-secondary)] mt-0.5">
                              {formatTime(track.duration)}
                            </div>
                          </div>
                          <div class="flex items-center gap-1">
                            <Tooltip label="Rename Track">
                              <button
                                onClick={(e) => handleRenameStart(track.id, e)}
                                class="p-1 rounded hover:bg-[var(--color-bg)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors"
                                aria-label="Rename Track"
                              >
                                <svg
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  stroke-width="2"
                                >
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
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
                        <Show when={isCurrent()}>
                          <div class="mt-1 text-xs text-[var(--color-text-secondary)]">Current</div>
                        </Show>
                      </>
                    }
                  >
                    <div class="flex items-center gap-2">
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
                        class="flex-1 px-2 py-1 text-sm bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                        autofocus
                      />
                    </div>
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
