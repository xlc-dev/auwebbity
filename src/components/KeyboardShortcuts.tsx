import { Component, Show } from "solid-js";

interface KeyboardShortcutsProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcuts: Component<KeyboardShortcutsProps> = (props) => {
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
    { keys: ["R"], description: "Clear repeat region" },
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
          class="bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg sm:rounded-xl max-w-[600px] w-[95%] sm:w-[90%] max-h-[85vh] sm:max-h-[80vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div class="flex items-center justify-between py-4 sm:py-6 px-4 sm:px-6 border-b border-[var(--color-border)]">
            <h2 class="m-0 text-lg sm:text-xl font-semibold text-[var(--color-text)]">
              Keyboard Shortcuts
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
          <div class="p-3 sm:p-4">
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
        </div>
      </div>
    </Show>
  );
};
