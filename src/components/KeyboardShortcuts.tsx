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
  ];

  const isMac = () => {
    if (typeof window === "undefined") return false;
    return /Mac|iPhone|iPod|iPad/i.test(navigator.platform);
  };

  return (
    <Show when={props.isOpen}>
      <div class="keyboard-shortcuts-overlay" onClick={props.onClose}>
        <div class="keyboard-shortcuts-modal" onClick={(e) => e.stopPropagation()}>
          <div class="keyboard-shortcuts-header">
            <h2>Keyboard Shortcuts</h2>
            <button class="keyboard-shortcuts-close" onClick={props.onClose} aria-label="Close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            </button>
          </div>
          <div class="keyboard-shortcuts-list">
            {shortcuts.map((shortcut) => {
              const keys = isMac() && shortcut.mac ? shortcut.mac : shortcut.keys;
              return (
                <div class="keyboard-shortcuts-item">
                  <div class="keyboard-shortcuts-keys">
                    {keys.map((key, index) => (
                      <>
                        <kbd class="keyboard-shortcuts-key">{key}</kbd>
                        {index < keys.length - 1 && <span class="keyboard-shortcuts-plus">+</span>}
                      </>
                    ))}
                  </div>
                  <span class="keyboard-shortcuts-description">{shortcut.description}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Show>
  );
};
