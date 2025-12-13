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
    const tooltipHeight = tooltipRef.offsetHeight;
    tooltipRef.style.display = "";
    tooltipRef.style.visibility = originalVisibility;

    const containerCenterX = containerRect.left + containerRect.width / 2;
    const tooltipTop = containerRect.top - tooltipHeight - 8;
    const tooltipLeft = containerCenterX - tooltipWidth / 2;

    let finalLeft = tooltipLeft;
    let arrowOffset = 0;
    if (tooltipLeft < margin) {
      finalLeft = margin;
      arrowOffset = containerCenterX - (finalLeft + tooltipWidth / 2);
    } else if (tooltipLeft + tooltipWidth > viewportWidth - margin) {
      finalLeft = viewportWidth - tooltipWidth - margin;
      arrowOffset = containerCenterX - (finalLeft + tooltipWidth / 2);
    }

    tooltipRef.style.position = "fixed";
    tooltipRef.style.top = `${tooltipTop}px`;
    tooltipRef.style.left = `${finalLeft}px`;
    tooltipRef.style.right = "auto";
    tooltipRef.style.transform = "translateY(0)";

    if (arrowOffset !== 0) {
      tooltipRef.style.setProperty("--arrow-offset", `${arrowOffset}px`);
    } else {
      tooltipRef.style.removeProperty("--arrow-offset");
    }
  };

  const handleMouseEnter = () => {
    requestAnimationFrame(adjustTooltipPosition);
  };

  onMount(() => {
    if (containerRef) {
      containerRef.addEventListener("mouseenter", handleMouseEnter);
      window.addEventListener("resize", adjustTooltipPosition);
      window.addEventListener("scroll", adjustTooltipPosition, true);
    }
  });

  onCleanup(() => {
    if (containerRef) {
      containerRef.removeEventListener("mouseenter", handleMouseEnter);
      window.removeEventListener("resize", adjustTooltipPosition);
      window.removeEventListener("scroll", adjustTooltipPosition, true);
    }
  });

  return (
    <span ref={containerRef} class="group relative inline-block overflow-visible">
      {props.children}
      <span
        ref={tooltipRef}
        class="py-1 sm:py-1.5 px-2 sm:px-2.5 bg-[var(--color-dark)] text-white text-[0.625rem] sm:text-xs font-medium whitespace-nowrap rounded opacity-0 pointer-events-none transition-opacity duration-150 z-[99999] max-w-[calc(100vw-2rem)] overflow-hidden text-ellipsis [&::after]:content-[''] [&::after]:absolute [&::after]:top-full [&::after]:left-1/2 [&::after]:-translate-x-1/2 [&::after]:translate-x-[var(--arrow-offset,0)] [&::after]:border-4 [&::after]:border-transparent [&::after]:border-t-[var(--color-dark)] group-hover:opacity-100"
        style="position: fixed;"
      >
        {props.label}
      </span>
    </span>
  );
};
