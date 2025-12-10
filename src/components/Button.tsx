import { Component, JSX, onMount, onCleanup } from "solid-js";

interface ButtonProps {
  icon: JSX.Element | (() => JSX.Element);
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
  classList?: Record<string, boolean>;
}

export const Button: Component<ButtonProps> = (props) => {
  let buttonRef: HTMLButtonElement | undefined;
  let tooltipRef: HTMLSpanElement | undefined;

  const adjustTooltipPosition = () => {
    if (!buttonRef || !tooltipRef) return;

    const buttonRect = buttonRef.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const margin = 16;

    const originalVisibility = tooltipRef.style.visibility;
    tooltipRef.style.visibility = "hidden";
    tooltipRef.style.display = "block";
    const tooltipWidth = tooltipRef.offsetWidth;
    tooltipRef.style.display = "";
    tooltipRef.style.visibility = originalVisibility;

    const buttonCenterX = buttonRect.left + buttonRect.width / 2;
    const tooltipLeft = buttonCenterX - tooltipWidth / 2;

    if (tooltipLeft < margin) {
      tooltipRef.style.left = `${margin - buttonRect.left}px`;
      tooltipRef.style.right = "";
      tooltipRef.style.transform = "translateY(-2px)";
    } else if (tooltipLeft + tooltipWidth > viewportWidth - margin) {
      tooltipRef.style.right = `${viewportWidth - buttonRect.right - margin}px`;
      tooltipRef.style.left = "auto";
      tooltipRef.style.transform = "translateY(-2px)";
    } else {
      tooltipRef.style.left = "";
      tooltipRef.style.right = "";
      tooltipRef.style.transform = "";
    }
  };

  const handleMouseEnter = () => {
    requestAnimationFrame(adjustTooltipPosition);
  };

  onMount(() => {
    if (buttonRef) {
      buttonRef.addEventListener("mouseenter", handleMouseEnter);
      window.addEventListener("resize", adjustTooltipPosition);
    }
  });

  onCleanup(() => {
    if (buttonRef) {
      buttonRef.removeEventListener("mouseenter", handleMouseEnter);
      window.removeEventListener("resize", adjustTooltipPosition);
    }
  });

  return (
    <button
      ref={buttonRef}
      onClick={props.onClick}
      disabled={props.disabled}
      class="group relative flex items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text)] cursor-pointer transition-all duration-200 p-0 overflow-visible hover:bg-[var(--color-hover)] hover:border-[var(--color-border-hover)] hover:-translate-y-px active:bg-[var(--color-active)] active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[var(--color-bg-elevated)] disabled:hover:border-[var(--color-border)] disabled:hover:translate-y-0 w-8 h-8 sm:w-9 sm:h-9"
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
      <span
        ref={tooltipRef}
        class="absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 py-1 sm:py-1.5 px-2 sm:px-2.5 bg-[var(--color-dark)] text-white text-[0.625rem] sm:text-xs font-medium whitespace-nowrap rounded opacity-0 pointer-events-none transition-[opacity,transform] duration-150 z-[1000] max-w-[calc(100vw-2rem)] overflow-hidden text-ellipsis [&::after]:content-[''] [&::after]:absolute [&::after]:top-full [&::after]:left-1/2 [&::after]:-translate-x-1/2 [&::after]:border-4 [&::after]:border-transparent [&::after]:border-t-[var(--color-dark)] group-hover:opacity-100 group-hover:-translate-y-0.5"
      >
        {props.label}
      </span>
    </button>
  );
};
