import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";
import config from "./config.js";

let store = {};

function load() {
  try {
    const data = readFileSync(config.sessions.filePath, "utf-8");
    store = JSON.parse(data);
  } catch {
    store = {};
  }
}

function save() {
  try {
    mkdirSync(dirname(config.sessions.filePath), { recursive: true });
    writeFileSync(config.sessions.filePath, JSON.stringify(store, null, 2));
  } catch (err) {
    console.error("[session-store] Failed to save:", err.message);
  }
}

function prune() {
  const now = Date.now();
  let changed = false;
  for (const [key, entry] of Object.entries(store)) {
    if (now - entry.updatedAt > config.sessions.maxAge) {
      delete store[key];
      changed = true;
    }
  }
  if (changed) save();
}

/**
 * Look up a Claude session_id for a conversation key.
 */
export function getSession(conversationKey) {
  load();
  const entry = store[conversationKey];
  if (!entry) return null;
  if (Date.now() - entry.updatedAt > config.sessions.maxAge) {
    delete store[conversationKey];
    save();
    return null;
  }
  return entry.sessionId;
}

/**
 * Store a Claude session_id for a conversation key.
 */
export function setSession(conversationKey, sessionId) {
  load();
  store[conversationKey] = {
    sessionId,
    updatedAt: Date.now(),
  };
  save();
}

/**
 * Remove a conversation's session (e.g., on stale session error).
 */
export function removeSession(conversationKey) {
  load();
  delete store[conversationKey];
  save();
}

// Prune stale sessions on load
load();
prune();

export default { getSession, setSession, removeSession };
