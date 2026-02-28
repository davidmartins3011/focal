import { invoke } from "@tauri-apps/api/core";
import type { Integration, IntegrationRule } from "../types";

export function getIntegrations(): Promise<Integration[]> {
  return invoke<Integration[]>("get_integrations");
}

export function updateIntegrationConnection(
  id: string,
  connected: boolean,
): Promise<Integration> {
  return invoke<Integration>("update_integration_connection", { id, connected });
}

export function updateIntegrationContext(
  id: string,
  rules: IntegrationRule[],
  extraContext: string,
): Promise<Integration> {
  return invoke<Integration>("update_integration_context", { id, rules, extraContext });
}
