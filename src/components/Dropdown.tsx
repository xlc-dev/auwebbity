import { Component, createSignal, onMount, onCleanup, Show } from "solid-js";

interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export const Dropdown: Component<DropdownProps> = (props) => {
  const [isOpen, setIsOpen] = createSignal(false);
  let containerRef: HTMLDivElement | undefined;
  let buttonRef: HTMLButtonElement | undefined;

  const handleClickOutside = (e: MouseEvent) => {
    if (containerRef && !containerRef.contains(e.target as Node)) {
      setIsOpen(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      buttonRef?.focus();
    } else if (e.key === "ArrowDown" && !isOpen()) {
      e.preventDefault();
      setIsOpen(true);
    } else if (e.key === "ArrowUp" && isOpen()) {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  onMount(() => {
    document.addEventListener("mousedown", handleClickOutside);
    buttonRef?.addEventListener("keydown", handleKeyDown);
  });

  onCleanup(() => {
    document.removeEventListener("mousedown", handleClickOutside);
    buttonRef?.removeEventListener("keydown", handleKeyDown);
  });

  const selectedOption = () => props.options.find((opt) => opt.value === props.value);

  const handleSelect = (value: string) => {
    props.onChange(value);
    setIsOpen(false);
    buttonRef?.focus();
  };

  return (
    <div ref={containerRef} class="dropdown">
      <button
        ref={buttonRef}
        type="button"
        class="dropdown__button"
        classList={{
          "dropdown__button--open": isOpen(),
          "dropdown__button--disabled": props.disabled,
        }}
        onClick={() => !props.disabled && setIsOpen(!isOpen())}
        disabled={props.disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen()}
      >
        <span class="dropdown__button-text">{selectedOption()?.label || props.value}</span>
        <svg
          width="12"
          height="8"
          viewBox="0 0 12 8"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          class="dropdown__button-icon"
          classList={{
            "dropdown__button-icon--open": isOpen(),
          }}
        >
          <path
            d="M1 1L6 6L11 1"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
      <Show when={isOpen()}>
        <div class="dropdown__menu">
          {props.options.map((option) => (
            <button
              type="button"
              class="dropdown__option"
              classList={{
                "dropdown__option--selected": option.value === props.value,
              }}
              onClick={() => handleSelect(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </Show>
    </div>
  );
};
