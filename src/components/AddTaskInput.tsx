import { useState, useCallback } from "react";
import styles from "./AddTaskInput.module.css";

interface AddTaskInputProps {
  placeholder?: string;
  onAdd: (text: string) => void;
}

export default function AddTaskInput({ placeholder = "Ajouter une tâche…", onAdd }: AddTaskInputProps) {
  const [text, setText] = useState("");

  const handleAdd = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setText("");
    onAdd(trimmed);
  }, [text, onAdd]);

  return (
    <div className={styles.addArea}>
      <input
        className={styles.addInput}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        placeholder={placeholder}
      />
      <button className={styles.addBtn} onClick={handleAdd}>Ajouter</button>
    </div>
  );
}
