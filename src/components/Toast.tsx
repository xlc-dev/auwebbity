import { Component, onMount } from "solid-js";

interface ToastProps {
  message: string;
  type?: "error" | "success" | "info";
  onDismiss: () => void;
  duration?: number;
}

export const Toast: Component<ToastProps> = (props) => {
  const duration = () => props.duration ?? 5000;

  onMount(() => {
    const timer = setTimeout(() => {
      props.onDismiss();
    }, duration());

    return () => clearTimeout(timer);
  });

  return (
    <div
      class="bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg py-3.5 px-4 animate-[toastSlideIn_0.3s_ease-out] min-w-[300px]"
      classList={{
        "border-l-4 border-l-[#f85149]": props.type === "error" || !props.type,
        "border-l-4 border-l-[#3fb950]": props.type === "success",
        "border-l-4 border-l-[var(--color-primary)]": props.type === "info",
      }}
    >
      <div class="flex items-center gap-3">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="currentColor"
          class="flex-shrink-0"
          classList={{
            "text-[#f85149]": props.type === "error" || !props.type,
            "text-[#3fb950]": props.type === "success",
            "text-[var(--color-primary)]": props.type === "info",
          }}
        >
          {props.type === "success" ? (
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          ) : props.type === "info" ? (
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
          ) : (
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
          )}
        </svg>
        <span class="flex-1 text-sm text-[var(--color-text)] leading-snug">{props.message}</span>
        <button
          class="flex-shrink-0 bg-none border-0 text-[var(--color-text-secondary)] cursor-pointer p-1 flex items-center justify-center rounded transition-all duration-150 hover:bg-[var(--color-border)] hover:text-[var(--color-text)]"
          onClick={props.onDismiss}
          aria-label="Dismiss"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        </button>
      </div>
    </div>
  );
};

interface ToastContainerProps {
  toasts: Array<{ id: string; message: string; type?: "error" | "success" | "info" }>;
  onDismiss: (id: string) => void;
}

export const ToastContainer: Component<ToastContainerProps> = (props) => {
  return (
    <div class="fixed bottom-4 right-4 z-[1000] flex flex-col gap-2 max-w-[400px]">
      {props.toasts.map((toast) => (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => props.onDismiss(toast.id)}
        />
      ))}
    </div>
  );
};
