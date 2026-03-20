import { useState } from "react";
import styles from "./ToolboxView.module.css";
import ComparatorTool from "./tools/ComparatorTool";
import Top5Tool from "./tools/Top5Tool";
import PomodoroTool from "./tools/PomodoroTool";
import QuickDecisionTool from "./tools/QuickDecisionTool";
import BreathingTool from "./tools/BreathingTool";
import RestartSequenceTool from "./tools/RestartSequenceTool";
import GroundingTool from "./tools/GroundingTool";
import BodyDoubleTool from "./tools/BodyDoubleTool";
import WoopTool from "./tools/WoopTool";
import BodyScanTool from "./tools/BodyScanTool";
import MicroMovementTool from "./tools/MicroMovementTool";

type ToolId = "comparator" | "top5" | "pomodoro" | "decision" | "breathing" | "restart" | "grounding" | "bodydouble" | "woop" | "bodyscan" | "micromovement";

interface ToolDef {
  id: ToolId;
  icon: string;
  title: string;
  description: string;
}

const TOOLS: Record<ToolId, ToolDef> = {
  comparator: {
    id: "comparator",
    icon: "⚖️",
    title: "Comparateur de tâches",
    description: "Compare tes tâches deux par deux pour trouver laquelle attaquer en premier.",
  },
  top5: {
    id: "top5",
    icon: "🎯",
    title: "Méthode 25/5",
    description: "Choisis tes 5 vraies priorités. Tout le reste devient ta liste \"ne pas toucher\".",
  },
  pomodoro: {
    id: "pomodoro",
    icon: "🍅",
    title: "Timer Pomodoro",
    description: "Lance un cycle de focus de 25 min suivi d'une pause pour avancer sans t'épuiser.",
  },
  decision: {
    id: "decision",
    icon: "🎲",
    title: "Décision rapide",
    description: "Tu hésites entre deux options ? Laisse le hasard trancher pour toi.",
  },
  breathing: {
    id: "breathing",
    icon: "🌬️",
    title: "Respiration guidée",
    description: "Un exercice de respiration visuel pour calmer ton esprit et retrouver ta concentration.",
  },
  restart: {
    id: "restart",
    icon: "🔄",
    title: "Séquence de redémarrage",
    description: "Tu as décroché ? Suis ce protocole étape par étape pour te relancer en douceur.",
  },
  grounding: {
    id: "grounding",
    icon: "🧘",
    title: "Ancrage 5-4-3-2-1",
    description: "Ramène ton attention au présent grâce à tes 5 sens. Idéal quand tu es submergé.",
  },
  bodydouble: {
    id: "bodydouble",
    icon: "👁️",
    title: "Someone is watching",
    description: "Un avatar te regarde travailler. Le simple fait d'être « observé » booste ta concentration.",
  },
  woop: {
    id: "woop",
    icon: "💭",
    title: "Méthode WOOP",
    description: "Visualise ton objectif en 4 étapes : Souhait, Résultat, Obstacle, Plan d'action.",
  },
  bodyscan: {
    id: "bodyscan",
    icon: "🫁",
    title: "Scan corporel express",
    description: "Parcours ton corps zone par zone en 90 secondes pour relâcher les tensions.",
  },
  micromovement: {
    id: "micromovement",
    icon: "🤸",
    title: "Micro-mouvement",
    description: "Un exercice physique rapide tiré au hasard pour casser l'immobilité et relancer l'énergie.",
  },
};

interface ToolSection {
  label: string;
  icon: string;
  toolIds: ToolId[];
}

const TOOL_SECTIONS: ToolSection[] = [
  {
    label: "Focus",
    icon: "🎯",
    toolIds: ["pomodoro", "bodydouble", "restart"],
  },
  {
    label: "Organisation",
    icon: "📋",
    toolIds: ["comparator", "top5", "decision", "woop"],
  },
  {
    label: "Conscience & Relaxation",
    icon: "🧘",
    toolIds: ["breathing", "grounding", "bodyscan", "micromovement"],
  },
];

export default function ToolboxView() {
  const [activeTool, setActiveTool] = useState<ToolId | null>(null);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.title}>
          <span className={styles.titleIcon}>🧰</span>
          Boîte à outils
        </div>
        <div className={styles.subtitle}>
          Choisis un outil pour t'aider à décider, prioriser ou te débloquer.
        </div>
      </div>

      <div className={styles.content}>
        {activeTool ? (
          <div className={styles.toolView}>
            <button className={styles.backBtn} onClick={() => setActiveTool(null)}>
              ← Retour aux outils
            </button>
            <ToolRouter toolId={activeTool} />
          </div>
        ) : (
          <div className={styles.toolSections}>
            {TOOL_SECTIONS.map((section) => (
              <div key={section.label} className={styles.toolSection}>
                <div className={styles.toolSectionHeader}>
                  <span className={styles.toolSectionIcon}>{section.icon}</span>
                  <span className={styles.toolSectionTitle}>{section.label}</span>
                </div>
                <div className={styles.toolSectionGrid}>
                  {section.toolIds.map((id) => {
                    const tool = TOOLS[id];
                    return (
                      <button
                        key={tool.id}
                        className={styles.toolCard}
                        onClick={() => setActiveTool(tool.id)}
                      >
                        <div className={styles.toolCardIcon}>{tool.icon}</div>
                        <div className={styles.toolCardTitle}>{tool.title}</div>
                        <div className={styles.toolCardDesc}>{tool.description}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ToolRouter({ toolId }: { toolId: ToolId }) {
  switch (toolId) {
    case "comparator": return <ComparatorTool />;
    case "top5": return <Top5Tool />;
    case "pomodoro": return <PomodoroTool />;
    case "decision": return <QuickDecisionTool />;
    case "breathing": return <BreathingTool />;
    case "restart": return <RestartSequenceTool />;
    case "grounding": return <GroundingTool />;
    case "bodydouble": return <BodyDoubleTool />;
    case "woop": return <WoopTool />;
    case "bodyscan": return <BodyScanTool />;
    case "micromovement": return <MicroMovementTool />;
  }
}
