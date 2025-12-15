import { Component, createSignal, Show, onMount, onCleanup, For, createEffect } from "solid-js";
import { Portal } from "solid-js/web";
import { useAudioStore } from "../stores/audioStore";
import { Tooltip } from "./Tooltip";

type ExportFormat = "wav" | "mp3" | "ogg";
type ExportQuality = string;
type ExportScope = "all" | "current" | "selection";

interface ExportMenuProps {
  onExport: (format: ExportFormat, quality: ExportQuality, scope: ExportScope) => void;
  disabled?: boolean;
  isExporting?: boolean;
}

interface FormatOption {
  value: ExportFormat;
  label: string;
}

interface QualityOption {
  value: ExportQuality;
  label: string;
  description?: string;
}

const formatOptions: FormatOption[] = [
  { value: "wav", label: "WAV" },
  { value: "mp3", label: "MP3" },
  { value: "ogg", label: "OGG" },
];

const getQualityOptions = (format: ExportFormat): QualityOption[] => {
  switch (format) {
    case "wav":
      return [
        { value: "16", label: "16-bit", description: "Standard quality" },
        { value: "24", label: "24-bit", description: "High quality" },
        { value: "32", label: "32-bit", description: "Maximum quality" },
      ];
    case "mp3":
      return [
        { value: "128", label: "128 kbps", description: "Good quality" },
        { value: "192", label: "192 kbps", description: "High quality" },
        { value: "256", label: "256 kbps", description: "Very high quality" },
        { value: "320", label: "320 kbps", description: "Maximum quality" },
      ];
    case "ogg":
      return [
        { value: "3", label: "Quality 3", description: "Good quality" },
        { value: "5", label: "Quality 5", description: "High quality" },
        { value: "7", label: "Quality 7", description: "Very high quality" },
        { value: "10", label: "Quality 10", description: "Maximum quality" },
      ];
  }
};

interface ScopeOption {
  value: ExportScope;
  label: string;
  description?: string;
}

const scopeOptions: ScopeOption[] = [
  { value: "all", label: "All Tracks", description: "Mix all tracks together" },
  { value: "current", label: "Current Track", description: "Export only the current track" },
  { value: "selection", label: "Selection Only", description: "Export selected region" },
];

export const ExportMenu: Component<ExportMenuProps> = (props) => {
  const { store, getCurrentTrack } = useAudioStore();
  const [isOpen, setIsOpen] = createSignal(false);
  const [format, setFormat] = createSignal<ExportFormat>("wav");
  const [quality, setQuality] = createSignal<ExportQuality>("16");
  const [scope, setScope] = createSignal<ExportScope>("all");
  let containerRef: HTMLDivElement | undefined;
  let buttonRef: HTMLButtonElement | undefined;
  const [menuPosition, setMenuPosition] = createSignal({ top: 0, right: 0 });

  const hasTrack = () => getCurrentTrack() !== null;
  const hasProjectName = () => !!store.projectName?.trim();
  const hasSelection = () => store.selection !== null;
  const canExportSelection = () => hasSelection() && hasTrack();

  const updateQualityForFormat = (newFormat: ExportFormat) => {
    const options = getQualityOptions(newFormat);
    const firstOption = options[0];
    if (firstOption) {
      setQuality(firstOption.value);
    }
  };

  const updateMenuPosition = () => {
    if (!buttonRef) return;
    const rect = buttonRef.getBoundingClientRect();
    setMenuPosition({
      top: rect.top - 4,
      right: window.innerWidth - rect.right,
    });
  };

  const closeAll = () => {
    setIsOpen(false);
  };

  const handleClickOutside = (e: MouseEvent) => {
    if (containerRef && !containerRef.contains(e.target as Node)) {
      closeAll();
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      if (isOpen()) {
        e.stopPropagation();
        closeAll();
      }
    }
  };

  createEffect(() => {
    if (isOpen()) {
      updateMenuPosition();
      const handleScroll = () => updateMenuPosition();
      const handleResize = () => updateMenuPosition();
      window.addEventListener("scroll", handleScroll, true);
      window.addEventListener("resize", handleResize);
      return () => {
        window.removeEventListener("scroll", handleScroll, true);
        window.removeEventListener("resize", handleResize);
      };
    }
  });

  onMount(() => {
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
  });

  onCleanup(() => {
    document.removeEventListener("mousedown", handleClickOutside);
    document.removeEventListener("keydown", handleKeyDown);
  });

  const handleExport = () => {
    if (!hasProjectName()) {
      return;
    }
    const exportScope = scope();
    if (exportScope === "selection" && !hasSelection()) {
      return;
    }
    if (exportScope === "current" && !hasTrack()) {
      return;
    }
    props.onExport(format(), quality(), exportScope);
    closeAll();
  };

  const qualityOptions = () => getQualityOptions(format());

  return (
    <div ref={containerRef} class="relative inline-block">
      <Tooltip
        label={
          !hasProjectName()
            ? "Enter a project name to export"
            : props.isExporting
              ? "Exporting..."
              : "Export Audio"
        }
      >
        <button
          ref={buttonRef}
          type="button"
          class="flex items-center gap-1.5 sm:gap-2 py-1 sm:py-1.5 px-2 sm:px-2.5 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-md text-[var(--color-text)] text-[0.75rem] sm:text-[0.8125rem] font-medium cursor-pointer transition-all duration-200 font-inherit hover:bg-[var(--color-hover)] hover:border-[var(--color-border-hover)] hover:-translate-y-px active:translate-y-0 focus:outline-none focus:border-[var(--color-primary)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 w-8 h-8 sm:w-9 sm:h-9 p-0 justify-center"
          classList={{
            "border-[var(--color-primary)]": isOpen(),
          }}
          onClick={() => {
            if (!props.disabled && !props.isExporting) {
              setIsOpen(!isOpen());
              if (!isOpen()) {
                requestAnimationFrame(updateMenuPosition);
              }
            }
          }}
          disabled={props.disabled || !hasTrack() || !hasProjectName() || props.isExporting}
          aria-haspopup="menu"
          aria-expanded={isOpen()}
          aria-label="Export Audio"
        >
          {props.isExporting ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
            </svg>
          )}
        </button>
      </Tooltip>
      <Show when={isOpen()}>
        <Portal>
          <div
            class="fixed bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-md overflow-hidden z-[1000] w-[calc(100vw-3rem)] sm:w-auto sm:min-w-[240px] max-w-[280px] sm:max-w-none"
            style={{
              top: `${menuPosition().top}px`,
              right: `${menuPosition().right}px`,
              animation: "dropdownSlideUp 0.15s ease-out forwards",
            }}
          >
            <div class="px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
              <div class="text-[0.75rem] font-medium text-[var(--color-text-secondary)] mb-2">
                Export Scope:
              </div>
              <div class="flex flex-col gap-1">
                <For each={scopeOptions}>
                  {(option) => {
                    const isSelected = () => scope() === option.value;
                    const isDisabled = () =>
                      option.value === "selection" && !canExportSelection() ||
                      option.value === "current" && !hasTrack();

                    return (
                      <button
                        type="button"
                        class="flex items-center gap-2 px-2 py-1.5 rounded text-[0.8125rem] text-left transition-colors cursor-pointer"
                        classList={{
                          "bg-[var(--color-primary)]/20 text-[var(--color-primary)]": isSelected(),
                          "bg-transparent text-[var(--color-text)] hover:bg-[var(--color-hover)]":
                            !isSelected(),
                          "opacity-50 cursor-not-allowed": isDisabled(),
                        }}
                        onClick={() => {
                          if (!isDisabled()) {
                            setScope(option.value);
                          }
                        }}
                        disabled={isDisabled()}
                      >
                        <div
                          class="w-3 h-3 rounded border-2 flex-shrink-0"
                          classList={{
                            "bg-[var(--color-primary)] border-[var(--color-primary)]": isSelected(),
                            "border-[var(--color-border)]": !isSelected(),
                          }}
                        >
                          {isSelected() && (
                            <svg
                              class="w-full h-full text-white"
                              fill="currentColor"
                              viewBox="0 0 12 12"
                            >
                              <path
                                d="M10 3L4.5 8.5 2 6"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                fill="none"
                              />
                            </svg>
                          )}
                        </div>
                        <div class="flex flex-col">
                          <span>{option.label}</span>
                          {option.description && (
                            <span class="text-[0.625rem] text-[var(--color-text-secondary)]">
                              {option.description}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  }}
                </For>
              </div>
            </div>
            <div class="px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
              <div class="text-[0.75rem] font-medium text-[var(--color-text-secondary)] mb-2">
                Format:
              </div>
              <div class="flex flex-col gap-1">
                <For each={formatOptions}>
                  {(option) => {
                    const isSelected = () => format() === option.value;

                    return (
                      <button
                        type="button"
                        class="flex items-center gap-2 px-2 py-1.5 rounded text-[0.8125rem] text-left transition-colors cursor-pointer"
                        classList={{
                          "bg-[var(--color-primary)]/20 text-[var(--color-primary)]": isSelected(),
                          "bg-transparent text-[var(--color-text)] hover:bg-[var(--color-hover)]":
                            !isSelected(),
                        }}
                        onClick={() => {
                          setFormat(option.value);
                          updateQualityForFormat(option.value);
                        }}
                      >
                        <div
                          class="w-3 h-3 rounded border-2 flex-shrink-0"
                          classList={{
                            "bg-[var(--color-primary)] border-[var(--color-primary)]": isSelected(),
                            "border-[var(--color-border)]": !isSelected(),
                          }}
                        >
                          {isSelected() && (
                            <svg
                              class="w-full h-full text-white"
                              fill="currentColor"
                              viewBox="0 0 12 12"
                            >
                              <path
                                d="M10 3L4.5 8.5 2 6"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                fill="none"
                              />
                            </svg>
                          )}
                        </div>
                        <span>{option.label}</span>
                      </button>
                    );
                  }}
                </For>
              </div>
            </div>
            <div class="px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
              <div class="text-[0.75rem] font-medium text-[var(--color-text-secondary)] mb-2">
                Quality:
              </div>
              <div class="flex flex-col gap-1">
                <For each={qualityOptions()}>
                  {(option) => {
                    const isSelected = () => quality() === option.value;

                    return (
                      <button
                        type="button"
                        class="flex items-center gap-2 px-2 py-1.5 rounded text-[0.8125rem] text-left transition-colors cursor-pointer"
                        classList={{
                          "bg-[var(--color-primary)]/20 text-[var(--color-primary)]": isSelected(),
                          "bg-transparent text-[var(--color-text)] hover:bg-[var(--color-hover)]":
                            !isSelected(),
                        }}
                        onClick={() => setQuality(option.value)}
                      >
                        <div
                          class="w-3 h-3 rounded border-2 flex-shrink-0"
                          classList={{
                            "bg-[var(--color-primary)] border-[var(--color-primary)]": isSelected(),
                            "border-[var(--color-border)]": !isSelected(),
                          }}
                        >
                          {isSelected() && (
                            <svg
                              class="w-full h-full text-white"
                              fill="currentColor"
                              viewBox="0 0 12 12"
                            >
                              <path
                                d="M10 3L4.5 8.5 2 6"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                fill="none"
                              />
                            </svg>
                          )}
                        </div>
                        <div class="flex flex-col">
                          <span>{option.label}</span>
                          {option.description && (
                            <span class="text-[0.625rem] text-[var(--color-text-secondary)]">
                              {option.description}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  }}
                </For>
              </div>
            </div>
            <div class="p-2 flex justify-end">
              <Tooltip
                label={
                  scope() === "selection" && !hasSelection()
                    ? "Select a region to export"
                    : scope() === "current" && !hasTrack()
                      ? "No track selected"
                      : `Export ${scope() === "all" ? "all tracks" : scope() === "current" ? "current track" : "selection"} as ${format().toUpperCase()} with selected quality`
                }
              >
                <button
                  type="button"
                  class="py-1.5 px-3 bg-[var(--color-primary)] text-white border-0 rounded text-[0.8125rem] font-medium cursor-pointer transition-all duration-150 hover:bg-[var(--color-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleExport}
                  disabled={
                    !hasProjectName() ||
                    (scope() === "selection" && !hasSelection()) ||
                    (scope() === "current" && !hasTrack())
                  }
                >
                  Export
                </button>
              </Tooltip>
            </div>
          </div>
        </Portal>
      </Show>
    </div>
  );
};
