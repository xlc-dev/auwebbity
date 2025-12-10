import { Component, Show, onMount, onCleanup } from "solid-js";

interface ConfirmationDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationDialog: Component<ConfirmationDialogProps> = (props) => {
  let dialogRef: HTMLDivElement | undefined;
  let cancelButtonRef: HTMLButtonElement | undefined;

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!props.isOpen) return;

    if (e.key === "Escape") {
      e.preventDefault();
      props.onCancel();
    } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      props.onConfirm();
    }
  };

  onMount(() => {
    window.addEventListener("keydown", handleKeyDown);
    if (props.isOpen && cancelButtonRef) {
      cancelButtonRef.focus();
    }
  });

  onCleanup(() => {
    window.removeEventListener("keydown", handleKeyDown);
  });

  return (
    <Show when={props.isOpen}>
      <div
        class="fixed inset-0 flex items-center justify-center backdrop-blur-sm bg-black/60 z-[2000] animate-[fadeIn_0.15s_ease-out] p-4"
        onClick={props.onCancel}
      >
        <div
          ref={dialogRef}
          class="bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-xl max-w-[500px] w-full animate-[dialogSlideUp_0.2s_cubic-bezier(0.4,0,0.2,1)] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirmation-dialog-title"
          aria-describedby="confirmation-dialog-message"
        >
          <div class="py-5 px-6 border-b border-[var(--color-border)]">
            <h3
              id="confirmation-dialog-title"
              class="text-lg font-semibold text-[var(--color-text)] m-0"
            >
              {props.title}
            </h3>
          </div>
          <div class="p-6">
            <p
              id="confirmation-dialog-message"
              class="text-[0.9375rem] leading-relaxed text-[var(--color-text-secondary)] m-0"
            >
              {props.message}
            </p>
          </div>
          <div class="flex gap-3 justify-end py-4 px-6 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
            <button
              ref={cancelButtonRef}
              class="py-2 px-4 rounded-md text-sm font-medium cursor-pointer transition-all duration-200 border border-[var(--color-border)] font-inherit min-w-[80px] bg-[var(--color-bg-elevated)] text-[var(--color-text)] hover:bg-[var(--color-hover)] hover:border-[var(--color-border-hover)] active:scale-[0.98] focus:outline-none"
              onClick={props.onCancel}
            >
              {props.cancelLabel || "Cancel"}
            </button>
            <button
              class="py-2 px-4 rounded-md text-sm font-medium cursor-pointer transition-all duration-200 border border-[var(--color-primary)] font-inherit min-w-[80px] bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] hover:border-[var(--color-primary-hover)] active:scale-[0.98] focus:outline-none"
              onClick={props.onConfirm}
            >
              {props.confirmLabel || "Confirm"}
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
};
