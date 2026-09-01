import { apiFetch } from "@/lib/api-client";
import type {
  BulkUserResult,
  CreateUserInput,
  UpdateUserInput,
  UserDTO,
  UserListResponse,
} from "@/lib/user-types";

export interface UserListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  role?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

function qs(p: UserListParams): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) {
    if (v !== undefined && v !== "") q.set(k, String(v));
  }
  return q.toString();
}

export function listUsers(p: UserListParams = {}): Promise<UserListResponse> {
  const q = qs(p);
  return apiFetch(`/api/backoffice-sudirja/users${q ? `?${q}` : ""}`);
}

export function getUser(id: number): Promise<UserDTO> {
  return apiFetch(`/api/backoffice-sudirja/users/${id}`);
}

export function createUser(input: CreateUserInput): Promise<UserDTO> {
  return apiFetch("/api/backoffice-sudirja/users", { method: "POST", body: JSON.stringify(input) });
}

export function updateUser(id: number, input: UpdateUserInput): Promise<UserDTO> {
  return apiFetch(`/api/backoffice-sudirja/users/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteUser(id: number): Promise<{ message: string }> {
  return apiFetch(`/api/backoffice-sudirja/users/${id}`, { method: "DELETE" });
}

export function bulkCreateUsers(rows: CreateUserInput[]): Promise<BulkUserResult> {
  return apiFetch("/api/backoffice-sudirja/users/bulk", { method: "POST", body: JSON.stringify({ rows }) });
}

export function downloadUsersCsv(items: UserDTO[]): void {
  const headers = ["ID", "Username", "Nama", "Role", "Nomor HP", "Email", "Status"];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const body = items.map((u) =>
    [u.id, u.username, u.fullName, u.role, u.phone ?? "", u.email ?? "", u.isActive ? "Aktif" : "Nonaktif"].map(esc).join(","),
  );
  const blob = new Blob(["\uFEFF", [headers.join(","), ...body].join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `data-user-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
