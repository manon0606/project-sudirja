"use client";

import { useSyncExternalStore } from "react";

type User = {
  username: string;
  role: "kasir" | "manajemen";
  fullName: string;
};

const DEFAULT_USER: User = { username: "", role: "manajemen", fullName: "" };

const EMPTY_SUBSCRIBE = () => () => {};

// Snapshot must be referentially stable between calls or useSyncExternalStore
// loops forever. We cache the parsed result and only rebuild when the raw
// localStorage value actually changes (login/logout).
let cachedRaw: string | null = null;
let cachedUser: User = DEFAULT_USER;

function readUser(): User {
  let raw: string;
  try {
    raw = localStorage.getItem("sudirja-user") || localStorage.getItem("user") || "{}";
  } catch {
    return DEFAULT_USER;
  }

  if (raw === cachedRaw) return cachedUser;

  try {
    const parsed = JSON.parse(raw);
    cachedUser = {
      username: parsed.username || "",
      role: parsed.role === "kasir" ? "kasir" : "manajemen",
      fullName: parsed.fullName || "",
    };
  } catch {
    cachedUser = DEFAULT_USER;
  }
  cachedRaw = raw;
  return cachedUser;
}

function getSnapshot(): User {
  return readUser();
}

export function useUser(): User {
  return useSyncExternalStore(EMPTY_SUBSCRIBE, getSnapshot, () => DEFAULT_USER);
}
