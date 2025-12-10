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
      <div class="confirmation-dialog-overlay" onClick={props.onCancel}>
        <div
          ref={dialogRef}
          class="confirmation-dialog"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirmation-dialog-title"
          aria-describedby="confirmation-dialog-message"
        >
          <div class="confirmation-dialog__header">
            <h3 id="confirmation-dialog-title" class="confirmation-dialog__title">
              {props.title}
            </h3>
          </div>
          <div class="confirmation-dialog__body">
            <p id="confirmation-dialog-message" class="confirmation-dialog__message">
              {props.message}
            </p>
          </div>
          <div class="confirmation-dialog__footer">
            <button
              ref={cancelButtonRef}
              class="confirmation-dialog__button confirmation-dialog__button--cancel"
              onClick={props.onCancel}
            >
              {props.cancelLabel || "Cancel"}
            </button>
            <button
              class="confirmation-dialog__button confirmation-dialog__button--confirm"
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
