import { Component, Show, createSignal } from "solid-js";

interface KeyboardShortcutsProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcuts: Component<KeyboardShortcutsProps> = (props) => {
  const [activeTab, setActiveTab] = createSignal<"getting-started" | "features" | "shortcuts">(
    "getting-started"
  );

  const shortcuts = [
    { keys: ["Space"], description: "Play/Pause" },
    { keys: ["Ctrl", "X"], description: "Cut selection", mac: ["Cmd", "X"] },
    { keys: ["Ctrl", "C"], description: "Copy selection", mac: ["Cmd", "C"] },
    { keys: ["Ctrl", "V"], description: "Paste at cursor", mac: ["Cmd", "V"] },
    { keys: ["Delete"], description: "Delete selection" },
    { keys: ["Backspace"], description: "Delete selection" },
    { keys: ["Ctrl", "Z"], description: "Undo", mac: ["Cmd", "Z"] },
    { keys: ["Ctrl", "Shift", "Z"], description: "Redo", mac: ["Cmd", "Shift", "Z"] },
    { keys: ["Ctrl", "Y"], description: "Redo", mac: ["Cmd", "Y"] },
    { keys: ["Escape"], description: "Clear selection" },
    { keys: ["R"], description: "Toggle repeat region" },
    { keys: ["M"], description: "Add marker at current time" },
    { keys: ["Shift", "M"], description: "Clear all markers" },
  ];

  const isMac = () => {
    if (typeof window === "undefined") return false;
    return /Mac|iPhone|iPod|iPad/i.test(navigator.platform);
  };

  return (
    <Show when={props.isOpen}>
      <div
        class="fixed inset-0 flex items-center justify-center backdrop-blur-sm bg-black/50 z-[2000]"
        onClick={props.onClose}
      >
        <div
          class="bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg sm:rounded-xl max-w-[800px] w-[95%] sm:w-[90%] max-h-[85vh] sm:max-h-[80vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div class="flex items-center justify-between py-4 sm:py-6 px-4 sm:px-6 border-b border-[var(--color-border)]">
            <h2 class="m-0 text-lg sm:text-xl font-semibold text-[var(--color-text)]">
              Help & Documentation
            </h2>
            <button
              class="flex-shrink-0 bg-none border-0 text-[var(--color-text-secondary)] cursor-pointer p-2 flex items-center justify-center rounded-md transition-all duration-150 hover:bg-[var(--color-border)] hover:text-[var(--color-text)]"
              onClick={props.onClose}
              aria-label="Close"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            </button>
          </div>
          <div class="flex border-b border-[var(--color-border)]">
            <button
              class={`px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
                activeTab() === "getting-started"
                  ? "text-[var(--color-primary)] border-b-2 border-[var(--color-primary)]"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
              }`}
              onClick={() => setActiveTab("getting-started")}
            >
              Getting Started
            </button>
            <button
              class={`px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
                activeTab() === "features"
                  ? "text-[var(--color-primary)] border-b-2 border-[var(--color-primary)]"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
              }`}
              onClick={() => setActiveTab("features")}
            >
              Features
            </button>
            <button
              class={`px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
                activeTab() === "shortcuts"
                  ? "text-[var(--color-primary)] border-b-2 border-[var(--color-primary)]"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
              }`}
              onClick={() => setActiveTab("shortcuts")}
            >
              Shortcuts
            </button>
          </div>
          <div class="flex-1 overflow-y-auto p-4 sm:p-6">
            <Show when={activeTab() === "getting-started"}>
              <div class="space-y-4 text-[var(--color-text)]">
                <div>
                  <h3 class="text-base font-semibold mb-2">Importing Audio</h3>
                  <p class="text-sm text-[var(--color-text-secondary)] mb-2">
                    Click the "Import" button in the toolbar or drag and drop audio files onto the
                    editor. You can import multiple files at once, and each will be added as a
                    separate track.
                  </p>
                </div>
                <div>
                  <h3 class="text-base font-semibold mb-2">Recording Audio</h3>
                  <p class="text-sm text-[var(--color-text-secondary)] mb-2">
                    Click the record button in the toolbar to start recording. Click again to stop.
                    The recorded audio will be automatically added as a new track.
                  </p>
                </div>
                <div>
                  <h3 class="text-base font-semibold mb-2">Selecting Audio</h3>
                  <p class="text-sm text-[var(--color-text-secondary)] mb-2">
                    Click and drag on any waveform to create a selection. You can drag selections to
                    move them, or use cut/copy/paste operations.
                  </p>
                </div>
                <div>
                  <h3 class="text-base font-semibold mb-2">Playing Audio</h3>
                  <p class="text-sm text-[var(--color-text-secondary)] mb-2">
                    Use the play button in the toolbar or press Spacebar to play/pause. Click
                    anywhere on a waveform to seek to that position.
                  </p>
                </div>
                <div>
                  <h3 class="text-base font-semibold mb-2">Saving Your Work</h3>
                  <p class="text-sm text-[var(--color-text-secondary)] mb-2">
                    Enter a project name at the top of the editor, then use "Save Project" to
                    download your project file. Use "Load Project" to restore a saved project.
                  </p>
                </div>
              </div>
            </Show>
            <Show when={activeTab() === "features"}>
              <div class="space-y-4 text-[var(--color-text)]">
                <div>
                  <h3 class="text-base font-semibold mb-2">Multi-Track Editing</h3>
                  <p class="text-sm text-[var(--color-text-secondary)] mb-2">
                    Work with unlimited audio tracks. Each track has independent volume, pan, mute,
                    and solo controls. Drag tracks to reorder them.
                  </p>
                </div>
                <div>
                  <h3 class="text-base font-semibold mb-2">Waveform Visualization</h3>
                  <p class="text-sm text-[var(--color-text-secondary)] mb-2">
                    Click the waveform icon on any track to cycle between bars, line, and
                    spectrogram views. Each view provides different visual information about your
                    audio.
                  </p>
                </div>
                <div>
                  <h3 class="text-base font-semibold mb-2">Editing Operations</h3>
                  <p class="text-sm text-[var(--color-text-secondary)] mb-2">
                    Cut, copy, paste, and delete selections. All operations support undo/redo. Use
                    the split button to divide a track at the current position or selection start.
                  </p>
                </div>
                <div>
                  <h3 class="text-base font-semibold mb-2">Audio Effects</h3>
                  <p class="text-sm text-[var(--color-text-secondary)] mb-2">
                    Apply effects from the Effects menu. Effects can be applied to the current
                    selection, current track, or all tracks. Available effects include normalize,
                    amplify, silence, reverse, fade in/out, reverb, delay, noise reduction, speed
                    change, pitch change, compressor, limiter, EQ, and filters.
                  </p>
                </div>
                <div>
                  <h3 class="text-base font-semibold mb-2">Markers</h3>
                  <p class="text-sm text-[var(--color-text-secondary)] mb-2">
                    Press M to add a marker at the current playback position. Markers are visual
                    aids that help you navigate your project. Click a marker to delete it, or press
                    Shift+M to clear all markers.
                  </p>
                </div>
                <div>
                  <h3 class="text-base font-semibold mb-2">Repeat Region</h3>
                  <p class="text-sm text-[var(--color-text-secondary)] mb-2">
                    Select a region and press R to set it as a repeat region. During playback, the
                    audio will loop within this region. Press R again to clear the repeat region.
                  </p>
                </div>
                <div>
                  <h3 class="text-base font-semibold mb-2">Zoom Controls</h3>
                  <p class="text-sm text-[var(--color-text-secondary)] mb-2">
                    Use the zoom controls in the toolbar to zoom in/out on the timeline. This helps
                    with precise editing and navigation.
                  </p>
                </div>
                <div>
                  <h3 class="text-base font-semibold mb-2">Export</h3>
                  <p class="text-sm text-[var(--color-text-secondary)] mb-2">
                    Export your project as a single audio file in WAV, MP3, or OGG format. The
                    export mixes all tracks together respecting volume, pan, mute, and solo
                    settings.
                  </p>
                </div>
                <div>
                  <h3 class="text-base font-semibold mb-2">Track Controls</h3>
                  <p class="text-sm text-[var(--color-text-secondary)] mb-2">
                    Each track has volume and pan sliders. Use mute to silence a track, or solo to
                    hear only that track. Click the color icon to set a track color for visual
                    organization.
                  </p>
                </div>
              </div>
            </Show>
            <Show when={activeTab() === "shortcuts"}>
              <div class="space-y-2">
                {shortcuts.map((shortcut) => {
                  const keys = isMac() && shortcut.mac ? shortcut.mac : shortcut.keys;
                  return (
                    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 py-2.5 sm:py-3 border-b border-[var(--color-border)] last:border-b-0">
                      <div class="flex items-center gap-1 flex-wrap">
                        {keys.map((key, index) => (
                          <>
                            <kbd class="bg-[var(--color-bg)] border border-[var(--color-border)] rounded py-0.5 sm:py-1 px-1.5 sm:px-2 text-[0.625rem] sm:text-xs font-semibold text-[var(--color-text)] font-mono min-w-5 sm:min-w-6 text-center">
                              {key}
                            </kbd>
                            {index < keys.length - 1 && (
                              <span class="text-[var(--color-text-secondary)] text-[0.625rem] sm:text-xs mx-0.5 sm:mx-1">
                                +
                              </span>
                            )}
                          </>
                        ))}
                      </div>
                      <span class="text-[var(--color-text-secondary)] text-xs sm:text-sm">
                        {shortcut.description}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
};
