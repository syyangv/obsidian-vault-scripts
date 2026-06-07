#!/usr/bin/env node

const YEARLY_GLANCE_DATA_VAULT_PATH = ".obsidian/plugins/yearly-glance/data.json";
const EVENT_CSSCLASS = "yearly-glance-event";
const SYNC_SOURCE = "cssclass-events-sync";
const DEFAULT_EMOJI = "📌";
const DEFAULT_COLOR = "#73d13d";

function hasEventCssclass(frontmatter) {
  const raw = frontmatter?.cssclasses ?? frontmatter?.cssclass;
  const values = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.split(/[,\s]+/)
      : [];
  return values.map((value) => String(value).trim()).includes(EVENT_CSSCLASS);
}

function asArray(value) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function firstString(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
}

function stableHash(value) {
  if (typeof require !== "undefined") {
    try {
      return require("crypto").createHash("sha1").update(value).digest("hex").slice(0, 10);
    } catch {
      // Obsidian's user-script runtime may not expose Node crypto.
    }
  }

  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0").slice(0, 10);
}

function normalizeDate(date, year) {
  const text = String(date ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return { isoDate: text, dateArr: [text], isRepeat: false };
  }

  if (/^\d{2}-\d{2}$/.test(text)) {
    return { isoDate: text, dateArr: [`${year}-${text}`], isRepeat: true };
  }

  return null;
}

function normalizeDuration(value) {
  const duration = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(duration) && duration > 1 ? duration : undefined;
}

function eventFromRecord(record, filePath, fallbackTitle, year, index) {
  const title = firstString(record.event_title, record.title, record.label, record.text, fallbackTitle);
  const normalized = normalizeDate(record.event_date ?? record.date, year);
  if (!title || !normalized) return null;

  const description = firstString(record.event_description, record.description, record.remark);
  return {
    id: `custom-cssclass-${stableHash(`${filePath}|${index}|${normalized.isoDate}|${title}`)}`,
    text: title,
    eventDate: {
      isoDate: normalized.isoDate,
      calendar: "GREGORIAN",
      userInput: {
        input: String(record.event_date ?? record.date).trim(),
        calendar: "GREGORIAN",
      },
    },
    duration: normalizeDuration(record.event_duration ?? record.duration),
    emoji: firstString(record.event_icon, record.icon, record.emoji) || DEFAULT_EMOJI,
    color: firstString(record.event_color, record.color) || DEFAULT_COLOR,
    isRepeat: normalized.isRepeat,
    remark: description || `Synced from ${filePath}`,
    eventSource: SYNC_SOURCE,
    sourceFilePath: filePath,
    dateArr: normalized.dateArr,
  };
}

function eventsFromFrontmatter(frontmatter, filePath, basename, year) {
  if (!hasEventCssclass(frontmatter)) return [];

  const multiEvents = asArray(frontmatter.yearly_events ?? frontmatter.yearly_glance_events);
  if (multiEvents.length > 0) {
    return multiEvents
      .map((record, index) => {
        if (!record || typeof record !== "object") return null;
        return eventFromRecord(record, filePath, basename, year, index);
      })
      .filter(Boolean);
  }

  const single = eventFromRecord(frontmatter, filePath, basename, year, 0);
  return single ? [single] : [];
}

function isSyncedEntry(event) {
  return event?.eventSource === SYNC_SOURCE;
}

function mergeEvents(existing, generated) {
  const preserved = existing.filter((event) => !isSyncedEntry(event));
  const preservedKeys = new Set(
    preserved.map((event) => {
      const input = event?.eventDate?.userInput?.input ?? event?.eventDate?.isoDate ?? "";
      return `${input}|${event?.text ?? ""}`.toLowerCase();
    }),
  );
  const additions = generated.filter((event) => {
    const key = `${event.eventDate.userInput.input}|${event.text}`.toLowerCase();
    return !preservedKeys.has(key);
  });
  return [...preserved, ...additions].sort((a, b) => {
    const aDate = a?.eventDate?.userInput?.input ?? a?.eventDate?.isoDate ?? "";
    const bDate = b?.eventDate?.userInput?.input ?? b?.eventDate?.isoDate ?? "";
    return aDate.localeCompare(bDate) || String(a.text).localeCompare(String(b.text));
  });
}

async function syncCssclassEvents({ readText, writeText, listMarkdownFiles, notice } = {}) {
  const settings = JSON.parse(await readText(YEARLY_GLANCE_DATA_VAULT_PATH));
  const year = settings?.config?.year ?? new Date().getFullYear();
  const generated = [];
  const warnings = [];

  for (const file of await listMarkdownFiles()) {
    const frontmatter = file.frontmatter ?? {};
    const events = eventsFromFrontmatter(frontmatter, file.path, file.basename, year);
    generated.push(...events);
    if (hasEventCssclass(frontmatter) && events.length === 0) {
      warnings.push(`Skipped ${file.path}; missing valid event_date/date`);
    }
  }

  settings.data ||= {};
  settings.data.customEvents = mergeEvents(settings.data.customEvents ?? [], generated);

  await writeText(YEARLY_GLANCE_DATA_VAULT_PATH, `${JSON.stringify(settings, null, 2)}\n`);

  const message = `Synced ${generated.length} CSS-class events to Yearly Glance.`;
  notice?.(message);
  console.log(message);
  for (const warning of warnings) {
    notice?.(warning);
    console.warn(warning);
  }

  return { customEvents: generated.length, warnings };
}

async function runQuickAdd(params) {
  const { app, obsidian } = params;
  const adapter = app.vault.adapter;
  return syncCssclassEvents({
    readText: (vaultPath) => adapter.read(vaultPath),
    writeText: (vaultPath, content) => adapter.write(vaultPath, content),
    listMarkdownFiles: async () =>
      app.vault.getMarkdownFiles().map((file) => ({
        path: file.path,
        basename: file.basename,
        frontmatter: app.metadataCache.getFileCache(file)?.frontmatter ?? {},
      })),
    notice: (message) => {
      const Notice = obsidian?.Notice ?? globalThis.Notice;
      if (Notice) new Notice(message);
    },
  });
}

function parseSimpleFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};

  const result = {};
  let currentKey = null;
  for (const line of match[1].split(/\r?\n/)) {
    const listItem = line.match(/^\s*-\s+(.+?)\s*$/);
    if (listItem && currentKey) {
      result[currentKey] = asArray(result[currentKey]);
      result[currentKey].push(stripQuotes(listItem[1]));
      continue;
    }

    const field = line.match(/^([A-Za-z0-9_-]+):\s*(.*?)\s*$/);
    if (!field) continue;
    currentKey = field[1];
    result[currentKey] = field[2] ? stripQuotes(field[2]) : [];
  }
  return result;
}

function stripQuotes(value) {
  return String(value).trim().replace(/^["']|["']$/g, "");
}

async function walkMarkdownFiles(root, dir = "") {
  const fs = require("fs");
  const path = require("path");
  const entries = await fs.promises.readdir(path.join(root, dir), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const relative = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...(await walkMarkdownFiles(root, relative)));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      const content = await fs.promises.readFile(path.join(root, relative), "utf8");
      files.push({
        path: relative,
        basename: entry.name.replace(/\.md$/, ""),
        frontmatter: parseSimpleFrontmatter(content),
      });
    }
  }
  return files;
}

async function runNode() {
  const fs = require("fs");
  const path = require("path");
  const vaultRoot = path.resolve(__dirname, "..", "..");
  return syncCssclassEvents({
    readText: (vaultPath) => fs.promises.readFile(path.join(vaultRoot, vaultPath), "utf8"),
    writeText: (vaultPath, content) => fs.promises.writeFile(path.join(vaultRoot, vaultPath), content),
    listMarkdownFiles: () => walkMarkdownFiles(vaultRoot),
  });
}

if (typeof module !== "undefined") {
  module.exports = runQuickAdd;
}

if (
  typeof require !== "undefined" &&
  typeof module !== "undefined" &&
  require.main === module
) {
  runNode().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
