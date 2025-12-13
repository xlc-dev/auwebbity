import { Component, JSX, onMount, onCleanup } from "solid-js";

interface TooltipProps {
  label: string;
  children: JSX.Element;
}

export const Tooltip: Component<TooltipProps> = (props) => {
  let containerRef: HTMLElement | undefined;
  let tooltipRef: HTMLSpanElement | undefined;

  const adjustTooltipPosition = () => {
    if (!containerRef || !tooltipRef) return;

    const containerRect = containerRef.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const margin = 16;

    const originalVisibility = tooltipRef.style.visibility;
    tooltipRef.style.visibility = "hidden";
    tooltipRef.style.display = "block";
    const tooltipWidth = tooltipRef.offsetWidth;
    tooltipRef.style.display = "";
    tooltipRef.style.visibility = originalVisibility;

    const containerCenterX = containerRect.left + containerRect.width / 2;
    const tooltipLeft = containerCenterX - tooltipWidth / 2;

    if (tooltipLeft < margin) {
      tooltipRef.style.left = `${margin - containerRect.left}px`;
      tooltipRef.style.right = "";
      tooltipRef.style.transform = "translateY(-2px)";
    } else if (tooltipLeft + tooltipWidth > viewportWidth - margin) {
      tooltipRef.style.right = `${viewportWidth - containerRect.right - margin}px`;
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
    if (containerRef) {
      containerRef.addEventListener("mouseenter", handleMouseEnter);
      window.addEventListener("resize", adjustTooltipPosition);
    }
  });

  onCleanup(() => {
    if (containerRef) {
      containerRef.removeEventListener("mouseenter", handleMouseEnter);
      window.removeEventListener("resize", adjustTooltipPosition);
    }
  });

  return (
    <span ref={containerRef} class="group relative inline-block overflow-visible">
      {props.children}
      <span
        ref={tooltipRef}
        class="absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 py-1 sm:py-1.5 px-2 sm:px-2.5 bg-[var(--color-dark)] text-white text-[0.625rem] sm:text-xs font-medium whitespace-nowrap rounded opacity-0 pointer-events-none transition-[opacity,transform] duration-150 z-[9999] max-w-[calc(100vw-2rem)] overflow-hidden text-ellipsis [&::after]:content-[''] [&::after]:absolute [&::after]:top-full [&::after]:left-1/2 [&::after]:-translate-x-1/2 [&::after]:border-4 [&::after]:border-transparent [&::after]:border-t-[var(--color-dark)] group-hover:opacity-100 group-hover:-translate-y-0.5"
      >
        {props.label}
      </span>
    </span>
  );
};
