import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  hasSupabaseManualEventsConfig,
  readManualEventsPayloadFromSupabase,
} from "./manual-macro-events-store.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(__dirname, "..");
const manualEventsPath = resolve(appRoot, "data", "manual-macro-events.json");

async function writeJsonAtomic(path, payload) {
  await mkdir(dirname(path), { recursive: true });
  const tempPath = `${path}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await rename(tempPath, path);
}

if (!hasSupabaseManualEventsConfig()) {
  console.log("Supabase manual event sync skipped: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not configured.");
  process.exit(0);
}

const payload = await readManualEventsPayloadFromSupabase();
await writeJsonAtomic(manualEventsPath, payload);
console.log(`Synced ${payload.events.length} manual macro event(s) from Supabase.`);
