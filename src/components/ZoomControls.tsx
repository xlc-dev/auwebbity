import { Component } from "solid-js";
import { useAudioStore } from "../stores/audioStore";
import { FloatingButton } from "./FloatingButton";

export const ZoomControls: Component = () => {
  const { zoomIn, zoomOut, resetZoom } = useAudioStore();

  return (
    <div class="zoom-controls">
      <FloatingButton
        icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
          </svg>
        }
        label="Zoom In"
        onClick={zoomIn}
        variant="secondary"
      />
      <FloatingButton
        icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 13H5v-2h14v2z" />
          </svg>
        }
        label="Zoom Out"
        onClick={zoomOut}
        variant="secondary"
      />
      <FloatingButton
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
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
            <path d="M3 21v-5h5" />
          </svg>
        }
        label="Reset Zoom"
        onClick={resetZoom}
        variant="secondary"
      />
    </div>
  );
};
