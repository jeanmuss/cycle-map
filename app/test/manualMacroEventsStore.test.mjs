import assert from "node:assert/strict";
import test from "node:test";

import {
  hasSupabaseManualEventsConfig,
  manualEventsCanonicalWriteAvailable,
  manualEventsStoreMode,
  readManualEventsPayloadFromSupabase,
} from "../scripts/manual-macro-events-store.mjs";

const ENV_NAMES = ["SUPABASE_URL", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"];

function withSupabaseEnv(values, callback) {
  const previous = Object.fromEntries(ENV_NAMES.map((name) => [name, process.env[name]]));
  for (const name of ENV_NAMES) delete process.env[name];
  Object.assign(process.env, values);
  try {
    callback();
  } finally {
    for (const name of ENV_NAMES) {
      if (previous[name] == null) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
}

test("the repository manual-event snapshot is read-only without Supabase", () => {
  withSupabaseEnv({}, () => {
    assert.equal(hasSupabaseManualEventsConfig(), false);
    assert.equal(manualEventsCanonicalWriteAvailable(), false);
    assert.equal(manualEventsStoreMode(), "local-snapshot-readonly");
  });
});

test("the new Supabase secret key enables the canonical store", () => {
  withSupabaseEnv({
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SECRET_KEY: "sb_secret_test-only",
  }, () => {
    assert.equal(hasSupabaseManualEventsConfig(), true);
    assert.equal(manualEventsCanonicalWriteAvailable(), true);
    assert.equal(manualEventsStoreMode(), "supabase-canonical");
  });
});

test("the legacy service-role key remains a migration fallback", () => {
  withSupabaseEnv({
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "legacy-test-only",
  }, () => {
    assert.equal(hasSupabaseManualEventsConfig(), true);
    assert.equal(manualEventsStoreMode(), "supabase-canonical");
  });
});

test("opaque Supabase keys use apikey without an invalid bearer header", async () => {
  const previous = Object.fromEntries(ENV_NAMES.map((name) => [name, process.env[name]]));
  const originalFetch = globalThis.fetch;
  let requestHeaders;
  try {
    for (const name of ENV_NAMES) delete process.env[name];
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SECRET_KEY = "sb_secret_test-only";
    globalThis.fetch = async (_url, options) => {
      requestHeaders = options.headers;
      return { ok: true, text: async () => "[]" };
    };
    await readManualEventsPayloadFromSupabase();
    assert.equal(requestHeaders.apikey, "sb_secret_test-only");
    assert.equal("Authorization" in requestHeaders, false);
  } finally {
    globalThis.fetch = originalFetch;
    for (const name of ENV_NAMES) {
      if (previous[name] == null) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
});
