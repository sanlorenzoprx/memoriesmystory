import { useEffect, useRef, useState } from "react";

type TextSize = "standard" | "large" | "largest";

const sizes: readonly TextSize[] = ["standard", "large", "largest"];
const labels: Record<TextSize, string> = {
  standard: "Standard",
  large: "Large",
  largest: "Largest"
};
const storageKey = "memoriesmystory:text-size";
const initialVisibilityMs = 3_000;

function storedSize(): TextSize {
  try {
    const value = window.localStorage.getItem(storageKey);
    return sizes.includes(value as TextSize) ? (value as TextSize) : "standard";
  } catch {
    return "standard";
  }
}

export function TextSizeControl() {
  const [size, setSize] = useState<TextSize>(storedSize);
  const [open, setOpen] = useState(true);
  const manuallyOpenedRef = useRef(false);

  useEffect(() => {
    document.documentElement.dataset.textSize = size;
    try {
      window.localStorage.setItem(storageKey, size);
    } catch {
      // The selected size still applies for this page if storage is unavailable.
    }
  }, [size]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!manuallyOpenedRef.current) setOpen(false);
    }, initialVisibilityMs);
    return () => window.clearTimeout(timer);
  }, []);

  function openSettings() {
    manuallyOpenedRef.current = true;
    setOpen(true);
  }

  function closeSettings() {
    manuallyOpenedRef.current = false;
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        className="settings-tab"
        type="button"
        aria-label="Open reading settings"
        onClick={openSettings}
      >
        <span aria-hidden="true">⚙</span>
        Settings
      </button>
    );
  }

  return (
    <div className="text-size-control" aria-label="Reading settings">
      <span>Text</span>
      {sizes.map((option) => (
        <button
          key={option}
          type="button"
          className={size === option ? "is-selected" : undefined}
          aria-pressed={size === option}
          aria-label={`Use ${labels[option].toLowerCase()} text`}
          onClick={() => setSize(option)}
        >
          {option === "standard" ? "A" : option === "large" ? "A+" : "A++"}
        </button>
      ))}
      <button
        className="text-size-close"
        type="button"
        aria-label="Close reading settings"
        onClick={closeSettings}
      >
        ×
      </button>
    </div>
  );
}
