import { useState, useEffect } from "react";
import styles from "./ProfileView.module.css";
import type { UserProfile } from "../types";
import { SOURCE_LABELS, LABELS } from "../data/profileLabels";
import { ProfileSection, ProfileField, ProfileList } from "./ProfileField";
import ProfileEditForm from "./ProfileEditForm";
import { getProfile, updateProfile } from "../services/profile";

export default function ProfileView() {
  const [profile, setProfile] = useState<UserProfile>({});
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<UserProfile>({});

  useEffect(() => {
    getProfile()
      .then(setProfile)
      .catch((err) => console.error("[ProfileView] getProfile error:", err));
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
    updateProfile(toSave);
    setIsEditing(false);
    setEditForm({});
  };

  const updateForm = <K extends keyof UserProfile>(key: K, value: UserProfile[K]) => {
    setEditForm((prev) => ({ ...prev, [key]: value }));
  };

  const hasAnyData = Object.keys(profile).some((k) => {
    const v = profile[k as keyof UserProfile];
    if (v === undefined || v === "") return false;
    if (Array.isArray(v) && v.length === 0) return false;
    if (typeof v === "object" && v !== null && Object.keys(v).length === 0) return false;
    return true;
  });

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <div>
            <div className={styles.avatar}>
              {(isEditing ? editForm.firstName : profile.firstName) ? (
                (isEditing ? editForm.firstName : profile.firstName)!.charAt(0).toUpperCase()
              ) : (
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
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
              <button className={styles.editBtn} onClick={startEditing} type="button">Modifier</button>
            )
          ) : (
            <div className={styles.editActions}>
              <button className={styles.cancelBtn} onClick={cancelEditing} type="button">Annuler</button>
              <button className={styles.saveBtn} onClick={saveEditing} type="button">Enregistrer</button>
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
        <ProfileEditForm
          editForm={editForm}
          onUpdate={updateForm}
          onSave={saveEditing}
          onCancel={cancelEditing}
        />
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
              <ProfileField label="Recherche de profil public" value={profile.profileResearch ? "Oui" : "Non"} />
            )}
            {profile.profileResearchSources && profile.profileResearchSources.length > 0 && (
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Sources à consulter</span>
                <ul className={styles.sourcesViewList}>
                  {profile.profileResearchSources.map((src, i) => (
                    <li key={i} className={styles.sourceViewItem}>
                      <span className={styles.sourceType}>{SOURCE_LABELS[src.source] || src.source}</span>
                      {src.sourceUrl ? (
                        <a href={src.sourceUrl} target="_blank" rel="noopener noreferrer" className={styles.sourceLink}>
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
            {profile.publicProfileSummary && (
              <ProfileField label="Résumé du profil public" value={profile.publicProfileSummary} />
            )}
          </ProfileSection>

          <ProfileSection title="Ton fonctionnement" icon="🧠">
            <ProfileField label="TDAH" value={profile.adhdRecognition ? LABELS.adhdRecognition[profile.adhdRecognition] : undefined} />
            <ProfileList label="Ce qui te bloque le plus" items={profile.blockers?.map((b) => LABELS.blockers[b]) ?? []} />
            <ProfileField label="Préférence rappels" value={profile.remindersPreference ? LABELS.remindersPreference[profile.remindersPreference] : undefined} />
            <ProfileField label="Horizon d'organisation" value={profile.organizationHorizon ? LABELS.organizationHorizon[profile.organizationHorizon] : undefined} />
            <ProfileField label="Attente principale" value={profile.mainExpectation ? LABELS.mainExpectation[profile.mainExpectation] : undefined} />
            <ProfileField label="Info importante" value={profile.extraInfo} />
          </ProfileSection>
        </div>
      )}
    </div>
  );
}
