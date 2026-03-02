import { useState } from "react";
import styles from "./ProfileView.module.css";
import type { UserProfile, ProfileResearchSource } from "../types";
import {
  SOURCE_LABELS,
  LABELS,
  BLOCKER_KEYS,
  MAIN_CONTEXT_KEYS,
  ADHD_KEYS,
  REMINDERS_KEYS,
  HORIZON_KEYS,
  EXPECTATION_KEYS,
} from "../data/profileLabels";
import { ProfileSection, FormField } from "./ProfileField";
import { analyzeProfileUrl } from "../services/chat";

interface Props {
  editForm: UserProfile;
  onUpdate: <K extends keyof UserProfile>(key: K, value: UserProfile[K]) => void;
  onSave: () => void;
  onCancel: () => void;
}

export default function ProfileEditForm({ editForm, onUpdate, onSave, onCancel }: Props) {
  const sources = editForm.profileResearchSources ?? [];
  const [analyzingIndex, setAnalyzingIndex] = useState<number | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const addSource = () => {
    onUpdate("profileResearchSources", [...sources, { source: "linkedin" as const }]);
  };

  const updateSource = (index: number, updates: Partial<ProfileResearchSource>) => {
    const next = [...sources];
    next[index] = { ...next[index], ...updates };
    onUpdate("profileResearchSources", next);
  };

  const removeSource = (index: number) => {
    onUpdate("profileResearchSources", sources.filter((_, i) => i !== index));
  };

  const analyzeSource = (index: number) => {
    const src = sources[index];
    if (!src?.sourceUrl?.trim()) return;

    setAnalyzingIndex(index);
    setAnalyzeError(null);

    analyzeProfileUrl(src.sourceUrl)
      .then((result) => {
        const existing = editForm.publicProfileSummary ?? "";
        const newSummary = existing
          ? `${existing}\n\n--- ${SOURCE_LABELS[src.source] || src.source} ---\n${result.summary}`
          : `--- ${SOURCE_LABELS[src.source] || src.source} ---\n${result.summary}`;
        onUpdate("publicProfileSummary", newSummary);

        const next = [...(editForm.profileResearchSources ?? [])];
        next[index] = { ...next[index], scrapedAt: new Date().toISOString() };
        onUpdate("profileResearchSources", next);

        setAnalyzingIndex(null);
      })
      .catch((err) => {
        setAnalyzeError(typeof err === "string" ? err : String(err));
        setAnalyzingIndex(null);
      });
  };

  const toggleBlocker = (key: (typeof BLOCKER_KEYS)[number]) => {
    const current = editForm.blockers ?? [];
    const next = current.includes(key)
      ? current.filter((b) => b !== key)
      : [...current, key].slice(0, 2);
    onUpdate("blockers", next);
  };

  const inputClass = `${styles.input} ${styles.inputText}`;
  const selectClass = `${styles.input} ${styles.inputSelect}`;

  return (
    <form
      className={styles.editForm}
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      <ProfileSection title="Te connaître" icon="👋">
        <FormField label="Prénom (ou pseudo)">
          <input
            type="text"
            className={inputClass}
            value={editForm.firstName ?? ""}
            onChange={(e) => onUpdate("firstName", e.target.value)}
            placeholder="Comment tu t'appelles ?"
          />
        </FormField>
        <FormField label="Contexte principal">
          <select
            className={selectClass}
            value={editForm.mainContext ?? ""}
            onChange={(e) =>
              onUpdate("mainContext", (e.target.value || undefined) as UserProfile["mainContext"])
            }
          >
            <option value="">— Choisir —</option>
            {MAIN_CONTEXT_KEYS.map((k) => (
              <option key={k} value={k}>{LABELS.mainContext[k]}</option>
            ))}
          </select>
          {editForm.mainContext === "autre" && (
            <input
              type="text"
              className={inputClass}
              value={editForm.mainContextOther ?? ""}
              onChange={(e) => onUpdate("mainContextOther", e.target.value)}
              placeholder="Décris ton contexte"
              style={{ marginTop: 8 }}
            />
          )}
        </FormField>
        <FormField label="Métier / activité principale">
          <input
            type="text"
            className={inputClass}
            value={editForm.jobActivity ?? ""}
            onChange={(e) => onUpdate("jobActivity", e.target.value)}
            placeholder="Ex : développeur, PM, parent au foyer + freelance"
          />
        </FormField>
        <FormField label="Recherche de profil public (LinkedIn, site web…)">
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={editForm.profileResearch ?? false}
              onChange={(e) => onUpdate("profileResearch", e.target.checked)}
            />
            Oui, je souhaite que l'outil regarde mon activité publique
          </label>
        </FormField>
        {(editForm.profileResearchSources?.length !== undefined || editForm.profileResearch) && (
          <FormField label="Sources à consulter (LinkedIn, site web…)">
            <div className={styles.sourcesList}>
              {sources.map((src, i) => (
                <div key={i} className={styles.sourceRow}>
                  <select
                    className={`${selectClass} ${styles.sourceSelect}`}
                    value={src.source}
                    onChange={(e) =>
                      updateSource(i, { source: e.target.value as ProfileResearchSource["source"] })
                    }
                  >
                    {(["linkedin", "site_web", "entreprise", "autre"] as const).map((k) => (
                      <option key={k} value={k}>{SOURCE_LABELS[k]}</option>
                    ))}
                  </select>
                  <input
                    type="url"
                    className={`${inputClass} ${styles.sourceUrl}`}
                    value={src.sourceUrl ?? ""}
                    onChange={(e) => updateSource(i, { sourceUrl: e.target.value || undefined })}
                    placeholder={
                      src.source === "linkedin"
                        ? "https://linkedin.com/in/..."
                        : src.source === "site_web"
                          ? "https://monsite.com"
                          : "URL"
                    }
                  />
                  <button
                    type="button"
                    className={`${styles.analyzeBtn} ${analyzingIndex === i ? styles.analyzeBtnLoading : ""}`}
                    onClick={() => analyzeSource(i)}
                    disabled={!src.sourceUrl?.trim() || analyzingIndex !== null}
                    title={src.scrapedAt ? `Analysé le ${new Date(src.scrapedAt).toLocaleDateString()}` : "Analyser ce profil"}
                    aria-label="Analyser"
                  >
                    {analyzingIndex === i ? (
                      <span className={styles.analyzeSpinner} />
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                      </svg>
                    )}
                  </button>
                  <button
                    type="button"
                    className={styles.removeSourceBtn}
                    onClick={() => removeSource(i)}
                    title="Supprimer"
                    aria-label="Supprimer la source"
                  >
                    ×
                  </button>
                </div>
              ))}
              {analyzeError && (
                <div className={styles.analyzeError}>{analyzeError}</div>
              )}
              <button type="button" className={styles.addSourceBtn} onClick={addSource}>
                + Ajouter une source
              </button>
            </div>
          </FormField>
        )}
        {editForm.publicProfileSummary && (
          <FormField label="Résumé de ton profil public (généré par l'IA)">
            <textarea
              className={`${styles.input} ${styles.textarea}`}
              value={editForm.publicProfileSummary}
              onChange={(e) => onUpdate("publicProfileSummary", e.target.value)}
              rows={4}
            />
          </FormField>
        )}
      </ProfileSection>

      <ProfileSection title="Ton fonctionnement" icon="🧠">
        <FormField label="Te reconnais-tu dans le TDAH ?">
          <select
            className={selectClass}
            value={editForm.adhdRecognition ?? ""}
            onChange={(e) =>
              onUpdate("adhdRecognition", (e.target.value || undefined) as UserProfile["adhdRecognition"])
            }
          >
            <option value="">— Choisir —</option>
            {ADHD_KEYS.map((k) => (
              <option key={k} value={k}>{LABELS.adhdRecognition[k]}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Ce qui te bloque le plus (1 ou 2 max)">
          <div className={styles.checkboxGroup}>
            {BLOCKER_KEYS.map((k) => (
              <label key={k} className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={editForm.blockers?.includes(k) ?? false}
                  onChange={() => toggleBlocker(k)}
                />
                {LABELS.blockers[k]}
              </label>
            ))}
          </div>
        </FormField>
        <FormField label="Pour t'aider, tu préfères">
          <select
            className={selectClass}
            value={editForm.remindersPreference ?? ""}
            onChange={(e) =>
              onUpdate("remindersPreference", (e.target.value || undefined) as UserProfile["remindersPreference"])
            }
          >
            <option value="">— Choisir —</option>
            {REMINDERS_KEYS.map((k) => (
              <option key={k} value={k}>{LABELS.remindersPreference[k]}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Tu veux surtout t'organiser sur">
          <select
            className={selectClass}
            value={editForm.organizationHorizon ?? ""}
            onChange={(e) =>
              onUpdate("organizationHorizon", (e.target.value || undefined) as UserProfile["organizationHorizon"])
            }
          >
            <option value="">— Choisir —</option>
            {HORIZON_KEYS.map((k) => (
              <option key={k} value={k}>{LABELS.organizationHorizon[k]}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Tu attends surtout que l'outil">
          <select
            className={selectClass}
            value={editForm.mainExpectation ?? ""}
            onChange={(e) =>
              onUpdate("mainExpectation", (e.target.value || undefined) as UserProfile["mainExpectation"])
            }
          >
            <option value="">— Choisir —</option>
            {EXPECTATION_KEYS.map((k) => (
              <option key={k} value={k}>{LABELS.mainExpectation[k]}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Une chose importante à savoir (optionnel)">
          <textarea
            className={`${styles.input} ${styles.textarea}`}
            value={editForm.extraInfo ?? ""}
            onChange={(e) => onUpdate("extraInfo", e.target.value)}
            placeholder="Quelque chose d'important sur ton fonctionnement…"
            rows={3}
          />
        </FormField>
      </ProfileSection>

      <div className={styles.formFooter}>
        <button className={styles.cancelBtn} onClick={onCancel} type="button">Annuler</button>
        <button className={styles.saveBtn} type="submit">Enregistrer</button>
      </div>
    </form>
  );
}
