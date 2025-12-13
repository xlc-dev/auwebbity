import { Component, JSX } from "solid-js";

interface TooltipProps {
  label: string;
  children: JSX.Element;
}

export const Tooltip: Component<TooltipProps> = (props) => {
  return (
    <span class="group relative inline-block">
      {props.children}
      <span class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 py-1.5 px-2.5 bg-[var(--color-dark)] text-white text-xs font-medium whitespace-nowrap rounded opacity-0 pointer-events-none transition-opacity duration-150 z-[999999] group-hover:opacity-100 [&::after]:content-[''] [&::after]:absolute [&::after]:top-full [&::after]:left-1/2 [&::after]:-translate-x-1/2 [&::after]:border-4 [&::after]:border-transparent [&::after]:border-t-[var(--color-dark)]">
        {props.label}
      </span>
    </span>
  );
};
