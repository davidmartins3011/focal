import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Task } from "../../types";
import styles from "../ToolboxView.module.css";

const TOP5_SETTING_KEY = "top5-task-ids";

export default function Top5Tool() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [locked, setLocked] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [allTasks, savedJson] = await Promise.all([
          invoke<Task[]>("get_all_tasks"),
          invoke<string | null>("get_setting", { key: TOP5_SETTING_KEY }),
        ]);

        if (cancelled) return;

        const pending = allTasks.filter((task) => !task.done);
        setTasks(pending);

        if (savedJson) {
          const savedIds: string[] = JSON.parse(savedJson);
          const pendingIds = new Set(pending.map((t) => t.id));
          const validIds = savedIds.filter((id) => pendingIds.has(id));

          if (validIds.length > 0) {
            setSelected(new Set(validIds));
            setLocked(true);
          }
        }
      } catch {
        // silently ignore load errors
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const toggleTask = (id: string) => {
    if (locked) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 5) {
        next.add(id);
      }
      return next;
    });
  };

  const handleLock = async () => {
    setSaving(true);
    try {
      const ids = Array.from(selected);
      await invoke("set_setting", {
        key: TOP5_SETTING_KEY,
        value: JSON.stringify(ids),
      });
      setLocked(true);
    } catch {
      // persist failed — lock locally anyway
      setLocked(true);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    try {
      await invoke("set_setting", {
        key: TOP5_SETTING_KEY,
        value: JSON.stringify([]),
      });
    } catch {
      // ignore
    } finally {
      setSelected(new Set());
      setLocked(false);
      setSaving(false);
    }
  };

  const completedCount = tasks.filter(
    (t) => selected.has(t.id) && t.done,
  ).length;

  const top5 = Array.from(selected)
    .map((id) => tasks.find((t) => t.id === id))
    .filter((t): t is Task => t !== undefined);
  const avoid = tasks.filter((t) => !selected.has(t.id));

  if (loading) {
    return <div className={styles.eisenhowerLoading}>Chargement des tâches…</div>;
  }

  return (
    <>
      <div className={styles.toolViewTitle}>Méthode 25/5</div>
      <div className={styles.toolViewDesc}>
        La règle de Warren Buffett : choisis tes 5 priorités absolues.
        Tout le reste devient ta liste « à éviter » tant que le top 5 n'est pas fait.
      </div>

      {!locked ? (
        <div className={styles.top5Selection}>
          <div className={styles.top5Counter}>
            <span className={styles.top5CounterValue}>{selected.size}</span>
            <span className={styles.top5CounterLabel}> / 5 sélectionnées</span>
          </div>
          <div className={styles.top5List}>
            {tasks.map((t) => {
              const isSelected = selected.has(t.id);
              const isFull = selected.size >= 5 && !isSelected;
              return (
                <button
                  key={t.id}
                  className={`${styles.top5Item} ${isSelected ? styles.top5ItemSelected : ""} ${isFull ? styles.top5ItemDisabled : ""}`}
                  onClick={() => toggleTask(t.id)}
                  disabled={isFull}
                >
                  <span className={styles.top5Checkbox}>
                    {isSelected ? "★" : "☆"}
                  </span>
                  <span className={styles.top5ItemName}>{t.name}</span>
                  {t.tags?.[0] && (
                    <span className={styles.top5ItemTag}>{t.tags[0].label}</span>
                  )}
                </button>
              );
            })}
          </div>
          {tasks.length === 0 && (
            <div className={styles.quadrantEmpty}>Aucune tâche non terminée.</div>
          )}
          <div className={styles.top5Actions}>
            <button
              className={styles.top5Btn}
              onClick={handleLock}
              disabled={selected.size === 0 || saving}
            >
              {saving ? "Enregistrement…" : `Valider mon top ${selected.size > 0 ? selected.size : 5}`}
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.top5Result}>
          {completedCount > 0 && completedCount < top5.length && (
            <div className={styles.top5Progress}>
              <div className={styles.top5ProgressBar}>
                <div
                  className={styles.top5ProgressFill}
                  style={{ width: `${(completedCount / top5.length) * 100}%` }}
                />
              </div>
              <span className={styles.top5ProgressLabel}>
                {completedCount} / {top5.length} terminées
              </span>
            </div>
          )}
          {completedCount === top5.length && top5.length > 0 && (
            <div className={styles.top5AllDone}>
              <span className={styles.top5AllDoneIcon}>🎉</span>
              <span>Top {top5.length} terminé ! Tu peux recommencer avec de nouvelles priorités.</span>
            </div>
          )}

          <div className={styles.top5Section}>
            <div className={styles.top5SectionHeader}>
              <span className={styles.top5SectionIcon}>🟢</span>
              <span className={styles.top5SectionTitle}>Ton focus — fais uniquement ça</span>
            </div>
            <div className={styles.top5SectionList}>
              {top5.map((t, i) => (
                <div key={t.id} className={`${styles.top5ResultItem} ${t.done ? styles.top5ResultItemDone : ""}`}>
                  <span className={styles.top5Rank}>{i + 1}</span>
                  <span className={t.done ? styles.top5DoneText : ""}>{t.name}</span>
                  {t.done && <span className={styles.top5DoneCheck}>✓</span>}
                </div>
              ))}
            </div>
          </div>

          <div className={`${styles.top5Section} ${styles.top5SectionAvoid}`}>
            <div className={styles.top5SectionHeader}>
              <span className={styles.top5SectionIcon}>🔴</span>
              <span className={styles.top5SectionTitle}>Liste « ne pas toucher »</span>
            </div>
            <div className={styles.top5SectionHint}>
              Ces tâches ne sont pas supprimées — mais tu t'engages à ne pas y toucher tant que ton top n'est pas fait.
            </div>
            <div className={styles.top5SectionList}>
              {avoid.map((t) => (
                <div key={t.id} className={`${styles.top5ResultItem} ${styles.top5ResultItemFaded}`}>
                  <span>{t.name}</span>
                </div>
              ))}
              {avoid.length === 0 && (
                <div className={styles.quadrantEmpty}>Toutes tes tâches sont dans ton top !</div>
              )}
            </div>
          </div>

          <div className={styles.top5Actions}>
            <button
              className={`${styles.comparatorBtn} ${styles.comparatorBtnSecondary}`}
              onClick={handleReset}
              disabled={saving}
            >
              {saving ? "…" : "Recommencer"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
