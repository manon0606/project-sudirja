import { apiFetch } from "@/lib/api-client";
import type { DashboardDTO } from "@/lib/dashboard-types";

export function getDashboard(range: "7" | "30" | "year" = "7"): Promise<DashboardDTO> {
  return apiFetch(`/api/backoffice-sudirja/dashboard?range=${range}`);
}
