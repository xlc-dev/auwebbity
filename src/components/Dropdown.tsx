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
    <div ref={containerRef} class="relative inline-block">
      <button
        ref={buttonRef}
        type="button"
        class="flex items-center gap-2 py-1.5 px-2.5 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-md text-[var(--color-text)] text-[0.8125rem] font-medium cursor-pointer transition-all duration-200 min-w-[70px] font-inherit hover:bg-[var(--color-hover)] hover:border-[var(--color-border-hover)] focus:outline-none focus:border-[var(--color-primary)] disabled:opacity-50 disabled:cursor-not-allowed"
        classList={{
          "border-[var(--color-primary)]": isOpen(),
        }}
        onClick={() => !props.disabled && setIsOpen(!isOpen())}
        disabled={props.disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen()}
      >
        <span class="flex-1 text-left">{selectedOption()?.label || props.value}</span>
        <svg
          width="12"
          height="8"
          viewBox="0 0 12 8"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          class="flex-shrink-0 transition-transform duration-200 text-[var(--color-text-secondary)]"
          classList={{
            "rotate-180": isOpen(),
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
        <div class="absolute bottom-[calc(100%+4px)] left-0 right-0 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-md overflow-hidden z-[1000] min-w-full animate-[dropdownSlideDown_0.15s_ease-out]">
          {props.options.map((option) => (
            <button
              type="button"
              class="block w-full py-2 px-3 bg-transparent border-0 text-[var(--color-text)] text-[0.8125rem] font-medium text-left cursor-pointer transition-[background-color] duration-150 font-inherit hover:bg-[var(--color-hover)] first:rounded-tl-md first:rounded-tr-md last:rounded-bl-md last:rounded-br-md"
              classList={{
                "bg-[var(--color-active)] text-[var(--color-primary)]":
                  option.value === props.value,
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
