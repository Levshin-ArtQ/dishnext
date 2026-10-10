import type { CatalogOverrides } from "../domain/overrides";
import { normalizeOverrides } from "../domain/overrides";

export type EditorStatus = {
  writable: boolean;
  overrideCount: number;
  git: boolean;
};

export type PublishResult = {
  ok: boolean;
  message: string;
  committed?: boolean;
  pushed?: boolean;
};

async function parseJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { message: text.slice(0, 200) };
  }
}

export async function fetchEditorStatus(): Promise<EditorStatus> {
  try {
    const res = await fetch("/__catalog/status", { cache: "no-store" });
    if (!res.ok) return { writable: false, overrideCount: 0, git: false };
    const data = await parseJson(res);
    return {
      writable: data.writable === true,
      overrideCount: typeof data.overrideCount === "number" ? data.overrideCount : 0,
      git: data.git === true
    };
  } catch {
    return { writable: false, overrideCount: 0, git: false };
  }
}

export async function saveOverrides(overrides: CatalogOverrides): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch("/__catalog/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(overrides)
    });
    const data = await parseJson(res);
    if (!res.ok) {
      return { ok: false, message: String(data.message ?? "Не удалось записать файл") };
    }
    return { ok: true, message: String(data.message ?? "Записано") };
  } catch {
    return { ok: false, message: "Локальный сервер не отвечает. Запустите npm start на компьютере." };
  }
}

export async function publishOverrides(): Promise<PublishResult> {
  try {
    const res = await fetch("/__catalog/publish", { method: "POST" });
    const data = await parseJson(res);
    return {
      ok: res.ok && data.ok === true,
      message: String(data.message ?? (res.ok ? "Отправлено" : "Не удалось выложить")),
      committed: data.committed === true,
      pushed: data.pushed === true
    };
  } catch {
    return { ok: false, message: "Локальный сервер не отвечает." };
  }
}

export async function loadOverridesFile(): Promise<CatalogOverrides> {
  try {
    const res = await fetch("/data/overrides.json", { cache: "no-cache" });
    if (!res.ok) return normalizeOverrides(null);
    return normalizeOverrides((await res.json()) as CatalogOverrides);
  } catch {
    return normalizeOverrides(null);
  }
}
