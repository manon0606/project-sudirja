"use client";

import { useSyncExternalStore } from "react";

export type AccessUser = {
  username: string;
  fullName: string;
  /** Kode role dinamis (dari user profil terkait). */
  role: string;
  /** Label role. */
  roleLabel: string;
  /** Daftar kode fitur yang boleh diakses. */
  permissions: string[];
  isSuperadmin: boolean;
  adminId: number;
};

const DEFAULT_USER: AccessUser = {
  username: "",
  fullName: "",
  role: "superadmin",
  roleLabel: "Super Admin",
  permissions: [],
  isSuperadmin: true,
  adminId: 0,
};

const EMPTY_SUBSCRIBE = () => () => {};

// Snapshot must be referentially stable between calls or useSyncExternalStore
// loops forever. We cache the parsed result and only rebuild when the raw
// localStorage value actually changes (login/logout).
let cachedRaw: string | null = null;
let cachedUser: AccessUser = DEFAULT_USER;

function readUser(): AccessUser {
  let raw: string;
  try {
    raw = localStorage.getItem("sudirja-user") || localStorage.getItem("user") || "{}";
  } catch {
    return DEFAULT_USER;
  }

  if (raw === cachedRaw) return cachedUser;

  try {
    const parsed = JSON.parse(raw);
    const role = typeof parsed.role === "string" && parsed.role ? parsed.role : "superadmin";
    cachedUser = {
      username: parsed.username || "",
      fullName: parsed.fullName || "",
      role,
      roleLabel: parsed.roleLabel || role,
      permissions: Array.isArray(parsed.permissions) ? parsed.permissions : [],
      isSuperadmin: parsed.isSuperadmin === true || role === "superadmin",
      adminId: Number(parsed.adminId) || 0,
    };
  } catch {
    cachedUser = DEFAULT_USER;
  }
  cachedRaw = raw;
  return cachedUser;
}

function getSnapshot(): AccessUser {
  return readUser();
}

export function useUser(): AccessUser {
  return useSyncExternalStore(EMPTY_SUBSCRIBE, getSnapshot, () => DEFAULT_USER);
}
