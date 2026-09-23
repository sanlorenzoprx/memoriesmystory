import { useEffect, useState } from "react";

type TextSize = "standard" | "large" | "largest";

const sizes: readonly TextSize[] = ["standard", "large", "largest"];
const labels: Record<TextSize, string> = {
  standard: "Standard",
  large: "Large",
  largest: "Largest"
};
const storageKey = "memoriesmystory:text-size";

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

  useEffect(() => {
    document.documentElement.dataset.textSize = size;
    try {
      window.localStorage.setItem(storageKey, size);
    } catch {
      // The selected size still applies for this page if storage is unavailable.
    }
  }, [size]);

  return (
    <div className="text-size-control" aria-label="Text size">
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
    </div>
  );
}
