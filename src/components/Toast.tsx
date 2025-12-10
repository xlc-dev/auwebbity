import { Component, Show, onMount } from "solid-js";

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
    <div class={`toast toast--${props.type || "error"}`}>
      <div class="toast__content">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" class="toast__icon">
          {props.type === "success" ? (
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          ) : props.type === "info" ? (
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
          ) : (
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
          )}
        </svg>
        <span class="toast__message">{props.message}</span>
        <button class="toast__close" onClick={props.onDismiss} aria-label="Dismiss">
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
    <div class="toast-container">
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
