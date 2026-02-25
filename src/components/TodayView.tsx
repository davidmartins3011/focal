import { useState, useCallback } from "react";
import FocusNow from "./FocusNow";
import ProgressBar from "./ProgressBar";
import TaskItem from "./TaskItem";
import type { Task, MicroStep } from "../types";
import styles from "./TodayView.module.css";

const mockDecompositions: Record<string, MicroStep[]> = {
  "5": [
    { id: "5a", text: "Lancer dbt test --select orders et noter l'erreur exacte", done: false },
    { id: "5b", text: "Vérifier le modèle source dans target/run_results.json", done: false },
    { id: "5c", text: "Identifier si c'est un problème de schéma ou de données amont", done: false },
  ],
  "6": [
    { id: "6a", text: "Lister 5 frustrations TDAH que tu vis au quotidien", done: false },
    { id: "6b", text: "Pour chaque frustration, noter une feature qui la résoudrait", done: false },
    { id: "6c", text: "Classer par impact vs effort — garder le top 3", done: false },
  ],
  "7": [
    { id: "7a", text: "Lister 5 questions ouvertes sur les habitudes de productivité", done: false },
    { id: "7b", text: "Préparer 3 questions sur les outils utilisés actuellement", done: false },
    { id: "7c", text: "Rédiger une intro de 2 lignes pour mettre à l'aise l'interviewé", done: false },
  ],
};

const DECOMPOSE_DELAY_MS = 1800;

const initialTasks: Task[] = [
  {
    id: "1",
    name: "Sync équipe Data — stand-up",
    done: true,
    tags: [{ label: "Roadmap", color: "roadmap" }],
  },
  {
    id: "2",
    name: "Revoir les specs du connecteur Salesforce",
    done: true,
    tags: [{ label: "CRM", color: "crm" }],
  },
  {
    id: "3",
    name: "Répondre aux emails du matin",
    done: true,
    tags: [],
  },
  {
    id: "4",
    name: "Préparer la revue de sprint vendredi",
    done: false,
    tags: [
      { label: "Roadmap", color: "roadmap" },
      { label: "Prioritaire", color: "urgent" },
    ],
    aiDecomposed: true,
    estimatedMinutes: 45,
    microSteps: [
      { id: "4a", text: "Lister les tickets fermés depuis le dernier sprint", done: true },
      { id: "4b", text: "Identifier les 2-3 points de blocage à mentionner", done: false },
      { id: "4c", text: "Préparer les slides (5 slides max)", done: false },
    ],
  },
  {
    id: "5",
    name: "Investiguer le bug pipeline dbt — table orders",
    done: false,
    tags: [{ label: "Data Platform", color: "data" }],
  },
  {
    id: "6",
    name: "Brainstorm idées SaaS TDAH — 20 min",
    done: false,
    tags: [{ label: "SaaS", color: "saas" }],
  },
  {
    id: "7",
    name: "Préparer questions pour entretien utilisateur TDAH",
    done: false,
    tags: [{ label: "SaaS", color: "saas" }],
  },
];

export default function TodayView() {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [decomposingId, setDecomposingId] = useState<string | null>(null);
  const doneCount = tasks.filter((t) => t.done).length;
  const focusTask = tasks.find((t) => !t.done && t.estimatedMinutes);

  function toggleTask(id: string) {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
  }

  function toggleStep(taskId: string, stepId: string) {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId || !t.microSteps) return t;
        return {
          ...t,
          microSteps: t.microSteps.map((s) =>
            s.id === stepId ? { ...s, done: !s.done } : s
          ),
        };
      })
    );
  }

  const decompose = useCallback((taskId: string) => {
    if (decomposingId) return;
    setDecomposingId(taskId);

    const steps = mockDecompositions[taskId];
    if (!steps) {
      setDecomposingId(null);
      return;
    }

    setTimeout(() => {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, microSteps: steps, aiDecomposed: true }
            : t
        )
      );

      setTimeout(() => setDecomposingId(null), steps.length * 300 + 500);
    }, DECOMPOSE_DELAY_MS);
  }, [decomposingId]);

  return (
    <div>
      {focusTask && (
        <FocusNow
          task={focusTask.name}
          estimatedMinutes={focusTask.estimatedMinutes!}
          onStart={() => {}}
        />
      )}

      <ProgressBar done={doneCount} total={tasks.length} />

      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>Tâches du jour</span>
        <button className={styles.sectionAction}>+ Ajouter</button>
      </div>

      <div className={styles.taskList}>
        {tasks.map((task, i) => (
          <TaskItem
            key={task.id}
            task={task}
            onToggle={toggleTask}
            onToggleStep={toggleStep}
            onDecompose={decompose}
            isDecomposing={decomposingId === task.id}
            animDelay={0.08 + i * 0.04}
          />
        ))}
      </div>
    </div>
  );
}
