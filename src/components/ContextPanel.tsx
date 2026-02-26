import type { Integration, IntegrationRule } from "../types";
import ScoreSelector from "./ScoreSelector";
import styles from "./IntegrationsView.module.css";

interface Props {
  integration: Integration;
  onBack: () => void;
  onUpdate: (updated: Integration) => void;
}

export default function ContextPanel({ integration, onBack, onUpdate }: Props) {
  const { context } = integration;

  const addRule = () => {
    const newRule: IntegrationRule = {
      id: crypto.randomUUID(),
      text: "",
      urgency: 3,
      importance: 3,
    };
    onUpdate({
      ...integration,
      context: { ...context, rules: [...context.rules, newRule] },
    });
  };

  const updateRule = (ruleId: string, patch: Partial<IntegrationRule>) => {
    onUpdate({
      ...integration,
      context: {
        ...context,
        rules: context.rules.map((r) =>
          r.id === ruleId ? { ...r, ...patch } : r
        ),
      },
    });
  };

  const deleteRule = (ruleId: string) => {
    onUpdate({
      ...integration,
      context: {
        ...context,
        rules: context.rules.filter((r) => r.id !== ruleId),
      },
    });
  };

  const setExtraContext = (extraContext: string) => {
    onUpdate({
      ...integration,
      context: { ...context, extraContext },
    });
  };

  return (
    <div className={styles.contextPanel}>
      <header className={styles.contextHeader}>
        <button className={styles.backBtn} onClick={onBack}>
          ← Retour
        </button>
        <div className={styles.contextTitle}>
          <span className={styles.contextIcon}>{integration.icon}</span>
          <div>
            <h2 className={styles.contextName}>{integration.name}</h2>
            <p className={styles.contextSub}>Contexte &amp; règles pour l'IA</p>
          </div>
        </div>
      </header>

      <div className={styles.contextContent}>
        <section className={styles.contextSection}>
          <div className={styles.contextSectionHead}>
            <h3 className={styles.contextSectionTitle}>
              Rules
              <span className={styles.ruleCount}>{context.rules.length}</span>
            </h3>
            <button className={styles.addRuleBtn} onClick={addRule}>
              + Ajouter une règle
            </button>
          </div>
          <p className={styles.contextHint}>
            Décris en langage naturel comment focal doit interagir avec {integration.name}.
          </p>

          {context.rules.length === 0 ? (
            <div className={styles.emptyRules}>
              <p>Aucune règle définie.</p>
              <button className={styles.addRuleEmptyBtn} onClick={addRule}>
                Créer ta première règle
              </button>
            </div>
          ) : (
            <div className={styles.rulesList}>
              {context.rules.map((rule, idx) => (
                <div key={rule.id} className={styles.ruleCard}>
                  <div className={styles.ruleTop}>
                    <span className={styles.ruleIndex}>#{idx + 1}</span>
                    <button
                      className={styles.ruleDeleteBtn}
                      onClick={() => deleteRule(rule.id)}
                      title="Supprimer"
                    >
                      ×
                    </button>
                  </div>
                  <textarea
                    className={styles.ruleTextarea}
                    value={rule.text}
                    onChange={(e) => updateRule(rule.id, { text: e.target.value })}
                    placeholder="Ex : Ne jamais planifier de réunions avant 10h du matin..."
                    rows={2}
                  />
                  <div className={styles.ruleScores}>
                    <ScoreSelector
                      label="Urgence"
                      value={rule.urgency}
                      onChange={(v) => updateRule(rule.id, { urgency: v })}
                      color="urgency"
                    />
                    <ScoreSelector
                      label="Importance"
                      value={rule.importance}
                      onChange={(v) => updateRule(rule.id, { importance: v })}
                      color="importance"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={styles.contextSection}>
          <h3 className={styles.contextSectionTitle}>Extra Contexte</h3>
          <p className={styles.contextHint}>
            Informations supplémentaires que l'IA doit prendre en compte pour cette intégration.
          </p>
          <textarea
            className={styles.extraContextArea}
            value={context.extraContext}
            onChange={(e) => setExtraContext(e.target.value)}
            placeholder={`Ex : Mon compte ${integration.name} est utilisé principalement pour le projet X. Les contacts VIP sont...`}
            rows={5}
          />
        </section>
      </div>
    </div>
  );
}
