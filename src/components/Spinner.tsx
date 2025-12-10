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
    <div class={`spinner spinner--${size()}`} style={{ width: sizeMap[size()], height: sizeMap[size()] }}>
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle
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
