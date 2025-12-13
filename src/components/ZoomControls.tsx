import { Component } from "solid-js";
import { useAudioStore } from "../stores/audioStore";
import { Button } from "./Button";

export const ZoomControls: Component = () => {
  const { zoomIn, zoomOut, resetZoom } = useAudioStore();

  return (
    <div class="flex gap-1 sm:gap-1.5 md:gap-2">
      <Button
        icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
          </svg>
        }
        label="Zoom In"
        onClick={zoomIn}
        variant="secondary"
      />
      <Button
        icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 13H5v-2h14v2z" />
          </svg>
        }
        label="Zoom Out"
        onClick={zoomOut}
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
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
            <path d="M8 11h6" />
            <path d="M11 8l-3 3 3 3" />
          </svg>
        }
        label="Reset Zoom"
        onClick={resetZoom}
        variant="secondary"
      />
    </div>
  );
};
