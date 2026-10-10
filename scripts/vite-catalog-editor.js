import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OVERRIDES = path.join(ROOT, "public", "data", "overrides.json");

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function overrideCount(raw) {
  if (!raw || typeof raw !== "object") return 0;
  return Object.keys(raw.dishes ?? {}).length + Object.keys(raw.recipes ?? {}).length;
}

async function git(args) {
  return execFileAsync("git", args, { cwd: ROOT, timeout: 60000 });
}

export function catalogEditorPlugin() {
  return {
    name: "dishnext-catalog-editor",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split("?")[0] ?? "";
        if (!url.startsWith("/__catalog/")) return next();

        if (url === "/__catalog/status" && req.method === "GET") {
          let count = 0;
          try {
            count = overrideCount(JSON.parse(fs.readFileSync(OVERRIDES, "utf8")));
          } catch {
            count = 0;
          }
          let gitOk = false;
          try {
            await git(["rev-parse", "--is-inside-work-tree"]);
            gitOk = true;
          } catch {
            gitOk = false;
          }
          send(res, 200, { writable: true, git: gitOk, overrideCount: count });
          return;
        }

        if (url === "/__catalog/save" && req.method === "POST") {
          try {
            const parsed = JSON.parse(await readBody(req));
            const payload = {
              version: 1,
              updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
              dishes: parsed.dishes && typeof parsed.dishes === "object" ? parsed.dishes : {},
              recipes: parsed.recipes && typeof parsed.recipes === "object" ? parsed.recipes : {}
            };
            fs.mkdirSync(path.dirname(OVERRIDES), { recursive: true });
            fs.writeFileSync(OVERRIDES, JSON.stringify(payload, null, 2) + "\n", "utf8");
            send(res, 200, {
              ok: true,
              message: "Правки записаны в public/data/overrides.json",
              overrideCount: overrideCount(payload)
            });
          } catch (err) {
            send(res, 400, { ok: false, message: err instanceof Error ? err.message : "Некорректный JSON" });
          }
          return;
        }

        if (url === "/__catalog/publish" && req.method === "POST") {
          try {
            await git(["add", "--", "public/data/overrides.json"]);
            const { stdout: porcelain } = await git(["status", "--porcelain", "--", "public/data/overrides.json"]);
            if (!porcelain.trim()) {
              send(res, 200, {
                ok: true,
                committed: false,
                pushed: false,
                message: "Новых правок в файле нет — пушить нечего."
              });
              return;
            }
            await git(["commit", "-m", "Fix dish translations from the catalog editor."]);
            await git(["push", "origin", "HEAD"]);
            send(res, 200, {
              ok: true,
              committed: true,
              pushed: true,
              message: "Правки ушли в git. Vercel соберёт сайт за полминуты."
            });
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            send(res, 500, { ok: false, message: message.slice(0, 400) });
          }
          return;
        }

        next();
      });
    }
  };
}
