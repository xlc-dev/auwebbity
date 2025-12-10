import { Component, Show, createMemo } from "solid-js";
import { Button } from "./Button";
import { PlaybackControls } from "./PlaybackControls";
import { ZoomControls } from "./ZoomControls";
import { Dropdown } from "./Dropdown";
import { useAudioStore } from "../stores/audioStore";
import { useAudioRecorder } from "../hooks/useAudioRecorder";

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
}

export const Toolbar: Component<ToolbarProps> = (props) => {
  const { getCurrentTrack, store } = useAudioStore();
  const recorder = useAudioRecorder();

  const isRecording = () => recorder.isRecording();

  const recordingIcon = createMemo(() => {
    if (isRecording()) {
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" class="text-white">
          <rect x="6" y="6" width="12" height="12" rx="2" />
        </svg>
      );
    }
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
      </svg>
    );
  });

  return (
    <div class="fixed bottom-0 left-0 right-0 z-[100] p-1.5 sm:p-2 md:p-3 lg:p-4 pointer-events-none">
      <div class="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 md:gap-4 lg:gap-6 max-w-[1200px] mx-auto py-2 sm:py-2.5 px-2 sm:px-3 md:px-5 lg:px-7 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg sm:rounded-xl pointer-events-auto backdrop-blur-[10px] relative">
        <div class="flex items-center gap-1 sm:gap-1.5 md:gap-2 flex-wrap justify-center">
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
          <Show when={isRecording()}>
            <div class="inline-flex items-center gap-1 sm:gap-1.5 py-1 sm:py-1.5 md:py-2 px-1.5 sm:px-2 md:px-3.5 bg-[var(--color-recording)] text-white rounded-md text-[0.625rem] sm:text-xs md:text-[0.8125rem] font-semibold">
              <span class="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white rounded-full animate-pulse"></span>
              <span class="hidden sm:inline">Recording</span>
            </div>
          </Show>
          <div class="relative">
            <Button
              icon={() => recordingIcon()}
              label={isRecording() ? "Stop Recording" : "Start Recording"}
              onClick={props.onRecordClick}
              variant={isRecording() ? "danger" : "secondary"}
              classList={{
                "!bg-[var(--color-recording)] !text-white !border-[var(--color-recording)] hover:!bg-[rgba(248,81,73,0.9)] hover:!border-[var(--color-recording)]":
                  isRecording(),
              }}
            />
            <Show when={isRecording()}>
              <span class="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full animate-pulse ring-2 ring-[var(--color-recording)]"></span>
            </Show>
          </div>
        </div>
        <div class="flex items-center justify-center flex-1 min-w-0 w-full sm:w-auto order-3 sm:order-2">
          <PlaybackControls waveform={props.waveform} />
        </div>
        <div class="flex items-center gap-1 sm:gap-1.5 flex-wrap justify-center order-2 sm:order-3">
          <ZoomControls />
          <div class="flex items-center gap-1 sm:gap-1.5">
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
            <Button
              icon={
                props.isExporting ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
                  </svg>
                )
              }
              label={props.isExporting ? "Exporting..." : "Export Audio"}
              onClick={props.onExport}
              disabled={!getCurrentTrack() || props.isExporting}
              variant="secondary"
            />
          </div>
          <Button
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
              </svg>
            }
            label="Delete All"
            onClick={props.onReset}
            variant="danger"
            disabled={store.tracks.length === 0}
          />
        </div>
      </div>
    </div>
  );
};
