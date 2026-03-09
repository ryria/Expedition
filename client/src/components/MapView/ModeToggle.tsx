type ViewMode = "asRan" | "contribution";
interface Props { mode: ViewMode; onChange: (m: ViewMode) => void; }

export function ModeToggle({ mode, onChange }: Props) {
  return (
    <div className="mode-toggle">
      <button className={mode === "asRan" ? "active" : ""} onClick={() => onChange("asRan")}>
        As Ran
      </button>
      <button className={mode === "contribution" ? "active" : ""} onClick={() => onChange("contribution")}>
        Contribution
      </button>
    </div>
  );
}
