import { Component, JSX } from "solid-js";
import { Tooltip } from "./Tooltip";

interface ButtonProps {
  icon: JSX.Element | (() => JSX.Element);
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
  classList?: Record<string, boolean>;
}

export const Button: Component<ButtonProps> = (props) => {
  return (
    <Tooltip label={props.label}>
      <button
        onClick={props.onClick}
        disabled={props.disabled}
        class="flex items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text)] cursor-pointer transition-all duration-200 p-0 hover:bg-[var(--color-hover)] hover:border-[var(--color-border-hover)] hover:-translate-y-px active:bg-[var(--color-active)] active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[var(--color-bg-elevated)] disabled:hover:border-[var(--color-border)] disabled:hover:translate-y-0 w-8 h-8 sm:w-9 sm:h-9"
        classList={{
          "bg-[var(--color-primary)] text-white border-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] hover:border-[var(--color-primary-hover)]":
            !props.variant || props.variant === "primary",
          "bg-[var(--color-bg)] text-[var(--color-text)]": props.variant === "secondary",
          "bg-[var(--color-bg-elevated)] text-[var(--color-recording)] border-[var(--color-recording)] hover:bg-[rgba(248,81,73,0.1)] hover:border-[var(--color-recording)] active:bg-[rgba(248,81,73,0.15)]":
            props.variant === "danger",
          ...props.classList,
        }}
        aria-label={props.label}
      >
        <span class="flex items-center justify-center w-full h-full [&_svg]:text-inherit">
          {typeof props.icon === "function" ? props.icon() : props.icon}
        </span>
      </button>
    </Tooltip>
  );
};
