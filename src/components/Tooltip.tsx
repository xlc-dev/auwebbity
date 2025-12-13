import { Component, JSX, createSignal, Show, onMount, onCleanup } from "solid-js";
import { Portal } from "solid-js/web";

interface TooltipProps {
  label: string;
  children: JSX.Element;
}

export const Tooltip: Component<TooltipProps> = (props) => {
  let containerRef: HTMLElement | undefined;
  const [isHovered, setIsHovered] = createSignal(false);
  const [position, setPosition] = createSignal({ top: 0, left: 0 });

  const updatePosition = () => {
    if (!containerRef) return;
    const rect = containerRef.getBoundingClientRect();
    setPosition({
      top: rect.top,
      left: rect.left + rect.width / 2,
    });
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
    requestAnimationFrame(updatePosition);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  onMount(() => {
    const handleScroll = () => {
      if (isHovered()) updatePosition();
    };
    const handleResize = () => {
      if (isHovered()) updatePosition();
    };
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);

    onCleanup(() => {
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
    });
  });

  return (
    <>
      <span
        ref={containerRef}
        class="relative inline-block"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {props.children}
      </span>
      <Show when={isHovered()}>
        <Portal>
          <span
            class="fixed py-1.5 px-2.5 bg-[var(--color-dark)] text-white text-xs font-medium whitespace-nowrap rounded pointer-events-none z-[1000] [&::after]:content-[''] [&::after]:absolute [&::after]:top-full [&::after]:left-1/2 [&::after]:-translate-x-1/2 [&::after]:border-4 [&::after]:border-transparent [&::after]:border-t-[var(--color-dark)]"
            style={{
              top: `${position().top - 8}px`,
              left: `${position().left}px`,
              transform: "translate(-50%, -100%)",
            }}
          >
            {props.label}
          </span>
        </Portal>
      </Show>
    </>
  );
};
