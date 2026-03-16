import { useDroppable } from "@dnd-kit/core";
import styles from "./DroppableEmptyZone.module.css";

export default function DroppableEmptyZone({ id, label }: { id: string; label: string }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`${styles.emptyDropZone} ${isOver ? styles.emptyDropZoneOver : ""}`}>
      {label}
    </div>
  );
}
