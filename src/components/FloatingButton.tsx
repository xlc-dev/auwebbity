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
      class="floating-button"
      classList={{
        "floating-button--primary": !props.variant || props.variant === "primary",
        "floating-button--secondary": props.variant === "secondary",
        "floating-button--danger": props.variant === "danger",
        "floating-button--disabled": props.disabled,
        ...props.classList,
      }}
      aria-label={props.label}
    >
      <span class="floating-button__icon">{props.icon}</span>
      <span ref={tooltipRef} class="floating-button__tooltip">
        {props.label}
      </span>
    </button>
  );
};
