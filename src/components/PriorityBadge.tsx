import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import type { PriorityScore } from "../types";
import styles from "./PriorityBadge.module.css";

type PriorityType = "urgency" | "importance";

interface PriorityBadgeProps {
  type: PriorityType;
  score: number;
  onChange?: (value: PriorityScore) => void;
}

const LEVELS: { value: PriorityScore; label: string }[] = [
  { value: 5, label: "Critique" },
  { value: 4, label: "Haute" },
  { value: 3, label: "Moyenne" },
  { value: 2, label: "Basse" },
  { value: 1, label: "Minimale" },
];

const TYPE_LABEL: Record<PriorityType, string> = {
  urgency: "Urgence",
  importance: "Importance",
};

function PriorityIcon({ score, size = 14 }: { score: number; size?: number }) {
  if (score >= 5) {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
        <path d="M3 10l5-4 5 4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3 14l5-4 5 4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (score >= 4) {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
        <path d="M3 11l5-4 5 4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (score >= 3) {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
        <path d="M3 8h10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    );
  }
  if (score >= 2) {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
        <path d="M3 5l5 4 5-4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M3 2l5 4 5-4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 6l5 4 5-4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function getLevelClass(score: number) {
  if (score >= 4) return styles.high;
  if (score === 3) return styles.medium;
  return styles.low;
}

export default function PriorityBadge({ type, score, onChange }: PriorityBadgeProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        btnRef.current?.contains(e.target as Node) ||
        popoverRef.current?.contains(e.target as Node)
      )
        return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const colorClass = type === "urgency" ? styles.urgency : styles.importance;
  const tooltip = `${TYPE_LABEL[type]} : ${LEVELS.find((l) => l.value === score)?.label ?? ""}`;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onChange) return;
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
    setOpen(!open);
  };

  const handleSelect = (v: PriorityScore) => {
    onChange?.(v);
    setOpen(false);
  };

  return (
    <>
      <button
        ref={btnRef}
        className={`${styles.icon} ${colorClass} ${getLevelClass(score)} ${onChange ? styles.clickable : ""}`}
        onClick={handleClick}
        title={tooltip}
      >
        <PriorityIcon score={score} />
      </button>
      {open && pos && onChange && createPortal(
        <div
          ref={popoverRef}
          className={styles.dropdown}
          style={{ position: "fixed", top: pos.top, left: pos.left }}
        >
          <div className={styles.dropdownTitle}>{TYPE_LABEL[type]}</div>
          {LEVELS.map(({ value, label }) => (
            <button
              key={value}
              className={`${styles.dropdownItem} ${colorClass} ${getLevelClass(value)} ${value === score ? styles.dropdownItemActive : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                handleSelect(value);
              }}
            >
              <PriorityIcon score={value} size={14} />
              <span>{label}</span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}

export { PriorityIcon };
