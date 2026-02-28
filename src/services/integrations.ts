import { invoke } from "@tauri-apps/api/core";
import type {
  Integration,
  IntegrationRule,
  OAuthCredentialsInfo,
  CalendarEvent,
  EmailMessage,
} from "../types";

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

// ─── OAuth ───

export function getOAuthCredentials(provider: string): Promise<OAuthCredentialsInfo> {
  return invoke<OAuthCredentialsInfo>("get_oauth_credentials", { provider });
}

export function setOAuthCredentials(
  provider: string,
  clientId: string,
  clientSecret: string,
): Promise<void> {
  return invoke("set_oauth_credentials", { provider, clientId, clientSecret });
}

export function startOAuth(integrationId: string): Promise<void> {
  return invoke("start_oauth", { integrationId });
}

export function disconnectIntegration(integrationId: string): Promise<Integration> {
  return invoke<Integration>("disconnect_integration", { integrationId });
}

// ─── Data fetching ───

export function fetchCalendarEvents(
  integrationId: string,
  dateFrom: string,
  dateTo: string,
): Promise<CalendarEvent[]> {
  return invoke<CalendarEvent[]>("fetch_calendar_events", { integrationId, dateFrom, dateTo });
}

export function fetchEmails(
  integrationId: string,
  query?: string,
  maxResults?: number,
): Promise<EmailMessage[]> {
  return invoke<EmailMessage[]>("fetch_emails", { integrationId, query, maxResults });
}
