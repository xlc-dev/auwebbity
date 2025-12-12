import { Component, createSignal, Show, onMount, onCleanup, createEffect, For } from "solid-js";
import { useAudioStore } from "../stores/audioStore";
import { Tooltip } from "./Tooltip";

type EffectScope = "all" | "track" | "selection";

interface EffectsMenuProps {
  onNormalize: (scope: EffectScope) => void;
  onAmplify: (gain: number, scope: EffectScope) => void;
  onSilence: (scope: EffectScope) => void;
  onReverse: (scope: EffectScope) => void;
  onFadeIn: (scope: EffectScope) => void;
  onFadeOut: (scope: EffectScope) => void;
  disabled?: boolean;
}

interface ScopeOption {
  value: EffectScope;
  label: string;
  getLabel?: () => string;
  disabled?: () => boolean;
}

interface EffectItem {
  label: string;
  onClick: () => void;
  disabled?: () => boolean;
  requiresSelection?: boolean;
}

export const EffectsMenu: Component<EffectsMenuProps> = (props) => {
  const { store, getCurrentTrack } = useAudioStore();
  const [isOpen, setIsOpen] = createSignal(false);
  const [showAmplifyDialog, setShowAmplifyDialog] = createSignal(false);
  const [amplifyValue, setAmplifyValue] = createSignal("1.5");
  const [scope, setScope] = createSignal<EffectScope>("track");
  let containerRef: HTMLDivElement | undefined;

  const hasTrack = () => getCurrentTrack() !== null;
  const hasSelection = () => store.selection !== null;

  createEffect(() => {
    if (isOpen() && hasSelection() && scope() === "track") {
      setScope("selection");
    } else if (isOpen() && !hasSelection() && scope() === "selection") {
      setScope("track");
    }
  });

  const closeAll = () => {
    setIsOpen(false);
    setShowAmplifyDialog(false);
  };

  const handleClickOutside = (e: MouseEvent) => {
    if (containerRef && !containerRef.contains(e.target as Node)) {
      closeAll();
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      const wasOpen = isOpen() || showAmplifyDialog();
      if (wasOpen) {
        e.stopPropagation();
        closeAll();
      }
    }
  };

  onMount(() => {
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
  });

  onCleanup(() => {
    document.removeEventListener("mousedown", handleClickOutside);
    document.removeEventListener("keydown", handleKeyDown);
  });

  const getEffectiveScope = (): EffectScope => {
    const currentScope = scope();
    if (currentScope === "selection" && !hasSelection()) {
      return "track";
    }
    return currentScope;
  };

  const getScopeLabel = () => {
    const effectiveScope = getEffectiveScope();
    return effectiveScope === "all"
      ? "All Tracks"
      : effectiveScope === "selection"
        ? "Selection"
        : "Current Track";
  };

  const scopeOptions: ScopeOption[] = [
    { value: "all", label: "All Tracks" },
    {
      value: "track",
      label: "Current Track",
      getLabel: () => `Current Track (${getCurrentTrack()?.name || "Untitled"})`,
    },
    {
      value: "selection",
      label: "Selection",
      disabled: () => !hasSelection(),
      getLabel: () => `Selection${!hasSelection() ? " (requires selection)" : ""}`,
    },
  ];

  const handleNormalize = () => {
    props.onNormalize(getEffectiveScope());
    closeAll();
  };

  const handleAmplify = () => {
    const gain = parseFloat(amplifyValue());
    if (isNaN(gain) || gain <= 0) return;
    props.onAmplify(gain, getEffectiveScope());
    closeAll();
  };

  const handleSilence = () => {
    const effectiveScope = getEffectiveScope();
    if (effectiveScope === "selection" && !hasSelection()) return;
    props.onSilence(effectiveScope);
    closeAll();
  };

  const handleReverse = () => {
    props.onReverse(getEffectiveScope());
    closeAll();
  };

  const handleFadeIn = () => {
    props.onFadeIn(getEffectiveScope());
    closeAll();
  };

  const handleFadeOut = () => {
    props.onFadeOut(getEffectiveScope());
    closeAll();
  };

  const amplifyPercent = () => {
    const gain = parseFloat(amplifyValue());
    if (isNaN(gain)) return "";
    const percent = ((gain - 1) * 100).toFixed(0);
    return percent === "0" ? "0%" : percent.startsWith("-") ? `${percent}%` : `+${percent}%`;
  };

  const effectItems: EffectItem[] = [
    { label: "Normalize", onClick: handleNormalize },
    { label: "Amplify...", onClick: () => setShowAmplifyDialog(true) },
    {
      label: "Silence",
      onClick: handleSilence,
      disabled: () => !hasSelection(),
      requiresSelection: true,
    },
    { label: "Reverse", onClick: handleReverse },
    { label: "Fade In", onClick: handleFadeIn },
    { label: "Fade Out", onClick: handleFadeOut },
  ];

  const menuButtonClass =
    "block w-full py-2 px-3 bg-transparent border-0 text-[var(--color-text)] text-[0.8125rem] font-medium text-left cursor-pointer transition-[background-color] duration-150 font-inherit hover:bg-[var(--color-hover)] disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div ref={containerRef} class="relative inline-block">
      <Tooltip label="Effects">
        <button
          type="button"
          class="flex items-center gap-1.5 sm:gap-2 py-1 sm:py-1.5 px-2 sm:px-2.5 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-md text-[var(--color-text)] text-[0.75rem] sm:text-[0.8125rem] font-medium cursor-pointer transition-all duration-200 font-inherit hover:bg-[var(--color-hover)] hover:border-[var(--color-border-hover)] focus:outline-none focus:border-[var(--color-primary)] disabled:opacity-50 disabled:cursor-not-allowed w-8 h-8 sm:w-9 sm:h-9 p-0 justify-center"
          classList={{
            "border-[var(--color-primary)]": isOpen(),
          }}
          onClick={() => !props.disabled && setIsOpen(!isOpen())}
          disabled={props.disabled || !hasTrack()}
          aria-haspopup="menu"
          aria-expanded={isOpen()}
          aria-label="Effects"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </button>
      </Tooltip>
      <Show when={isOpen()}>
        <div class="absolute bottom-[calc(100%+4px)] right-0 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-md overflow-hidden z-[1000] min-w-[220px] animate-[dropdownSlideDown_0.15s_ease-out]">
          <Show when={!showAmplifyDialog()}>
            <div class="px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
              <div class="text-[0.75rem] font-medium text-[var(--color-text-secondary)] mb-2">
                Apply to:
              </div>
              <div class="flex flex-col gap-1">
                <For each={scopeOptions}>
                  {(option) => {
                    const isSelected = () => scope() === option.value;
                    const isDisabled = () => option.disabled?.() ?? false;
                    const label = () => option.getLabel?.() ?? option.label;

                    return (
                      <button
                        type="button"
                        class="flex items-center gap-2 px-2 py-1.5 rounded text-[0.8125rem] text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        classList={{
                          "bg-[var(--color-primary)]/20 text-[var(--color-primary)]": isSelected(),
                          "bg-transparent text-[var(--color-text)] hover:bg-[var(--color-hover)]":
                            !isSelected(),
                        }}
                        onClick={() => setScope(option.value)}
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
                        <span>{label()}</span>
                      </button>
                    );
                  }}
                </For>
              </div>
            </div>
            <For each={effectItems}>
              {(item) => {
                const isDisabled = () => item.disabled?.() ?? false;
                return (
                  <button
                    type="button"
                    class={menuButtonClass}
                    onClick={item.onClick}
                    disabled={isDisabled()}
                  >
                    {item.label}
                    {item.requiresSelection && !hasSelection() && (
                      <span class="ml-1.5 text-[0.625rem] text-[var(--color-text-secondary)]">
                        (requires selection)
                      </span>
                    )}
                  </button>
                );
              }}
            </For>
          </Show>
          <Show when={showAmplifyDialog()}>
            <div class="p-3 border-b border-[var(--color-border)]">
              <div class="mb-2 px-1.5 py-1 bg-[var(--color-bg-secondary)] rounded text-[0.625rem] text-[var(--color-text-secondary)]">
                Applying to: <span class="font-medium">{getScopeLabel()}</span>
              </div>
              <label class="block text-[0.75rem] font-medium text-[var(--color-text-secondary)] mb-1.5">
                Gain Multiplier
              </label>
              <input
                type="number"
                min="0.1"
                max="10"
                step="0.1"
                value={amplifyValue()}
                onInput={(e) => setAmplifyValue(e.currentTarget.value)}
                class="w-full py-1.5 px-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-[var(--color-text)] text-[0.8125rem] focus:outline-none focus:border-[var(--color-primary)]"
                autofocus
              />
              <div class="mt-1.5 text-[0.75rem] text-[var(--color-text-secondary)]">
                {amplifyPercent()}
              </div>
            </div>
            <div class="flex gap-2 p-2">
              <Tooltip label={`Apply amplify effect to ${getScopeLabel().toLowerCase()}`}>
                <button
                  type="button"
                  class="flex-1 py-1.5 px-3 bg-[var(--color-primary)] text-white border-0 rounded text-[0.8125rem] font-medium cursor-pointer transition-all duration-150 hover:bg-[var(--color-primary-hover)]"
                  onClick={handleAmplify}
                >
                  Apply
                </button>
              </Tooltip>
              <button
                type="button"
                class="flex-1 py-1.5 px-3 bg-[var(--color-bg)] text-[var(--color-text)] border border-[var(--color-border)] rounded text-[0.8125rem] font-medium cursor-pointer transition-all duration-150 hover:bg-[var(--color-hover)]"
                onClick={() => setShowAmplifyDialog(false)}
              >
                Cancel
              </button>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
};
