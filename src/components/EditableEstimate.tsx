import { useState, useEffect, useRef } from "react";
import styles from "./TaskItem.module.css";

interface Props {
  minutes?: number;
  onChange: (m: number | undefined) => void;
  small?: boolean;
}

export default function EditableEstimate({ minutes, onChange, small = false }: Props) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(minutes ?? ""));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        min={0}
        className={`${styles.estimateInput} ${small ? styles.estimateInputSmall : ""}`}
        value={value}
        autoFocus
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          const n = parseInt(value, 10);
          onChange(n > 0 ? n : undefined);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const n = parseInt(value, 10);
            onChange(n > 0 ? n : undefined);
            setEditing(false);
          }
          if (e.key === "Escape") setEditing(false);
        }}
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  return (
    <button
      className={`${styles.estimateBadge} ${small ? styles.estimateBadgeSmall : ""} ${
        minutes ? "" : styles.estimateEmpty
      }`}
      onClick={(e) => {
        e.stopPropagation();
        setValue(String(minutes ?? ""));
        setEditing(true);
      }}
    >
      {minutes ? `~${minutes} min` : "+ temps"}
    </button>
  );
}
