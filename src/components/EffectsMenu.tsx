import { Component, createSignal, Show, onMount, onCleanup, createEffect, For } from "solid-js";
import { Portal } from "solid-js/web";
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
  onReverb: (roomSize: number, wetLevel: number, scope: EffectScope) => void;
  onDelay: (delayTime: number, feedback: number, wetLevel: number, scope: EffectScope) => void;
  onNoiseReduction: (reductionAmount: number, scope: EffectScope) => void;
  onChangeSpeed: (speedFactor: number, scope: EffectScope) => void;
  onChangePitch: (pitchFactor: number, scope: EffectScope) => void;
  onCompressor: (threshold: number, ratio: number, attack: number, release: number, knee: number, scope: EffectScope) => void;
  onLimiter: (threshold: number, release: number, scope: EffectScope) => void;
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
  const [showReverbDialog, setShowReverbDialog] = createSignal(false);
  const [showDelayDialog, setShowDelayDialog] = createSignal(false);
  const [showNoiseReductionDialog, setShowNoiseReductionDialog] = createSignal(false);
  const [showSpeedDialog, setShowSpeedDialog] = createSignal(false);
  const [showPitchDialog, setShowPitchDialog] = createSignal(false);
  const [showCompressorDialog, setShowCompressorDialog] = createSignal(false);
  const [showLimiterDialog, setShowLimiterDialog] = createSignal(false);
  const [amplifyValue, setAmplifyValue] = createSignal("1.5");
  const [reverbRoomSize, setReverbRoomSize] = createSignal("2.0");
  const [reverbWetLevel, setReverbWetLevel] = createSignal("0.5");
  const [delayTime, setDelayTime] = createSignal("0.3");
  const [delayFeedback, setDelayFeedback] = createSignal("0.4");
  const [delayWetLevel, setDelayWetLevel] = createSignal("0.5");
  const [noiseReductionAmount, setNoiseReductionAmount] = createSignal("0.5");
  const [speedFactor, setSpeedFactor] = createSignal("1.0");
  const [pitchFactor, setPitchFactor] = createSignal("1.0");
  const [compressorThreshold, setCompressorThreshold] = createSignal("-12");
  const [compressorRatio, setCompressorRatio] = createSignal("4");
  const [compressorAttack, setCompressorAttack] = createSignal("0.003");
  const [compressorRelease, setCompressorRelease] = createSignal("0.1");
  const [compressorKnee, setCompressorKnee] = createSignal("2");
  const [limiterThreshold, setLimiterThreshold] = createSignal("-1");
  const [limiterRelease, setLimiterRelease] = createSignal("0.01");
  const [scope, setScope] = createSignal<EffectScope>("track");
  let containerRef: HTMLDivElement | undefined;
  let buttonRef: HTMLButtonElement | undefined;
  let portalRef: HTMLDivElement | undefined;
  const [menuPosition, setMenuPosition] = createSignal({ top: 0, right: 0 });

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
    setShowReverbDialog(false);
    setShowDelayDialog(false);
    setShowNoiseReductionDialog(false);
    setShowSpeedDialog(false);
    setShowPitchDialog(false);
    setShowCompressorDialog(false);
    setShowLimiterDialog(false);
  };

  const updateMenuPosition = () => {
    if (!buttonRef) return;
    const rect = buttonRef.getBoundingClientRect();
    setMenuPosition({
      top: rect.top - 4,
      right: window.innerWidth - rect.right,
    });
  };

  const handleClickOutside = (e: MouseEvent) => {
    const target = e.target as Node;
    const isInsideContainer = containerRef?.contains(target);
    const isInsidePortal = portalRef?.contains(target);
    const hasDialogOpen = showAmplifyDialog() || showReverbDialog() || showDelayDialog() || showNoiseReductionDialog() || showSpeedDialog() || showPitchDialog() || showCompressorDialog() || showLimiterDialog();

    if (!isInsideContainer && !isInsidePortal && !hasDialogOpen) {
      closeAll();
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      const wasOpen = isOpen() || showAmplifyDialog() || showReverbDialog() || showDelayDialog() || showNoiseReductionDialog() || showSpeedDialog() || showPitchDialog() || showCompressorDialog() || showLimiterDialog();
      if (wasOpen) {
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

  const handleReverb = () => {
    const roomSize = parseFloat(reverbRoomSize());
    const wetLevel = parseFloat(reverbWetLevel());
    if (
      isNaN(roomSize) ||
      roomSize <= 0 ||
      roomSize > 3 ||
      isNaN(wetLevel) ||
      wetLevel < 0 ||
      wetLevel > 1
    ) {
      return;
    }
    props.onReverb(roomSize, wetLevel, getEffectiveScope());
    closeAll();
  };

  const handleDelay = () => {
    const delay = parseFloat(delayTime());
    const feedback = parseFloat(delayFeedback());
    const wetLevel = parseFloat(delayWetLevel());
    if (
      isNaN(delay) ||
      delay <= 0 ||
      delay > 2 ||
      isNaN(feedback) ||
      feedback < 0 ||
      feedback >= 1 ||
      isNaN(wetLevel) ||
      wetLevel < 0 ||
      wetLevel > 1
    ) {
      return;
    }
    props.onDelay(delay, feedback, wetLevel, getEffectiveScope());
    closeAll();
  };

  const handleNoiseReduction = () => {
    const reduction = parseFloat(noiseReductionAmount());
    if (isNaN(reduction) || reduction < 0 || reduction > 1) {
      return;
    }
    props.onNoiseReduction(reduction, getEffectiveScope());
    closeAll();
  };

  const handleChangeSpeed = () => {
    const speed = parseFloat(speedFactor());
    if (isNaN(speed) || speed <= 0 || speed > 4) {
      return;
    }
    props.onChangeSpeed(speed, getEffectiveScope());
    closeAll();
  };

  const handleChangePitch = () => {
    const pitch = parseFloat(pitchFactor());
    if (isNaN(pitch) || pitch <= 0 || pitch > 4) {
      return;
    }
    props.onChangePitch(pitch, getEffectiveScope());
    closeAll();
  };

  const handleCompressor = () => {
    const threshold = parseFloat(compressorThreshold());
    const ratio = parseFloat(compressorRatio());
    const attack = parseFloat(compressorAttack());
    const release = parseFloat(compressorRelease());
    const knee = parseFloat(compressorKnee());
    if (
      isNaN(threshold) ||
      threshold < -60 ||
      threshold > 0 ||
      isNaN(ratio) ||
      ratio < 1 ||
      ratio > 20 ||
      isNaN(attack) ||
      attack < 0.0001 ||
      attack > 1 ||
      isNaN(release) ||
      release < 0.01 ||
      release > 5 ||
      isNaN(knee) ||
      knee < 0 ||
      knee > 12
    ) {
      return;
    }
    props.onCompressor(threshold, ratio, attack, release, knee, getEffectiveScope());
    closeAll();
  };

  const handleLimiter = () => {
    const threshold = parseFloat(limiterThreshold());
    const release = parseFloat(limiterRelease());
    if (
      isNaN(threshold) ||
      threshold < -60 ||
      threshold > 0 ||
      isNaN(release) ||
      release < 0.001 ||
      release > 1
    ) {
      return;
    }
    props.onLimiter(threshold, release, getEffectiveScope());
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
    { label: "Reverb...", onClick: () => setShowReverbDialog(true) },
    { label: "Delay...", onClick: () => setShowDelayDialog(true) },
    { label: "Noise Reduction...", onClick: () => setShowNoiseReductionDialog(true) },
    { label: "Change Speed...", onClick: () => setShowSpeedDialog(true) },
    { label: "Change Pitch...", onClick: () => setShowPitchDialog(true) },
    { label: "Compressor...", onClick: () => setShowCompressorDialog(true) },
    { label: "Limiter...", onClick: () => setShowLimiterDialog(true) },
  ];

  const menuButtonClass =
    "block w-full py-2 px-3 bg-transparent border-0 text-[var(--color-text)] text-[0.8125rem] font-medium text-left cursor-pointer transition-[background-color] duration-150 font-inherit hover:bg-[var(--color-hover)] disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div ref={containerRef} class="relative inline-block">
      <Tooltip label="Effects">
        <button
          ref={buttonRef}
          type="button"
          class="flex items-center gap-1.5 sm:gap-2 py-1 sm:py-1.5 px-2 sm:px-2.5 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-md text-[var(--color-text)] text-[0.75rem] sm:text-[0.8125rem] font-medium cursor-pointer transition-all duration-200 font-inherit hover:bg-[var(--color-hover)] hover:border-[var(--color-border-hover)] hover:-translate-y-px active:translate-y-0 focus:outline-none focus:border-[var(--color-primary)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 w-8 h-8 sm:w-9 sm:h-9 p-0 justify-center"
          classList={{
            "border-[var(--color-primary)]": isOpen(),
          }}
          onClick={() => {
            if (!props.disabled) {
              setIsOpen(!isOpen());
              if (!isOpen()) {
                requestAnimationFrame(updateMenuPosition);
              }
            }
          }}
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
        <Portal>
          <div
            ref={portalRef}
            class="fixed bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-md overflow-hidden z-[1000] w-auto min-w-[220px] max-w-[280px] sm:max-w-none"
            style={{
              top: `${menuPosition().top}px`,
              right: `${menuPosition().right}px`,
              animation: "dropdownSlideUp 0.15s ease-out forwards",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <Show when={!showAmplifyDialog() && !showReverbDialog() && !showDelayDialog() && !showNoiseReductionDialog() && !showSpeedDialog() && !showPitchDialog() && !showCompressorDialog() && !showLimiterDialog()}>
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
                          class="flex items-center gap-2 px-2 py-1.5 rounded text-[0.8125rem] text-left transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          classList={{
                            "bg-[var(--color-primary)]/20 text-[var(--color-primary)]":
                              isSelected(),
                            "bg-transparent text-[var(--color-text)] hover:bg-[var(--color-hover)]":
                              !isSelected(),
                          }}
                          onClick={() => setScope(option.value)}
                          disabled={isDisabled()}
                        >
                          <div
                            class="w-3 h-3 rounded border-2 flex-shrink-0"
                            classList={{
                              "bg-[var(--color-primary)] border-[var(--color-primary)]":
                                isSelected(),
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
                      onClick={(e) => {
                        e.stopPropagation();
                        item.onClick();
                      }}
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
              <div
                class="p-3 border-b border-[var(--color-border)]"
                onClick={(e) => e.stopPropagation()}
              >
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
                  class="py-1.5 px-4 bg-[var(--color-bg)] text-[var(--color-text)] border border-[var(--color-border)] rounded text-[0.8125rem] font-medium cursor-pointer transition-all duration-150 hover:bg-[var(--color-hover)]"
                  onClick={() => setShowAmplifyDialog(false)}
                >
                  Cancel
                </button>
              </div>
            </Show>
            <Show when={showReverbDialog()}>
              <div
                class="p-3 border-b border-[var(--color-border)]"
                onClick={(e) => e.stopPropagation()}
              >
                <div class="mb-2 px-1.5 py-1 bg-[var(--color-bg-secondary)] rounded text-[0.625rem] text-[var(--color-text-secondary)]">
                  Applying to: <span class="font-medium">{getScopeLabel()}</span>
                </div>
                <label class="block text-[0.75rem] font-medium text-[var(--color-text-secondary)] mb-1.5">
                  Room Size (seconds)
                </label>
                <input
                  type="number"
                  min="0.1"
                  max="3"
                  step="0.1"
                  value={reverbRoomSize()}
                  onInput={(e) => {
                    const val = e.currentTarget.value;
                    const num = parseFloat(val);
                    if (val === "" || (!isNaN(num) && num >= 0.1 && num <= 3)) {
                      setReverbRoomSize(val);
                    }
                  }}
                  class="w-full py-1.5 px-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-[var(--color-text)] text-[0.8125rem] focus:outline-none focus:border-[var(--color-primary)] mb-3"
                  autofocus
                />
                <label class="block text-[0.75rem] font-medium text-[var(--color-text-secondary)] mb-1.5">
                  Wet Level (0-1)
                </label>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.05"
                  value={reverbWetLevel()}
                  onInput={(e) => {
                    const val = e.currentTarget.value;
                    const num = parseFloat(val);
                    if (val === "" || (!isNaN(num) && num >= 0 && num <= 1)) {
                      setReverbWetLevel(val);
                    }
                  }}
                  class="w-full py-1.5 px-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-[var(--color-text)] text-[0.8125rem] focus:outline-none focus:border-[var(--color-primary)]"
                />
              </div>
              <div class="flex gap-2 p-2">
                <Tooltip label={`Apply reverb effect to ${getScopeLabel().toLowerCase()}`}>
                  <button
                    type="button"
                    class="flex-1 py-1.5 px-3 bg-[var(--color-primary)] text-white border-0 rounded text-[0.8125rem] font-medium cursor-pointer transition-all duration-150 hover:bg-[var(--color-primary-hover)]"
                    onClick={handleReverb}
                  >
                    Apply
                  </button>
                </Tooltip>
                <button
                  type="button"
                  class="py-1.5 px-4 bg-[var(--color-bg)] text-[var(--color-text)] border border-[var(--color-border)] rounded text-[0.8125rem] font-medium cursor-pointer transition-all duration-150 hover:bg-[var(--color-hover)]"
                  onClick={() => {
                    setShowReverbDialog(false);
                    requestAnimationFrame(updateMenuPosition);
                  }}
                >
                  Cancel
                </button>
              </div>
            </Show>
            <Show when={showDelayDialog()}>
              <div
                class="p-3 border-b border-[var(--color-border)]"
                onClick={(e) => e.stopPropagation()}
              >
                <div class="mb-2 px-1.5 py-1 bg-[var(--color-bg-secondary)] rounded text-[0.625rem] text-[var(--color-text-secondary)]">
                  Applying to: <span class="font-medium">{getScopeLabel()}</span>
                </div>
                <label class="block text-[0.75rem] font-medium text-[var(--color-text-secondary)] mb-1.5">
                  Delay Time (seconds)
                </label>
                <input
                  type="number"
                  min="0.01"
                  max="2"
                  step="0.01"
                  value={delayTime()}
                  onInput={(e) => {
                    const val = e.currentTarget.value;
                    const num = parseFloat(val);
                    if (val === "" || (!isNaN(num) && num >= 0.01 && num <= 2)) {
                      setDelayTime(val);
                    }
                  }}
                  class="w-full py-1.5 px-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-[var(--color-text)] text-[0.8125rem] focus:outline-none focus:border-[var(--color-primary)] mb-3"
                  autofocus
                />
                <label class="block text-[0.75rem] font-medium text-[var(--color-text-secondary)] mb-1.5">
                  Feedback (0-0.99)
                </label>
                <input
                  type="number"
                  min="0"
                  max="0.99"
                  step="0.05"
                  value={delayFeedback()}
                  onInput={(e) => {
                    const val = e.currentTarget.value;
                    const num = parseFloat(val);
                    if (val === "" || (!isNaN(num) && num >= 0 && num <= 0.99)) {
                      setDelayFeedback(val);
                    }
                  }}
                  class="w-full py-1.5 px-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-[var(--color-text)] text-[0.8125rem] focus:outline-none focus:border-[var(--color-primary)] mb-3"
                />
                <label class="block text-[0.75rem] font-medium text-[var(--color-text-secondary)] mb-1.5">
                  Wet Level (0-1)
                </label>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.05"
                  value={delayWetLevel()}
                  onInput={(e) => {
                    const val = e.currentTarget.value;
                    const num = parseFloat(val);
                    if (val === "" || (!isNaN(num) && num >= 0 && num <= 1)) {
                      setDelayWetLevel(val);
                    }
                  }}
                  class="w-full py-1.5 px-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-[var(--color-text)] text-[0.8125rem] focus:outline-none focus:border-[var(--color-primary)]"
                />
              </div>
              <div class="flex gap-2 p-2">
                <Tooltip label={`Apply delay effect to ${getScopeLabel().toLowerCase()}`}>
                  <button
                    type="button"
                    class="flex-1 py-1.5 px-3 bg-[var(--color-primary)] text-white border-0 rounded text-[0.8125rem] font-medium cursor-pointer transition-all duration-150 hover:bg-[var(--color-primary-hover)]"
                    onClick={handleDelay}
                  >
                    Apply
                  </button>
                </Tooltip>
                <button
                  type="button"
                  class="py-1.5 px-4 bg-[var(--color-bg)] text-[var(--color-text)] border border-[var(--color-border)] rounded text-[0.8125rem] font-medium cursor-pointer transition-all duration-150 hover:bg-[var(--color-hover)]"
                  onClick={() => {
                    setShowDelayDialog(false);
                    requestAnimationFrame(updateMenuPosition);
                  }}
                >
                  Cancel
                </button>
              </div>
            </Show>
            <Show when={showNoiseReductionDialog()}>
              <div
                class="p-3 border-b border-[var(--color-border)]"
                onClick={(e) => e.stopPropagation()}
              >
                <div class="mb-2 px-1.5 py-1 bg-[var(--color-bg-secondary)] rounded text-[0.625rem] text-[var(--color-text-secondary)]">
                  Applying to: <span class="font-medium">{getScopeLabel()}</span>
                </div>
                <label class="block text-[0.75rem] font-medium text-[var(--color-text-secondary)] mb-1.5">
                  Reduction Amount (0-1)
                </label>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.05"
                  value={noiseReductionAmount()}
                  onInput={(e) => {
                    const val = e.currentTarget.value;
                    const num = parseFloat(val);
                    if (val === "" || (!isNaN(num) && num >= 0 && num <= 1)) {
                      setNoiseReductionAmount(val);
                    }
                  }}
                  class="w-full py-1.5 px-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-[var(--color-text)] text-[0.8125rem] focus:outline-none focus:border-[var(--color-primary)]"
                  autofocus
                />
                <div class="mt-1.5 text-[0.75rem] text-[var(--color-text-secondary)]">
                  {(() => {
                    const reduction = parseFloat(noiseReductionAmount());
                    if (isNaN(reduction)) return "";
                    return `${(reduction * 100).toFixed(0)}% reduction`;
                  })()}
                </div>
              </div>
              <div class="flex gap-2 p-2">
                <Tooltip label={`Apply noise reduction to ${getScopeLabel().toLowerCase()}`}>
                  <button
                    type="button"
                    class="flex-1 py-1.5 px-3 bg-[var(--color-primary)] text-white border-0 rounded text-[0.8125rem] font-medium cursor-pointer transition-all duration-150 hover:bg-[var(--color-primary-hover)]"
                    onClick={handleNoiseReduction}
                  >
                    Apply
                  </button>
                </Tooltip>
                <button
                  type="button"
                  class="py-1.5 px-4 bg-[var(--color-bg)] text-[var(--color-text)] border border-[var(--color-border)] rounded text-[0.8125rem] font-medium cursor-pointer transition-all duration-150 hover:bg-[var(--color-hover)]"
                  onClick={() => {
                    setShowNoiseReductionDialog(false);
                    requestAnimationFrame(updateMenuPosition);
                  }}
                >
                  Cancel
                </button>
              </div>
            </Show>
            <Show when={showSpeedDialog()}>
              <div
                class="p-3 border-b border-[var(--color-border)]"
                onClick={(e) => e.stopPropagation()}
              >
                <div class="mb-2 px-1.5 py-1 bg-[var(--color-bg-secondary)] rounded text-[0.625rem] text-[var(--color-text-secondary)]">
                  Applying to: <span class="font-medium">{getScopeLabel()}</span>
                </div>
                <label class="block text-[0.75rem] font-medium text-[var(--color-text-secondary)] mb-1.5">
                  Speed Factor (0.25-4.0)
                </label>
                <input
                  type="number"
                  min="0.25"
                  max="4"
                  step="0.05"
                  value={speedFactor()}
                  onInput={(e) => {
                    const val = e.currentTarget.value;
                    const num = parseFloat(val);
                    if (val === "" || (!isNaN(num) && num >= 0.25 && num <= 4)) {
                      setSpeedFactor(val);
                    }
                  }}
                  class="w-full py-1.5 px-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-[var(--color-text)] text-[0.8125rem] focus:outline-none focus:border-[var(--color-primary)]"
                  autofocus
                />
                <div class="mt-1.5 text-[0.75rem] text-[var(--color-text-secondary)]">
                  {(() => {
                    const speed = parseFloat(speedFactor());
                    if (isNaN(speed)) return "";
                    const percent = ((speed - 1) * 100).toFixed(0);
                    if (speed === 1) return "Normal speed";
                    return speed > 1 ? `+${percent}% faster` : `${percent}% slower`;
                  })()}
                </div>
                <div class="mt-2 text-[0.625rem] text-[var(--color-text-secondary)]">
                  Note: This changes both speed and pitch
                </div>
              </div>
              <div class="flex gap-2 p-2">
                <Tooltip label={`Change speed for ${getScopeLabel().toLowerCase()}`}>
                  <button
                    type="button"
                    class="flex-1 py-1.5 px-3 bg-[var(--color-primary)] text-white border-0 rounded text-[0.8125rem] font-medium cursor-pointer transition-all duration-150 hover:bg-[var(--color-primary-hover)]"
                    onClick={handleChangeSpeed}
                  >
                    Apply
                  </button>
                </Tooltip>
                <button
                  type="button"
                  class="py-1.5 px-4 bg-[var(--color-bg)] text-[var(--color-text)] border border-[var(--color-border)] rounded text-[0.8125rem] font-medium cursor-pointer transition-all duration-150 hover:bg-[var(--color-hover)]"
                  onClick={() => {
                    setShowSpeedDialog(false);
                    requestAnimationFrame(updateMenuPosition);
                  }}
                >
                  Cancel
                </button>
              </div>
            </Show>
            <Show when={showPitchDialog()}>
              <div
                class="p-3 border-b border-[var(--color-border)]"
                onClick={(e) => e.stopPropagation()}
              >
                <div class="mb-2 px-1.5 py-1 bg-[var(--color-bg-secondary)] rounded text-[0.625rem] text-[var(--color-text-secondary)]">
                  Applying to: <span class="font-medium">{getScopeLabel()}</span>
                </div>
                <label class="block text-[0.75rem] font-medium text-[var(--color-text-secondary)] mb-1.5">
                  Pitch Factor (0.25-4.0)
                </label>
                <input
                  type="number"
                  min="0.25"
                  max="4"
                  step="0.05"
                  value={pitchFactor()}
                  onInput={(e) => {
                    const val = e.currentTarget.value;
                    const num = parseFloat(val);
                    if (val === "" || (!isNaN(num) && num >= 0.25 && num <= 4)) {
                      setPitchFactor(val);
                    }
                  }}
                  class="w-full py-1.5 px-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-[var(--color-text)] text-[0.8125rem] focus:outline-none focus:border-[var(--color-primary)]"
                  autofocus
                />
                <div class="mt-1.5 text-[0.75rem] text-[var(--color-text-secondary)]">
                  {(() => {
                    const pitch = parseFloat(pitchFactor());
                    if (isNaN(pitch)) return "";
                    const semitones = (12 * Math.log2(pitch)).toFixed(1);
                    if (pitch === 1) return "Normal pitch";
                    return pitch > 1 ? `+${semitones} semitones (higher)` : `${semitones} semitones (lower)`;
                  })()}
                </div>
                <div class="mt-2 text-[0.625rem] text-[var(--color-text-secondary)]">
                  Note: This changes pitch without changing speed/duration
                </div>
              </div>
              <div class="flex gap-2 p-2">
                <Tooltip label={`Change pitch for ${getScopeLabel().toLowerCase()}`}>
                  <button
                    type="button"
                    class="flex-1 py-1.5 px-3 bg-[var(--color-primary)] text-white border-0 rounded text-[0.8125rem] font-medium cursor-pointer transition-all duration-150 hover:bg-[var(--color-primary-hover)]"
                    onClick={handleChangePitch}
                  >
                    Apply
                  </button>
                </Tooltip>
                <button
                  type="button"
                  class="py-1.5 px-4 bg-[var(--color-bg)] text-[var(--color-text)] border border-[var(--color-border)] rounded text-[0.8125rem] font-medium cursor-pointer transition-all duration-150 hover:bg-[var(--color-hover)]"
                  onClick={() => {
                    setShowPitchDialog(false);
                    requestAnimationFrame(updateMenuPosition);
                  }}
                >
                  Cancel
                </button>
              </div>
            </Show>
            <Show when={showCompressorDialog()}>
              <div
                class="p-3 border-b border-[var(--color-border)]"
                onClick={(e) => e.stopPropagation()}
              >
                <div class="mb-2 px-1.5 py-1 bg-[var(--color-bg-secondary)] rounded text-[0.625rem] text-[var(--color-text-secondary)]">
                  Applying to: <span class="font-medium">{getScopeLabel()}</span>
                </div>
                <label class="block text-[0.75rem] font-medium text-[var(--color-text-secondary)] mb-1.5">
                  Threshold (dB, -60 to 0)
                </label>
                <input
                  type="number"
                  min="-60"
                  max="0"
                  step="1"
                  value={compressorThreshold()}
                  onInput={(e) => {
                    const val = e.currentTarget.value;
                    const num = parseFloat(val);
                    if (val === "" || (!isNaN(num) && num >= -60 && num <= 0)) {
                      setCompressorThreshold(val);
                    }
                  }}
                  class="w-full py-1.5 px-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-[var(--color-text)] text-[0.8125rem] focus:outline-none focus:border-[var(--color-primary)] mb-3"
                  autofocus
                />
                <label class="block text-[0.75rem] font-medium text-[var(--color-text-secondary)] mb-1.5">
                  Ratio (1-20)
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  step="0.1"
                  value={compressorRatio()}
                  onInput={(e) => {
                    const val = e.currentTarget.value;
                    const num = parseFloat(val);
                    if (val === "" || (!isNaN(num) && num >= 1 && num <= 20)) {
                      setCompressorRatio(val);
                    }
                  }}
                  class="w-full py-1.5 px-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-[var(--color-text)] text-[0.8125rem] focus:outline-none focus:border-[var(--color-primary)] mb-3"
                />
                <label class="block text-[0.75rem] font-medium text-[var(--color-text-secondary)] mb-1.5">
                  Attack (seconds, 0.0001-1)
                </label>
                <input
                  type="number"
                  min="0.0001"
                  max="1"
                  step="0.001"
                  value={compressorAttack()}
                  onInput={(e) => {
                    const val = e.currentTarget.value;
                    const num = parseFloat(val);
                    if (val === "" || (!isNaN(num) && num >= 0.0001 && num <= 1)) {
                      setCompressorAttack(val);
                    }
                  }}
                  class="w-full py-1.5 px-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-[var(--color-text)] text-[0.8125rem] focus:outline-none focus:border-[var(--color-primary)] mb-3"
                />
                <label class="block text-[0.75rem] font-medium text-[var(--color-text-secondary)] mb-1.5">
                  Release (seconds, 0.01-5)
                </label>
                <input
                  type="number"
                  min="0.01"
                  max="5"
                  step="0.01"
                  value={compressorRelease()}
                  onInput={(e) => {
                    const val = e.currentTarget.value;
                    const num = parseFloat(val);
                    if (val === "" || (!isNaN(num) && num >= 0.01 && num <= 5)) {
                      setCompressorRelease(val);
                    }
                  }}
                  class="w-full py-1.5 px-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-[var(--color-text)] text-[0.8125rem] focus:outline-none focus:border-[var(--color-primary)] mb-3"
                />
                <label class="block text-[0.75rem] font-medium text-[var(--color-text-secondary)] mb-1.5">
                  Knee (dB, 0-12)
                </label>
                <input
                  type="number"
                  min="0"
                  max="12"
                  step="0.1"
                  value={compressorKnee()}
                  onInput={(e) => {
                    const val = e.currentTarget.value;
                    const num = parseFloat(val);
                    if (val === "" || (!isNaN(num) && num >= 0 && num <= 12)) {
                      setCompressorKnee(val);
                    }
                  }}
                  class="w-full py-1.5 px-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-[var(--color-text)] text-[0.8125rem] focus:outline-none focus:border-[var(--color-primary)]"
                />
              </div>
              <div class="flex gap-2 p-2">
                <Tooltip label={`Apply compressor to ${getScopeLabel().toLowerCase()}`}>
                  <button
                    type="button"
                    class="flex-1 py-1.5 px-3 bg-[var(--color-primary)] text-white border-0 rounded text-[0.8125rem] font-medium cursor-pointer transition-all duration-150 hover:bg-[var(--color-primary-hover)]"
                    onClick={handleCompressor}
                  >
                    Apply
                  </button>
                </Tooltip>
                <button
                  type="button"
                  class="py-1.5 px-4 bg-[var(--color-bg)] text-[var(--color-text)] border border-[var(--color-border)] rounded text-[0.8125rem] font-medium cursor-pointer transition-all duration-150 hover:bg-[var(--color-hover)]"
                  onClick={() => {
                    setShowCompressorDialog(false);
                    requestAnimationFrame(updateMenuPosition);
                  }}
                >
                  Cancel
                </button>
              </div>
            </Show>
            <Show when={showLimiterDialog()}>
              <div
                class="p-3 border-b border-[var(--color-border)]"
                onClick={(e) => e.stopPropagation()}
              >
                <div class="mb-2 px-1.5 py-1 bg-[var(--color-bg-secondary)] rounded text-[0.625rem] text-[var(--color-text-secondary)]">
                  Applying to: <span class="font-medium">{getScopeLabel()}</span>
                </div>
                <label class="block text-[0.75rem] font-medium text-[var(--color-text-secondary)] mb-1.5">
                  Threshold (dB, -60 to 0)
                </label>
                <input
                  type="number"
                  min="-60"
                  max="0"
                  step="0.1"
                  value={limiterThreshold()}
                  onInput={(e) => {
                    const val = e.currentTarget.value;
                    const num = parseFloat(val);
                    if (val === "" || (!isNaN(num) && num >= -60 && num <= 0)) {
                      setLimiterThreshold(val);
                    }
                  }}
                  class="w-full py-1.5 px-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-[var(--color-text)] text-[0.8125rem] focus:outline-none focus:border-[var(--color-primary)] mb-3"
                  autofocus
                />
                <label class="block text-[0.75rem] font-medium text-[var(--color-text-secondary)] mb-1.5">
                  Release (seconds, 0.001-1)
                </label>
                <input
                  type="number"
                  min="0.001"
                  max="1"
                  step="0.001"
                  value={limiterRelease()}
                  onInput={(e) => {
                    const val = e.currentTarget.value;
                    const num = parseFloat(val);
                    if (val === "" || (!isNaN(num) && num >= 0.001 && num <= 1)) {
                      setLimiterRelease(val);
                    }
                  }}
                  class="w-full py-1.5 px-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-[var(--color-text)] text-[0.8125rem] focus:outline-none focus:border-[var(--color-primary)]"
                />
                <div class="mt-2 text-[0.625rem] text-[var(--color-text-secondary)]">
                  Note: A limiter prevents audio from exceeding the threshold level
                </div>
              </div>
              <div class="flex gap-2 p-2">
                <Tooltip label={`Apply limiter to ${getScopeLabel().toLowerCase()}`}>
                  <button
                    type="button"
                    class="flex-1 py-1.5 px-3 bg-[var(--color-primary)] text-white border-0 rounded text-[0.8125rem] font-medium cursor-pointer transition-all duration-150 hover:bg-[var(--color-primary-hover)]"
                    onClick={handleLimiter}
                  >
                    Apply
                  </button>
                </Tooltip>
                <button
                  type="button"
                  class="py-1.5 px-4 bg-[var(--color-bg)] text-[var(--color-text)] border border-[var(--color-border)] rounded text-[0.8125rem] font-medium cursor-pointer transition-all duration-150 hover:bg-[var(--color-hover)]"
                  onClick={() => {
                    setShowLimiterDialog(false);
                    requestAnimationFrame(updateMenuPosition);
                  }}
                >
                  Cancel
                </button>
              </div>
            </Show>
          </div>
        </Portal>
      </Show>
    </div>
  );
};
