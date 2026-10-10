import type { Favorite, Session, SessionSummary, TasteProfile } from "../types";
import { normalizeProfile } from "../domain/ranking";

const DB_NAME = "dishnext-private";
const DB_VERSION = 1;
const STORE = "kv";
const LS_PREFIX = "dishnext:";

let dbPromise: Promise<IDBDatabase | null> | null = null;
let useFallback = false;
const memory: Record<string, unknown> = {};

function openDB(): Promise<IDBDatabase | null> {
  if (useFallback) return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === "undefined") {
      useFallback = true;
      resolve(null);
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    const timer = window.setTimeout(() => {
      useFallback = true;
      resolve(null);
    }, 1200);
    const done = (db: IDBDatabase | null) => {
      window.clearTimeout(timer);
      resolve(db);
    };
    req.onerror = () => {
      useFallback = true;
      done(null);
    };
    req.onsuccess = () => done(req.result);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
  });
  return dbPromise;
}

async function get<T>(key: string): Promise<T | undefined> {
  const db = await openDB();
  if (!db || useFallback) {
    try {
      const raw = localStorage.getItem(LS_PREFIX + key);
      if (raw != null) return JSON.parse(raw) as T;
      return memory[key] as T | undefined;
    } catch {
      return memory[key] as T | undefined;
    }
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function set<T>(key: string, value: T): Promise<void> {
  const db = await openDB();
  if (!db || useFallback) {
    try {
      localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
    } catch {
      memory[key] = value;
    }
    return;
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function remove(key: string): Promise<void> {
  const db = await openDB();
  if (!db || useFallback) {
    localStorage.removeItem(LS_PREFIX + key);
    delete memory[key];
    return;
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export const storage = {
  backend(): "idb" | "local" | "memory" {
    if (!useFallback) return "idb";
    return typeof localStorage === "undefined" ? "memory" : "local";
  },
  getSession: () => get<Session>("session"),
  setSession: (session: Session | null) => (session ? set("session", session) : remove("session")),
  getProfile: async () => normalizeProfile(await get<TasteProfile>("profile")),
  setProfile: (profile: TasteProfile) => set("profile", profile),
  getFavorites: async () => (await get<Favorite[]>("favorites")) ?? [],
  setFavorites: (items: Favorite[]) => set("favorites", items),
  getHistory: async () => (await get<SessionSummary[]>("history")) ?? [],
  setHistory: (items: SessionSummary[]) => set("history", items),
  clearTaste: async () => {
    await remove("profile");
    await remove("history");
    await remove("session");
  },
  clearAll: async () => {
    await remove("profile");
    await remove("history");
    await remove("session");
    await remove("favorites");
  }
};
