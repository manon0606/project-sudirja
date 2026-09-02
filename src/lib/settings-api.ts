import { apiFetch } from "@/lib/api-client";
import type { ApiKeyGeneratedDTO, SettingsDTO } from "@/lib/settings-types";

export function getSettings(): Promise<SettingsDTO> {
  return apiFetch("/api/backoffice-sudirja/settings");
}

export function setOnline(isOnline: boolean): Promise<SettingsDTO> {
  return apiFetch("/api/backoffice-sudirja/settings", {
    method: "PATCH",
    body: JSON.stringify({ isOnline }),
  });
}

export function regenerateApiKey(): Promise<ApiKeyGeneratedDTO> {
  return apiFetch("/api/backoffice-sudirja/settings", {
    method: "PATCH",
    body: JSON.stringify({ regenerate: true }),
  });
}
