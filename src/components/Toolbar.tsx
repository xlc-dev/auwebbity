import { Component, Show } from "solid-js";
import { Button } from "./Button";
import { PlaybackControls } from "./PlaybackControls";
import { ZoomControls } from "./ZoomControls";
import { Dropdown } from "./Dropdown";
import { EffectsMenu } from "./EffectsMenu";
import { Tooltip } from "./Tooltip";
import { useAudioStore } from "../stores/audioStore";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import { formatTime } from "../utils/timeUtils";

interface ToolbarProps {
  waveform?: ReturnType<typeof import("../hooks/useWaveform").useWaveform>;
  onImportClick: () => void;
  onExport: () => void;
  onReset: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onRecordClick: () => void;
  canUndo: boolean;
  canRedo: boolean;
  exportFormat: "wav" | "mp3" | "ogg";
  setExportFormat: (format: "wav" | "mp3" | "ogg") => void;
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
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDelete: () => void;
  onHelpClick?: () => void;
}

export const Toolbar: Component<ToolbarProps> = (props) => {
  const { getCurrentTrack, store } = useAudioStore();
  const hasProjectName = () => !!store.projectName?.trim();

  const hasSelection = () => store.selection !== null;
  const hasClipboard = () => store.clipboard !== null;

  const Separator = () => <div class="hidden sm:block h-6 w-px bg-[var(--color-border)]"></div>;

  return (
    <div class="fixed bottom-0 left-0 right-0 z-[100] p-1.5 sm:p-2 md:p-3 pointer-events-none">
      <div class="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 flex-wrap max-w-[1200px] mx-auto p-2 sm:p-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg pointer-events-auto backdrop-blur-[10px]">
        <div class="flex items-center gap-1.5 sm:gap-2">
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

        <div class="flex items-center gap-1.5 sm:gap-2">
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
        </div>

        <Separator />

        <div class="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0 w-full sm:w-auto justify-center">
          <Tooltip label={props.recorder.isRecording() ? "Stop Recording" : "Start Recording"}>
            <button
              onClick={props.onRecordClick}
              class="relative flex items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text)] cursor-pointer transition-all duration-200 p-0 hover:bg-[var(--color-hover)] hover:border-[var(--color-border-hover)] hover:-translate-y-px active:translate-y-0 w-9 h-9"
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
            <span class="text-[var(--color-recording)] text-xs sm:text-sm font-medium tabular-nums">
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

        <div class="flex items-center gap-1.5 sm:gap-2">
          <ZoomControls />
        </div>

        <Separator />

        <div class="flex items-center gap-1.5 sm:gap-2">
          <EffectsMenu
            onNormalize={props.onNormalize}
            onAmplify={props.onAmplify}
            onSilence={props.onSilence}
            onReverse={props.onReverse}
            onFadeIn={props.onFadeIn}
            onFadeOut={props.onFadeOut}
            disabled={props.isExporting || !getCurrentTrack()}
          />
        </div>

        <Separator />

        <div class="flex items-center gap-1.5 sm:gap-2">
          <Dropdown
            options={[
              { value: "wav", label: "WAV" },
              { value: "mp3", label: "MP3" },
              { value: "ogg", label: "OGG" },
            ]}
            value={props.exportFormat}
            onChange={(value) => props.setExportFormat(value as "wav" | "mp3" | "ogg")}
            disabled={props.isExporting || !getCurrentTrack()}
          />
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
              onClick={props.onExport}
              disabled={!getCurrentTrack() || props.isExporting || !hasProjectName()}
              class="flex items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text)] cursor-pointer transition-all duration-200 p-0 hover:bg-[var(--color-hover)] hover:border-[var(--color-border-hover)] hover:-translate-y-px active:bg-[var(--color-active)] active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[var(--color-bg-elevated)] disabled:hover:border-[var(--color-border)] disabled:hover:translate-y-0 w-8 h-8 sm:w-9 sm:h-9"
              aria-label={
                !hasProjectName()
                  ? "Enter a project name to export"
                  : props.isExporting
                    ? "Exporting..."
                    : "Export Audio"
              }
            >
              <span class="flex items-center justify-center w-full h-full [&_svg]:text-inherit">
                {props.isExporting ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
                  </svg>
                )}
              </span>
            </button>
          </Tooltip>
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

        <div class="flex items-center gap-1.5 sm:gap-2">
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
          <div class="flex items-center gap-1.5 sm:gap-2">
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
