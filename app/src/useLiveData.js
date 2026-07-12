import { useEffect, useMemo, useRef, useState } from "react";
import { appUrl } from "./data.js";

const MANIFEST_PATH = "data/data-manifest.json";
const DEFAULT_POLL_INTERVAL_MS = 300_000;
const MIN_POLL_INTERVAL_MS = 30_000;
const MAX_POLL_INTERVAL_MS = 3_600_000;

function initialData(definitions) {
  return Object.fromEntries(definitions.map((definition) => [definition.id, null]));
}

function normalizedInterval(value, fallback = DEFAULT_POLL_INTERVAL_MS) {
  const interval = Number(value);
  if (!Number.isFinite(interval)) return fallback;
  return Math.min(MAX_POLL_INTERVAL_MS, Math.max(MIN_POLL_INTERVAL_MS, interval));
}

function requestUrl(path, version) {
  const url = appUrl(path);
  if (!version) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${encodeURIComponent(version)}`;
}

function loadError(response) {
  const error = new Error("data-file");
  error.status = response.status;
  return error;
}

function publicError(error) {
  return { status: error?.status, message: error?.message || "data-file" };
}

function manifestVersion(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/i.test(value) ? value : null;
}

function manifestTimestamp(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : null;
}

function manifestFreshness(entry, clientCheckedAt) {
  return {
    observedAt: manifestTimestamp(entry?.observedAt),
    fetchedAt: manifestTimestamp(entry?.fetchedAt),
    transformedAt: manifestTimestamp(entry?.transformedAt),
    deployedAt: manifestTimestamp(entry?.deployedAt),
    clientCheckedAt,
    timestampFallback: entry?.timestampFallback === "legacy-generatedAt" ? "legacy-generatedAt" : null,
  };
}

export function useLiveData(definitions, { enabled = true } = {}) {
  const [data, setData] = useState(() => initialData(definitions));
  const [freshness, setFreshness] = useState(() => initialData(definitions));
  const [error, setError] = useState(null);
  const dataRef = useRef(data);
  const requiredFailuresRef = useRef(new Map());

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    let timer = null;
    let manifestRequestRunning = false;
    let pollIntervalMs = Math.min(...definitions.map((item) => normalizedInterval(item.pollIntervalMs)));
    const loadedVersions = new Map();
    const controller = new AbortController();

    const publishRequiredError = () => {
      const firstFailure = requiredFailuresRef.current.values().next().value;
      setError(firstFailure || null);
    };

    const loadDataset = async (definition, version) => {
      try {
        const response = await fetch(requestUrl(definition.path, version), {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw loadError(response);
        const payload = await response.json();
        if (!active) return false;

        setData((current) => {
          const next = { ...current, [definition.id]: payload };
          dataRef.current = next;
          return next;
        });
        if (version) loadedVersions.set(definition.id, version);
        if (definition.required !== false) {
          requiredFailuresRef.current.delete(definition.id);
          publishRequiredError();
        }
        return true;
      } catch (caught) {
        if (!active || caught?.name === "AbortError") return false;
        if (definition.required !== false && !dataRef.current[definition.id]) {
          requiredFailuresRef.current.set(definition.id, publicError(caught));
          publishRequiredError();
        }
        return false;
      }
    };

    const refreshManifest = async () => {
      if (!active || manifestRequestRunning) return;
      manifestRequestRunning = true;
      try {
        const response = await fetch(requestUrl(MANIFEST_PATH, Date.now()), {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw loadError(response);
        const manifest = await response.json();
        const manifestDatasets = manifest?.datasets || {};
        const clientCheckedAt = new Date().toISOString();
        setFreshness((current) => Object.fromEntries(definitions.map((definition) => [
          definition.id,
          manifestFreshness(manifestDatasets[definition.id], clientCheckedAt) || current[definition.id],
        ])));
        const configuredIntervals = definitions.map((definition) => {
          const manifestInterval = manifestDatasets[definition.id]?.pollIntervalMs;
          return normalizedInterval(manifestInterval, normalizedInterval(definition.pollIntervalMs));
        });
        pollIntervalMs = Math.min(...configuredIntervals);

        await Promise.all(definitions.map(async (definition) => {
          const entry = manifestDatasets[definition.id];
          const version = manifestVersion(entry?.version);
          const loadedVersion = loadedVersions.get(definition.id);
          if (!dataRef.current[definition.id]) {
            await loadDataset(definition, version);
          } else if (version && loadedVersion && version !== loadedVersion) {
            await loadDataset(definition, version);
          } else if (version && !loadedVersion) {
            loadedVersions.set(definition.id, version);
          }
        }));
      } catch (caught) {
        if (!active || caught?.name === "AbortError") return;
        await Promise.all(definitions
          .filter((definition) => !dataRef.current[definition.id])
          .map((definition) => loadDataset(definition)));
      } finally {
        manifestRequestRunning = false;
      }
    };

    const scheduleNextCheck = () => {
      if (!active) return;
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(async () => {
        await refreshManifest();
        scheduleNextCheck();
      }, pollIntervalMs);
    };

    const checkWhenVisible = async () => {
      if (document.visibilityState !== "visible") return;
      await refreshManifest();
      scheduleNextCheck();
    };

    const start = async () => {
      await refreshManifest();
      scheduleNextCheck();
    };

    void start();
    document.addEventListener("visibilitychange", checkWhenVisible);

    return () => {
      active = false;
      controller.abort();
      if (timer) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", checkWhenVisible);
      requiredFailuresRef.current.clear();
    };
  }, [definitions, enabled]);

  const loading = useMemo(
    () => enabled && definitions.some((definition) => definition.required !== false && !data[definition.id]),
    [data, definitions, enabled],
  );

  return { data, error, loading, freshness };
}
