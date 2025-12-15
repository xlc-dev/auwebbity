import { Component } from "solid-js";

export const MobileBlocker: Component = () => {
  return (
    <div class="fixed inset-0 z-[9999] bg-[var(--color-bg)] flex items-center justify-center p-8">
      <div class="max-w-md text-center">
        <div class="mb-6">
          <svg
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="mx-auto text-[var(--color-text-secondary)]"
          >
            <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
            <line x1="12" y1="18" x2="12.01" y2="18" />
          </svg>
        </div>
        <h1 class="text-2xl font-bold text-[var(--color-text)] mb-4">Mobile Not Supported</h1>
        <p class="text-[var(--color-text-secondary)]">
          This app isn't supported for mobile devices. Please access this application from a desktop
          or laptop computer.
        </p>
      </div>
    </div>
  );
};
