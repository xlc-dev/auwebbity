import { Component, JSX, onMount, onCleanup } from "solid-js";

interface FloatingButtonProps {
  icon: JSX.Element;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
  classList?: Record<string, boolean>;
}

export const FloatingButton: Component<FloatingButtonProps> = (props) => {
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

    tooltipRef.style.left = "";
    tooltipRef.style.right = "";

    if (tooltipLeft < margin) {
      tooltipRef.style.left = `${margin}px`;
      tooltipRef.style.transform = "translateY(-2px)";
    } else if (tooltipLeft + tooltipWidth > viewportWidth - margin) {
      tooltipRef.style.right = `${margin}px`;
      tooltipRef.style.left = "auto";
      tooltipRef.style.transform = "translateY(-2px)";
    } else {
      tooltipRef.style.left = "50%";
      tooltipRef.style.transform = "translateX(-50%) translateY(-2px)";
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
      class="group relative flex items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text)] cursor-pointer transition-all duration-200 p-0 overflow-visible shadow-[0_1px_3px_var(--color-shadow)] hover:bg-[var(--color-hover)] hover:border-[var(--color-border-hover)] hover:-translate-y-px hover:shadow-[0_2px_6px_var(--color-shadow)] active:bg-[var(--color-active)] active:translate-y-0 active:shadow-[0_1px_2px_var(--color-shadow)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[var(--color-bg-elevated)] disabled:hover:border-[var(--color-border)] disabled:hover:translate-y-0 disabled:hover:shadow-[0_1px_3px_var(--color-shadow)] w-9 h-9"
      classList={{
        "bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-[0_2px_8px_rgba(74,158,255,0.3)] hover:bg-[var(--color-primary-hover)] hover:border-[var(--color-primary-hover)] hover:shadow-[0_4px_12px_rgba(74,158,255,0.4)]":
          !props.variant || props.variant === "primary",
        "bg-[var(--color-bg)] text-[var(--color-text)]": props.variant === "secondary",
        "bg-[var(--color-bg-elevated)] text-[var(--color-recording)] border-[var(--color-recording)] hover:bg-[rgba(248,81,73,0.1)] hover:border-[var(--color-recording)] hover:shadow-[0_2px_8px_rgba(248,81,73,0.2)] active:bg-[rgba(248,81,73,0.15)]":
          props.variant === "danger",
        ...props.classList,
      }}
      aria-label={props.label}
    >
      <span class="flex items-center justify-center w-full h-full">{props.icon}</span>
      <span
        ref={tooltipRef}
        class="absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 py-1.5 px-2.5 bg-[var(--color-dark)] text-white text-xs font-medium whitespace-nowrap rounded opacity-0 pointer-events-none transition-[opacity,transform] duration-150 z-[1000] shadow-[0_2px_8px_rgba(0,0,0,0.15)] max-w-[calc(100vw-2rem)] overflow-hidden text-ellipsis [&::after]:content-[''] [&::after]:absolute [&::after]:top-full [&::after]:left-1/2 [&::after]:-translate-x-1/2 [&::after]:border-4 [&::after]:border-transparent [&::after]:border-t-[var(--color-dark)] group-hover:opacity-100 group-hover:-translate-y-0.5"
      >
        {props.label}
      </span>
    </button>
  );
};
