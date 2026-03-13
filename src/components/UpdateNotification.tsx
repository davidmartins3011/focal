import { useState, useEffect, useCallback, useRef } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import styles from "./UpdateNotification.module.css";

type Phase = "available" | "downloading" | "ready" | "error";

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 heures

export default function UpdateNotification() {
  const [update, setUpdate] = useState<Update | null>(null);
  const [phase, setPhase] = useState<Phase>("available");
  const [progress, setProgress] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const contentLength = useRef(0);
  const downloaded = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const checkForUpdate = async () => {
      try {
        const result = await check();
        if (!cancelled && result?.available) {
          setUpdate(result);
          setDismissed(false);
          setExiting(false);
          setPhase("available");
        }
      } catch (e) {
        console.error("[Updater] check failed:", e);
      }
    };

    checkForUpdate();
    const interval = setInterval(checkForUpdate, CHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => setDismissed(true), 250);
  }, []);

  const handleUpdate = useCallback(async () => {
    if (!update) return;

    setPhase("downloading");
    setProgress(0);
    downloaded.current = 0;
    contentLength.current = 0;

    try {
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          contentLength.current = event.data.contentLength ?? 0;
        } else if (event.event === "Progress") {
          downloaded.current += event.data.chunkLength;
          if (contentLength.current > 0) {
            setProgress(Math.round((downloaded.current / contentLength.current) * 100));
          }
        } else if (event.event === "Finished") {
          setProgress(100);
        }
      });
      setPhase("ready");
    } catch (e) {
      console.error("[Updater] download failed:", e);
      setPhase("error");
      setErrorMsg(e instanceof Error ? e.message : String(e));
    }
  }, [update]);

  const handleRelaunch = useCallback(async () => {
    try {
      await relaunch();
    } catch (e) {
      console.error("[Updater] relaunch failed:", e);
    }
  }, []);

  if (!update || dismissed) return null;

  return (
    <div className={`${styles.container} ${exiting ? styles.exiting : ""}`}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <span className={styles.icon}>
            {phase === "ready" ? "✓" : phase === "error" ? "⚠" : "↑"}
          </span>
          <span className={styles.title}>
            {phase === "ready"
              ? "Mise à jour prête"
              : phase === "error"
                ? "Erreur de mise à jour"
                : phase === "downloading"
                  ? "Téléchargement..."
                  : "Mise à jour disponible"}
          </span>
        </div>
        {phase !== "downloading" && (
          <button className={styles.close} onClick={dismiss}>
            ×
          </button>
        )}
      </div>

      <div className={styles.version}>
        {phase === "error"
          ? errorMsg
          : `Version ${update.version} est disponible.`}
      </div>

      {phase === "downloading" && (
        <>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${progress}%` }} />
          </div>
          <div className={styles.statusText}>{progress}%</div>
        </>
      )}

      <div className={styles.actions}>
        {phase === "available" && (
          <>
            <button className={styles.btnPrimary} onClick={handleUpdate}>
              Mettre à jour
            </button>
            <button className={styles.btnSecondary} onClick={dismiss}>
              Plus tard
            </button>
          </>
        )}
        {phase === "ready" && (
          <button className={styles.btnPrimary} onClick={handleRelaunch}>
            Redémarrer maintenant
          </button>
        )}
        {phase === "error" && (
          <button className={styles.btnPrimary} onClick={handleUpdate}>
            Réessayer
          </button>
        )}
      </div>
    </div>
  );
}
