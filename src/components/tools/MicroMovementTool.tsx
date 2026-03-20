import { useState } from "react";
import styles from "../ToolboxView.module.css";

interface MicroExercise {
  emoji: string;
  name: string;
  instruction: string;
  duration: string;
}

const MICRO_EXERCISES: MicroExercise[] = [
  { emoji: "🙆", name: "Étirement cervical", instruction: "Penche la tête à droite 10s, puis à gauche 10s. Doucement.", duration: "20s" },
  { emoji: "🤷", name: "Roulé d'épaules", instruction: "Fais 10 rotations d'épaules vers l'arrière, puis 10 vers l'avant.", duration: "20s" },
  { emoji: "🧍", name: "Debout 30 secondes", instruction: "Lève-toi, reste debout, étire-toi. C'est tout.", duration: "30s" },
  { emoji: "🚶", name: "Micro-marche", instruction: "Fais 20 pas dans la pièce. Regarde autour de toi.", duration: "30s" },
  { emoji: "✊", name: "Serrer-relâcher", instruction: "Serre les poings très fort 5s, puis relâche. Répète 5 fois.", duration: "25s" },
  { emoji: "🦶", name: "Pointes de pieds", instruction: "Monte sur la pointe des pieds, tiens 5s, redescends. 10 fois.", duration: "30s" },
  { emoji: "🌀", name: "Rotation des poignets", instruction: "Fais tourner tes poignets dans un sens, puis dans l'autre. 15 tours chaque.", duration: "20s" },
  { emoji: "🧎", name: "Squat de bureau", instruction: "Fais 10 squats lents à côté de ta chaise. Respire.", duration: "30s" },
  { emoji: "💨", name: "Respiration debout", instruction: "Debout, inspire en levant les bras. Expire en les baissant. 5 fois.", duration: "25s" },
  { emoji: "👐", name: "Étirement des doigts", instruction: "Écarte les doigts au max 5s, puis ferme le poing. 10 fois.", duration: "20s" },
  { emoji: "🔄", name: "Rotation du buste", instruction: "Assis, tourne le buste à droite 10s, puis à gauche 10s.", duration: "20s" },
  { emoji: "🦵", name: "Extension de jambes", instruction: "Assis, tends une jambe devant toi 10s. Change. 3 fois chaque.", duration: "30s" },
  { emoji: "🪑", name: "Dips de chaise", instruction: "Mains sur le bord de la chaise, descends les fesses et remonte. 8 fois.", duration: "30s" },
  { emoji: "🐱", name: "Chat-vache", instruction: "À quatre pattes ou assis, arrondis le dos (chat) puis creuse-le (vache). 8 fois.", duration: "25s" },
  { emoji: "👀", name: "Yoga des yeux", instruction: "Regarde en haut, en bas, à droite, à gauche. Puis fais 5 cercles dans chaque sens.", duration: "20s" },
  { emoji: "🤲", name: "Étirement avant-bras", instruction: "Tends un bras, tire les doigts vers toi avec l'autre main. 15s par côté.", duration: "30s" },
  { emoji: "🦋", name: "Papillon d'épaules", instruction: "Mains sur les épaules, fais des cercles avec les coudes. 10 avant, 10 arrière.", duration: "25s" },
  { emoji: "🏔️", name: "Posture montagne", instruction: "Debout, pieds joints, étire-toi vers le ciel en inspirant. Tiens 15s. Relâche.", duration: "20s" },
  { emoji: "🫲", name: "Pression isométrique", instruction: "Paumes l'une contre l'autre devant la poitrine, pousse fort 10s. Relâche. 5 fois.", duration: "25s" },
  { emoji: "🦩", name: "Équilibre unipodal", instruction: "Tiens-toi sur un pied 15s, puis change. Recommence 2 fois chaque côté.", duration: "30s" },
];

export default function MicroMovementTool() {
  const [exerciseIdx, setExerciseIdx] = useState(() => Math.floor(Math.random() * MICRO_EXERCISES.length));
  const [history, setHistory] = useState<number[]>([]);

  const exercise = MICRO_EXERCISES[exerciseIdx];

  const pickRandom = () => {
    let next = exerciseIdx;
    while (next === exerciseIdx) {
      next = Math.floor(Math.random() * MICRO_EXERCISES.length);
    }
    setExerciseIdx(next);
  };

  const handleNext = () => {
    pickRandom();
  };

  const handleDone = () => {
    setHistory((prev) => [...prev, exerciseIdx]);
    pickRandom();
  };

  return (
    <>
      <div className={styles.toolViewTitle}>Micro-mouvement</div>
      <div className={styles.toolViewDesc}>
        Un exercice rapide tiré au hasard. Fais-le maintenant, ça prend moins de 30 secondes.
      </div>
      <div className={styles.microMoveContainer}>
        <div className={styles.microMoveCard}>
          <div className={styles.microMoveEmoji}>{exercise.emoji}</div>
          <div className={styles.microMoveName}>{exercise.name}</div>
          <div className={styles.microMoveInstruction}>{exercise.instruction}</div>
          <div className={styles.microMoveDuration}>{exercise.duration}</div>
        </div>

        <div className={styles.microMoveControls}>
          <button className={`${styles.pomodoroBtn} ${styles.pomodoroBtnStart}`} onClick={handleDone}>
            Fait ✓
          </button>
          <button className={`${styles.comparatorBtn} ${styles.comparatorBtnSecondary}`} onClick={handleNext}>
            Un autre
          </button>
        </div>

        {history.length > 0 && (
          <div className={styles.microMoveHistory}>
            {history.length} exercice{history.length > 1 ? "s" : ""} fait{history.length > 1 ? "s" : ""} cette session
          </div>
        )}
      </div>
    </>
  );
}
