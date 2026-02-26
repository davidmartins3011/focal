import { useState, useEffect } from "react";
import styles from "./ProfileView.module.css";
import type { UserProfile, ProfileResearchSource } from "../types";

/** Clé localStorage pour le profil (utilisée aussi par l'onboarding) */
export const PROFILE_STORAGE_KEY = "focal-user-profile";

const SOURCE_LABELS: Record<string, string> = {
  linkedin: "LinkedIn",
  site_web: "Site web",
  entreprise: "Entreprise",
  autre: "Autre",
};

const LABELS = {
  mainContext: {
    travail_salarie: "Travail salarié",
    independant: "Indépendant / entrepreneur",
    etudes: "Études / formation",
    parent: "Parent / famille",
    mix: "Mix de plusieurs rôles",
    autre: "Autre",
  },
  adhdRecognition: {
    diagnostique: "Oui, diagnostiqué",
    fortement: "Oui, fortement",
    un_peu: "Un peu",
    non: "Non / je ne sais pas",
  },
  blockers: {
    commencer: "Savoir par quoi commencer",
    oublier: "Ne pas oublier",
    agir: "Passer à l'action",
    finir: "Finir ce que je commence",
    trop_head: "Trop de choses en tête",
    motivation: "Manque de motivation",
  },
  remindersPreference: {
    clairs_frequents: "Des rappels clairs et fréquents",
    peu_choisis: "Peu de rappels mais bien choisis",
    minimum: "Le minimum possible",
    ca_depend: "Ça dépend des jours",
  },
  organizationHorizon: {
    aujourdhui: "Aujourd'hui",
    semaine: "La semaine",
    projets_longs: "Des projets longs",
    mix: "Un mix",
  },
  mainExpectation: {
    me_dire_quoi_faire: "Me dise quoi faire maintenant",
    prioriser: "M'aide à prioriser",
    allege_tete: "M'allège la tête",
    avancer_sans_pression: "M'aide à avancer sans pression",
    cadrer: "Me cadre un peu plus",
  },
} as const;

const BLOCKER_KEYS = ["commencer", "oublier", "agir", "finir", "trop_head", "motivation"] as const;
const MAIN_CONTEXT_KEYS = ["travail_salarie", "independant", "etudes", "parent", "mix", "autre"] as const;
const ADHD_KEYS = ["diagnostique", "fortement", "un_peu", "non"] as const;
const REMINDERS_KEYS = ["clairs_frequents", "peu_choisis", "minimum", "ca_depend"] as const;
const HORIZON_KEYS = ["aujourdhui", "semaine", "projets_longs", "mix"] as const;
const EXPECTATION_KEYS = ["me_dire_quoi_faire", "prioriser", "allege_tete", "avancer_sans_pression", "cadrer"] as const;

function loadProfile(): UserProfile {
  try {
    const stored = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!stored) return {};
    const parsed = JSON.parse(stored) as UserProfile & { profileResearchData?: { source: string; sourceUrl?: string } };
    // Migration: ancien format (objet unique) → nouveau format (tableau)
    if (parsed.profileResearchData && !parsed.profileResearchSources) {
      parsed.profileResearchSources = [{
        source: parsed.profileResearchData.source as ProfileResearchSource["source"],
        sourceUrl: parsed.profileResearchData.sourceUrl,
      }];
      delete (parsed as Record<string, unknown>).profileResearchData;
    }
    return parsed as UserProfile;
  } catch {
    return {};
  }
}

function saveProfile(profile: UserProfile) {
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
}

export default function ProfileView() {
  const [profile, setProfile] = useState<UserProfile>(loadProfile);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<UserProfile>({});

  useEffect(() => {
    setProfile(loadProfile());
  }, []);

  const startEditing = () => {
    const form = { ...profile };
    if (!form.profileResearchSources && form.profileResearch) {
      form.profileResearchSources = [];
    }
    setEditForm(form);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditForm({});
  };

  const saveEditing = () => {
    const toSave: UserProfile = {
      ...profile,
      ...editForm,
      // Nettoyer les champs vides
      firstName: editForm.firstName?.trim() || undefined,
      mainContextOther: editForm.mainContext === "autre" ? editForm.mainContextOther?.trim() : undefined,
      jobActivity: editForm.jobActivity?.trim() || undefined,
      extraInfo: editForm.extraInfo?.trim() || undefined,
      blockers: editForm.blockers?.length ? editForm.blockers : undefined,
    };
    if (editForm.profileResearchSources?.length) {
      toSave.profileResearchSources = editForm.profileResearchSources
        .map((s) => ({
          source: s.source,
          sourceUrl: s.sourceUrl?.trim() || undefined,
          scrapedAt: s.scrapedAt,
        }))
        .filter((s) => s.source);
    } else {
      toSave.profileResearchSources = undefined;
    }
    setProfile(toSave);
    saveProfile(toSave);
    setIsEditing(false);
    setEditForm({});
  };

  const updateForm = <K extends keyof UserProfile>(key: K, value: UserProfile[K]) => {
    setEditForm((prev) => ({ ...prev, [key]: value }));
  };

  const sources = editForm.profileResearchSources ?? [];
  const addSource = () => {
    updateForm("profileResearchSources", [...sources, { source: "linkedin" as const }]);
  };
  const updateSource = (index: number, updates: Partial<ProfileResearchSource>) => {
    const next = [...sources];
    next[index] = { ...next[index], ...updates };
    updateForm("profileResearchSources", next);
  };
  const removeSource = (index: number) => {
    updateForm("profileResearchSources", sources.filter((_, i) => i !== index));
  };

  const toggleBlocker = (key: (typeof BLOCKER_KEYS)[number]) => {
    const current = editForm.blockers ?? [];
    const next = current.includes(key)
      ? current.filter((b) => b !== key)
      : [...current, key].slice(0, 2); // max 2
    updateForm("blockers", next);
  };

  const hasAnyData = Object.keys(profile).some(
    (k) => {
      const v = profile[k as keyof UserProfile];
      if (v === undefined || v === "") return false;
      if (Array.isArray(v) && v.length === 0) return false;
      if (typeof v === "object" && v !== null && Object.keys(v).length === 0) return false;
      return true;
    }
  );

  const ProfileSection = ({
    title,
    icon,
    children,
  }: {
    title: string;
    icon: string;
    children: React.ReactNode;
  }) => (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>
        <span className={styles.sectionIcon}>{icon}</span>
        {title}
      </h2>
      {children}
    </section>
  );

  const ProfileField = ({
    label,
    value,
  }: {
    label: string;
    value: string | undefined;
  }) =>
    value ? (
      <div className={styles.field}>
        <span className={styles.fieldLabel}>{label}</span>
        <span className={styles.fieldValue}>{value}</span>
      </div>
    ) : null;

  const ProfileList = ({
    label,
    items,
  }: {
    label: string;
    items: string[];
  }) =>
    items?.length ? (
      <div className={styles.field}>
        <span className={styles.fieldLabel}>{label}</span>
        <ul className={styles.tagList}>
          {items.map((item) => (
            <li key={item} className={styles.tag}>
              {item}
            </li>
          ))}
        </ul>
      </div>
    ) : null;

  const FormField = ({
    label,
    children,
  }: {
    label: string;
    children: React.ReactNode;
  }) => (
    <div className={styles.formField}>
      <label className={styles.fieldLabel}>{label}</label>
      {children}
    </div>
  );

  const inputClass = `${styles.input} ${styles.inputText}`;
  const selectClass = `${styles.input} ${styles.inputSelect}`;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <div>
            <div className={styles.avatar}>
              {(isEditing ? editForm.firstName : profile.firstName) ? (
                (isEditing ? editForm.firstName : profile.firstName)!.charAt(0).toUpperCase()
              ) : (
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
                </svg>
              )}
            </div>
            <h1 className={styles.title}>
              {isEditing
                ? "Modifier mon profil"
                : (profile.firstName ? `Bonjour, ${profile.firstName}` : "Mon profil")}
            </h1>
          </div>
          {!isEditing ? (
            hasAnyData && (
              <button className={styles.editBtn} onClick={startEditing} type="button">
                Modifier
              </button>
            )
          ) : (
            <div className={styles.editActions}>
              <button className={styles.cancelBtn} onClick={cancelEditing} type="button">
                Annuler
              </button>
              <button className={styles.saveBtn} onClick={saveEditing} type="button">
                Enregistrer
              </button>
            </div>
          )}
        </div>
        <p className={styles.subtitle}>
          {hasAnyData
            ? "Ton profil aide l'assistant à te proposer des suggestions adaptées."
            : "Complète ton profil pour personnaliser ton expérience. Tu peux le modifier à tout moment."}
        </p>
      </div>

      {isEditing ? (
        <form
          className={styles.editForm}
          onSubmit={(e) => {
            e.preventDefault();
            saveEditing();
          }}
        >
          <ProfileSection title="Te connaître" icon="👋">
            <FormField label="Prénom (ou pseudo)">
              <input
                type="text"
                className={inputClass}
                value={editForm.firstName ?? ""}
                onChange={(e) => updateForm("firstName", e.target.value)}
                placeholder="Comment tu t'appelles ?"
              />
            </FormField>
            <FormField label="Contexte principal">
              <select
                className={selectClass}
                value={editForm.mainContext ?? ""}
                onChange={(e) =>
                  updateForm("mainContext", (e.target.value || undefined) as UserProfile["mainContext"])
                }
              >
                <option value="">— Choisir —</option>
                {MAIN_CONTEXT_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {LABELS.mainContext[k]}
                  </option>
                ))}
              </select>
              {editForm.mainContext === "autre" && (
                <input
                  type="text"
                  className={inputClass}
                  value={editForm.mainContextOther ?? ""}
                  onChange={(e) => updateForm("mainContextOther", e.target.value)}
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
                onChange={(e) => updateForm("jobActivity", e.target.value)}
                placeholder="Ex : développeur, PM, parent au foyer + freelance"
              />
            </FormField>
            <FormField label="Recherche de profil public (LinkedIn, site web…)">
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={editForm.profileResearch ?? false}
                  onChange={(e) => updateForm("profileResearch", e.target.checked)}
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
                        className={styles.removeSourceBtn}
                        onClick={() => removeSource(i)}
                        title="Supprimer"
                        aria-label="Supprimer la source"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className={styles.addSourceBtn}
                    onClick={addSource}
                  >
                    + Ajouter une source
                  </button>
                </div>
              </FormField>
            )}
          </ProfileSection>

          <ProfileSection title="Ton fonctionnement" icon="🧠">
            <FormField label="Te reconnais-tu dans le TDAH ?">
              <select
                className={selectClass}
                value={editForm.adhdRecognition ?? ""}
                onChange={(e) =>
                  updateForm("adhdRecognition", (e.target.value || undefined) as UserProfile["adhdRecognition"])
                }
              >
                <option value="">— Choisir —</option>
                {ADHD_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {LABELS.adhdRecognition[k]}
                  </option>
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
                  updateForm(
                    "remindersPreference",
                    (e.target.value || undefined) as UserProfile["remindersPreference"]
                  )
                }
              >
                <option value="">— Choisir —</option>
                {REMINDERS_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {LABELS.remindersPreference[k]}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Tu veux surtout t'organiser sur">
              <select
                className={selectClass}
                value={editForm.organizationHorizon ?? ""}
                onChange={(e) =>
                  updateForm(
                    "organizationHorizon",
                    (e.target.value || undefined) as UserProfile["organizationHorizon"]
                  )
                }
              >
                <option value="">— Choisir —</option>
                {HORIZON_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {LABELS.organizationHorizon[k]}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Tu attends surtout que l'outil">
              <select
                className={selectClass}
                value={editForm.mainExpectation ?? ""}
                onChange={(e) =>
                  updateForm(
                    "mainExpectation",
                    (e.target.value || undefined) as UserProfile["mainExpectation"]
                  )
                }
              >
                <option value="">— Choisir —</option>
                {EXPECTATION_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {LABELS.mainExpectation[k]}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Une chose importante à savoir (optionnel)">
              <textarea
                className={`${styles.input} ${styles.textarea}`}
                value={editForm.extraInfo ?? ""}
                onChange={(e) => updateForm("extraInfo", e.target.value)}
                placeholder="Quelque chose d'important sur ton fonctionnement…"
                rows={3}
              />
            </FormField>
          </ProfileSection>

          <div className={styles.formFooter}>
            <button className={styles.cancelBtn} onClick={cancelEditing} type="button">
              Annuler
            </button>
            <button className={styles.saveBtn} onClick={saveEditing} type="submit">
              Enregistrer
            </button>
          </div>
        </form>
      ) : !hasAnyData ? (
        <div className={styles.emptyState}>
          <p>Ton profil est vide pour l'instant.</p>
          <p className={styles.emptyHint}>
            Clique sur « Modifier » pour compléter ton profil. Tu pourras le modifier à tout moment.
          </p>
          <button className={styles.editBtn} onClick={startEditing} type="button">
            Compléter mon profil
          </button>
        </div>
      ) : (
        <div className={styles.content}>
          <ProfileSection title="Te connaître" icon="👋">
            <ProfileField label="Prénom" value={profile.firstName} />
            <ProfileField
              label="Contexte principal"
              value={
                profile.mainContext
                  ? profile.mainContext === "autre"
                    ? profile.mainContextOther || LABELS.mainContext.autre
                    : LABELS.mainContext[profile.mainContext]
                  : undefined
              }
            />
            <ProfileField label="Métier / activité" value={profile.jobActivity} />
            {profile.profileResearch !== undefined && (
              <ProfileField
                label="Recherche de profil public"
                value={profile.profileResearch ? "Oui" : "Non"}
              />
            )}
            {profile.profileResearchSources && profile.profileResearchSources.length > 0 && (
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Sources à consulter</span>
                <ul className={styles.sourcesViewList}>
                  {profile.profileResearchSources.map((src, i) => (
                    <li key={i} className={styles.sourceViewItem}>
                      <span className={styles.sourceType}>
                        {SOURCE_LABELS[src.source] || src.source}
                      </span>
                      {src.sourceUrl ? (
                        <a
                          href={src.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.sourceLink}
                        >
                          {src.sourceUrl}
                        </a>
                      ) : (
                        <span className={styles.sourceUrlPlaceholder}>—</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </ProfileSection>

          <ProfileSection title="Ton fonctionnement" icon="🧠">
            <ProfileField
              label="TDAH"
              value={
                profile.adhdRecognition
                  ? LABELS.adhdRecognition[profile.adhdRecognition]
                  : undefined
              }
            />
            <ProfileList
              label="Ce qui te bloque le plus"
              items={profile.blockers?.map((b) => LABELS.blockers[b]) ?? []}
            />
            <ProfileField
              label="Préférence rappels"
              value={
                profile.remindersPreference
                  ? LABELS.remindersPreference[profile.remindersPreference]
                  : undefined
              }
            />
            <ProfileField
              label="Horizon d'organisation"
              value={
                profile.organizationHorizon
                  ? LABELS.organizationHorizon[profile.organizationHorizon]
                  : undefined
              }
            />
            <ProfileField
              label="Attente principale"
              value={
                profile.mainExpectation
                  ? LABELS.mainExpectation[profile.mainExpectation]
                  : undefined
              }
            />
            <ProfileField label="Info importante" value={profile.extraInfo} />
          </ProfileSection>
        </div>
      )}
    </div>
  );
}
