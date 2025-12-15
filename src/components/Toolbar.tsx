import { Component, Show } from "solid-js";
import { Button } from "./Button";
import { PlaybackControls } from "./PlaybackControls";
import { ZoomControls } from "./ZoomControls";
import { EffectsMenu } from "./EffectsMenu";
import { ExportMenu } from "./ExportMenu";
import { Tooltip } from "./Tooltip";
import { useAudioStore } from "../stores/audioStore";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import { formatTime } from "../utils/time";

interface ToolbarProps {
  waveform?: ReturnType<typeof import("../hooks/useWaveform").useWaveform>;
  onImportClick: () => void;
  onExport: (format: "wav" | "mp3" | "ogg", quality: string) => void;
  onReset: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onRecordClick: () => void;
  canUndo: boolean;
  canRedo: boolean;
  isExporting: boolean;
  hasSelection: boolean;
  recorder: ReturnType<typeof useAudioRecorder>;
  onPlayAll?: () => void;
  onPauseAll?: () => void;
  onStopAll?: () => void;
  onSeekAll?: (normalizedPosition: number) => void;
  onNormalize: (scope: "all" | "track" | "selection") => void;
  onAmplify: (gain: number, scope: "all" | "track" | "selection") => void;
  onSilence: (scope: "all" | "track" | "selection") => void;
  onReverse: (scope: "all" | "track" | "selection") => void;
  onFadeIn: (scope: "all" | "track" | "selection") => void;
  onFadeOut: (scope: "all" | "track" | "selection") => void;
  onReverb: (roomSize: number, wetLevel: number, scope: "all" | "track" | "selection") => void;
  onDelay: (
    delayTime: number,
    feedback: number,
    wetLevel: number,
    scope: "all" | "track" | "selection"
  ) => void;
  onNoiseReduction: (reductionAmount: number, scope: "all" | "track" | "selection") => void;
  onChangeSpeed: (speedFactor: number, scope: "all" | "track" | "selection") => void;
  onChangePitch: (pitchFactor: number, scope: "all" | "track" | "selection") => void;
  onCompressor: (
    threshold: number,
    ratio: number,
    attack: number,
    release: number,
    knee: number,
    scope: "all" | "track" | "selection"
  ) => void;
  onLimiter: (threshold: number, release: number, scope: "all" | "track" | "selection") => void;
  onEq: (frequency: number, gain: number, q: number, scope: "all" | "track" | "selection") => void;
  onHighPassFilter: (cutoffFrequency: number, scope: "all" | "track" | "selection") => void;
  onLowPassFilter: (cutoffFrequency: number, scope: "all" | "track" | "selection") => void;
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDelete: () => void;
  onSplit?: () => void;
  onHelpClick?: () => void;
  onSaveProject?: () => void;
  onLoadProject?: () => void;
}

export const Toolbar: Component<ToolbarProps> = (props) => {
  const { getCurrentTrack, store } = useAudioStore();

  const hasSelection = () => store.selection !== null;
  const hasClipboard = () => store.clipboard !== null;

  const Separator = () => (
    <div class="hidden md:block h-6 w-px bg-[var(--color-border)] flex-shrink-0"></div>
  );

  return (
    <div class="fixed bottom-0 left-0 right-0 z-[100] p-1 sm:p-1.5 md:p-2 lg:p-3 pointer-events-none">
      <div class="flex flex-row items-center justify-start sm:justify-center gap-1 sm:gap-1.5 md:gap-2 overflow-x-auto overflow-y-visible [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap max-w-[1200px] mx-auto p-1.5 sm:p-2 md:p-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg pointer-events-auto backdrop-blur-[10px] shadow-lg">
        <div class="flex items-center gap-1 sm:gap-1.5 md:gap-2 flex-shrink-0">
          <Button
            icon={
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
                <path d="M3 7v6h6" />
                <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
              </svg>
            }
            label="Undo"
            onClick={props.onUndo}
            disabled={!props.canUndo}
            variant="secondary"
          />
          <Button
            icon={
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
                <path d="M21 7v6h-6" />
                <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" />
              </svg>
            }
            label="Redo"
            onClick={props.onRedo}
            disabled={!props.canRedo}
            variant="secondary"
          />
        </div>

        <Separator />

        <div class="flex items-center gap-1 sm:gap-1.5 md:gap-2 flex-shrink-0">
          <Button
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9.64 7.64c.23-.5.36-1.05.36-1.64 0-2.21-1.79-4-4-4S2 3.79 2 6s1.79 4 4 4c.59 0 1.14-.13 1.64-.36L10 12l-2.36 2.36C7.14 14.13 6.59 14 6 14c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4c0-.59-.13-1.14-.36-1.64L12 14l7 7h3v-1L9.64 7.64zM6 8c-1.1 0-2-.89-2-2s.9-2 2-2 2 .89 2 2-.9 2-2 2zm0 12c-1.1 0-2-.89-2-2s.9-2 2-2 2 .89 2 2-.9 2-2 2zm6-7.5c-.28 0-.5-.22-.5-.5s.22-.5.5-.5.5.22.5.5-.22.5-.5.5zM19 3l-6 6 2 2 7-7V3h-3z" />
              </svg>
            }
            label="Cut"
            onClick={props.onCut}
            disabled={!hasSelection()}
            variant="secondary"
          />
          <Button
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
              </svg>
            }
            label="Copy"
            onClick={props.onCopy}
            disabled={!hasSelection()}
            variant="secondary"
          />
          <Button
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 2h-4.18C14.4.84 13.3 0 12 0c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm7 18H5V4h2v3h10V4h2v16z" />
              </svg>
            }
            label="Paste"
            onClick={props.onPaste}
            disabled={!hasClipboard()}
            variant="secondary"
          />
          <Button
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
              </svg>
            }
            label="Delete"
            onClick={props.onDelete}
            disabled={!hasSelection()}
            variant="secondary"
          />
          <Show when={props.onSplit}>
            <Button
              icon={
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M12 3v18M3 12h18" />
                </svg>
              }
              label="Split Track"
              onClick={props.onSplit!}
              disabled={!getCurrentTrack()?.audioBuffer}
              variant="secondary"
            />
          </Show>
        </div>

        <Separator />

        <div class="flex items-center gap-1 sm:gap-1.5 md:gap-2 flex-1 min-w-0 w-full sm:w-auto justify-center flex-shrink-0">
          <Tooltip label={props.recorder.isRecording() ? "Stop Recording" : "Start Recording"}>
            <button
              onClick={props.onRecordClick}
              class="relative flex items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text)] cursor-pointer transition-all duration-200 p-0 hover:bg-[var(--color-hover)] hover:border-[var(--color-border-hover)] hover:-translate-y-px active:translate-y-0 w-8 h-8 sm:w-9 sm:h-9"
              classList={{
                "text-[var(--color-recording)] border-[var(--color-recording)] hover:bg-[rgba(248,81,73,0.1)] hover:border-[var(--color-recording)] active:bg-[rgba(248,81,73,0.15)]":
                  props.recorder.isRecording(),
              }}
              aria-label={props.recorder.isRecording() ? "Stop Recording" : "Start Recording"}
            >
              <Show when={props.recorder.isRecording()}>
                <span class="absolute top-0 right-0 w-2 h-2 bg-[var(--color-recording)] rounded-full animate-ping"></span>
                <span class="absolute top-0 right-0 w-2 h-2 bg-[var(--color-recording)] rounded-full"></span>
              </Show>
              <span class="relative inline-flex items-center justify-center w-full h-full [&_svg]:text-inherit">
                <Show
                  when={props.recorder.isRecording()}
                  fallback={
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
                    </svg>
                  }
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                </Show>
              </span>
            </button>
          </Tooltip>
          <Show when={props.recorder.isRecording()}>
            <span class="text-[var(--color-recording)] text-xs sm:text-sm font-medium tabular-nums whitespace-nowrap">
              {formatTime(props.recorder.recordingDuration())}
            </span>
          </Show>
          <PlaybackControls
            waveform={props.waveform}
            onPlayAll={props.onPlayAll}
            onPauseAll={props.onPauseAll}
            onStopAll={props.onStopAll}
            onSeekAll={props.onSeekAll}
          />
        </div>

        <Separator />

        <div class="hidden md:flex items-center gap-1 sm:gap-1.5 md:gap-2">
          <ZoomControls />
        </div>

        <Separator />

        <div class="flex items-center gap-1 sm:gap-1.5 md:gap-2 flex-shrink-0">
          <EffectsMenu
            onNormalize={props.onNormalize}
            onAmplify={props.onAmplify}
            onSilence={props.onSilence}
            onReverse={props.onReverse}
            onFadeIn={props.onFadeIn}
            onFadeOut={props.onFadeOut}
            onReverb={props.onReverb}
            onDelay={props.onDelay}
            onNoiseReduction={props.onNoiseReduction}
            onChangeSpeed={props.onChangeSpeed}
            onChangePitch={props.onChangePitch}
            onCompressor={props.onCompressor}
            onLimiter={props.onLimiter}
            onEq={props.onEq}
            onHighPassFilter={props.onHighPassFilter}
            onLowPassFilter={props.onLowPassFilter}
            disabled={props.isExporting || !getCurrentTrack()}
          />
        </div>

        <Separator />

        <div class="flex items-center gap-1 sm:gap-1.5 md:gap-2 flex-shrink-0">
          <Show when={props.onSaveProject}>
            <Button
              icon={
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
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
              }
              label="Save Project"
              onClick={props.onSaveProject!}
              variant="secondary"
              disabled={store.tracks.length === 0 || !store.projectName?.trim()}
            />
          </Show>
          <Show when={props.onLoadProject}>
            <Button
              icon={
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
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              }
              label="Load Project"
              onClick={props.onLoadProject!}
              variant="secondary"
            />
          </Show>
          <ExportMenu
            onExport={props.onExport}
            disabled={!getCurrentTrack()}
            isExporting={props.isExporting}
          />
          <Button
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z" />
              </svg>
            }
            label="Import Audio"
            onClick={props.onImportClick}
            variant="secondary"
          />
        </div>

        <Separator />

        <div class="hidden sm:flex items-center gap-1 sm:gap-1.5 md:gap-2">
          <Button
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
              </svg>
            }
            label="Clear All Tracks"
            onClick={props.onReset}
            variant="danger"
            disabled={store.tracks.length === 0}
          />
        </div>

        <Show when={props.onHelpClick}>
          <Separator />
          <div class="hidden md:flex items-center gap-1 sm:gap-1.5 md:gap-2">
            <Button
              icon={
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
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              }
              label="Help"
              onClick={props.onHelpClick!}
              variant="secondary"
            />
          </div>
        </Show>
      </div>
    </div>
  );
};
