import { Component } from "solid-js";

interface SpinnerProps {
  size?: "small" | "medium" | "large";
}

export const Spinner: Component<SpinnerProps> = (props) => {
  const size = () => props.size || "medium";

  const sizeMap = {
    small: "16px",
    medium: "24px",
    large: "32px",
  };

  return (
    <div
      class="inline-block animate-[spinnerRotate_1s_linear_infinite] text-white"
      style={{ width: sizeMap[size()], height: sizeMap[size()] }}
    >
      <svg class="w-full h-full" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle
          class="fill-none [transform-origin:center] animate-[spinnerDash_1.5s_ease-in-out_infinite]"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-dasharray="31.416"
          stroke-dashoffset="31.416"
          opacity="0.3"
        />
        <circle
          class="fill-none [transform-origin:center] animate-[spinnerDash_1.5s_ease-in-out_infinite]"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-dasharray="31.416"
          stroke-dashoffset="23.562"
        />
      </svg>
    </div>
  );
};
