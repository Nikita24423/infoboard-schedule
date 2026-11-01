import express from "express";
import fetch from "node-fetch";
import morgan from "morgan";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  DAY_ORDER,
  normalizeDisplay,
  normalizeOffice,
} from "./shared.js";

// Файлы программы лежат в своей папке, «Сохранения» — рядом с ней
const APP_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(APP_DIR, "..");

const app = express();
app.use(morgan("tiny"));
app.use(express.json({ limit: "5mb" })); // Для работы с JSON в POST запросах
app.use(express.static(APP_DIR)); // Для раздачи статических файлов (HTML, CSS, JS)

const PORT = process.env.PORT || 3000;

// Настройки для MAPSOFT
const MAPSOFT_BASE = process.env.MAPSOFT_BASE || "https://example.com/api";
const MAPSOFT_AUTH_MODE = process.env.MAPSOFT_AUTH_MODE || "token"; // "token" | "basic"
const MAPSOFT_TOKEN = process.env.MAPSOFT_TOKEN || ""; // для Bearer
const MAPSOFT_USER = process.env.MAPSOFT_USER || "";
const MAPSOFT_PASS = process.env.MAPSOFT_PASS || "";

// Частота и кэш
// Запись разрешена только из локальной сети; задайте ADMIN_TOKEN,
// чтобы дополнительно требовать заголовок X-Admin-Token
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
const ALLOW_REMOTE_WRITES = process.env.ALLOW_REMOTE_WRITES === "true";

const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS || 20000);
const MIN_FETCH_INTERVAL_MS = Number(process.env.MIN_FETCH_INTERVAL_MS || 5000);

let lastFetchAt = 0;
let cache = { data: null, ts: 0 };
const DATA_DIR = path.join(ROOT_DIR, "Сохранения");
const LEGACY_DATA_DIR = path.join(APP_DIR, "data");
const CURRENT_FILE = path.join(DATA_DIR, "current.json");
const CONFIG_FILE = path.join(APP_DIR, "config.js");
const CONFIG_BACKUP_FILE = path.join(APP_DIR, "config.backup.js");
// Каждая сохранённая конфигурация — отдельный файл в этой папке
const CONFIGS_DIR = path.join(DATA_DIR, "configs");
const LEGACY_CONFIGS_FILE = path.join(DATA_DIR, "configs.json");
const MAX_SAVED_CONFIGS = 50;

migrateLegacyDataDir();

let adminData = readJsonFile(CURRENT_FILE); // Данные, сохраненные через админ-панель
let savedConfigs = loadSavedConfigs(); // без самих данных: { id, name, createdAt, file }

app.get("/api/schedule", async (req, res) => {
  try {
    // Если есть данные от админа, возвращаем их в приоритете
    if (adminData) {
      return res.json(withNormalizedDisplay(adminData));
    }

    const now = Date.now();
    const isFresh = cache.data && now - cache.ts < CACHE_TTL_MS;
    const overQuota = now - lastFetchAt < MIN_FETCH_INTERVAL_MS;

    if (isFresh || overQuota) {
      return res.json(cache.data || fallbackEmpty());
    }

    const apiUrl = buildMapsoftUrl();
    const headers = buildAuthHeaders();

    // node-fetch v3 игнорирует timeout, нужен AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    let raw;
    try {
      const r = await fetch(apiUrl, { headers, signal: controller.signal });
      if (!r.ok) {
        throw new Error("MAPSOFT HTTP " + r.status);
      }
      raw = await r.json();
    } finally {
      clearTimeout(timeoutId);
    }

    const normalized = normalizeMapsoft(raw);

    cache = { data: normalized, ts: now };
    lastFetchAt = now;
    res.json(normalized);
  } catch (e) {
    console.error("Error:", e.message);
    if (cache.data) return res.json(cache.data);
    res.status(502).json(fallbackEmpty());
  }
});

// Защита всех операций записи
app.post("/api/schedule", requireAdmin);
app.post("/api/config-file", requireAdmin);
app.post("/api/configs", requireAdmin);
app.delete("/api/configs/:id", requireAdmin);

function requireAdmin(req, res, next) {
  if (!ALLOW_REMOTE_WRITES && !isLocalAddress(req.ip)) {
    return res
      .status(403)
      .json({ error: "Изменение данных разрешено только из локальной сети" });
  }

  if (ADMIN_TOKEN && req.get("X-Admin-Token") !== ADMIN_TOKEN) {
    return res.status(401).json({ error: "Нужен верный X-Admin-Token" });
  }

  next();
}

// Свой компьютер или адрес из домашней/офисной сети
function isLocalAddress(address = "") {
  const ip = String(address).replace(/^::ffff:/, "");

  if (ip === "127.0.0.1" || ip === "::1" || ip === "localhost") return true;
  if (ip.startsWith("10.") || ip.startsWith("192.168.")) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  if (ip.startsWith("fc") || ip.startsWith("fd")) return true; // IPv6 локальные

  return false;
}

// Endpoint для сохранения данных из админ-панели
app.post("/api/schedule", (req, res) => {
  try {
    const data = req.body;
    
    // Валидация данных
    if (!data || typeof data !== "object") {
      return res.status(400).json({ error: "Неверный формат данных" });
    }

    // Сохраняем данные
    adminData = data;
    cache = { data: adminData, ts: Date.now() };
    writeJsonFile(CURRENT_FILE, adminData);

    console.log("Данные сохранены через админ-панель");
    res.json({ success: true, message: "Данные успешно сохранены" });
  } catch (e) {
    console.error("Ошибка сохранения данных:", e);
    res.status(500).json({ error: "Ошибка сохранения данных" });
  }
});

// Записать текущие данные обратно в config.js
app.post("/api/config-file", (req, res) => {
  try {
    const data = req.body?.data;
    const settings = req.body?.settings;

    if (!data || typeof data !== "object") {
      return res.status(400).json({ error: "Неверный формат данных" });
    }

    // Старый файл сохраняем рядом, чтобы было куда вернуться
    if (fs.existsSync(CONFIG_FILE)) {
      fs.copyFileSync(CONFIG_FILE, CONFIG_BACKUP_FILE);
    }

    fs.writeFileSync(CONFIG_FILE, buildConfigFile(data, settings), "utf8");

    console.log("config.js перезаписан из админ-панели");
    res.json({ success: true, backup: "config.backup.js" });
  } catch (e) {
    console.error("Ошибка записи config.js:", e);
    res.status(500).json({ error: "Не удалось записать config.js" });
  }
});

function buildConfigFile(data, settings = {}) {
  const base = {
    dataSource: settings?.dataSource || "backend",
    backendUrl: settings?.backendUrl || "/api/schedule",
    pollIntervalMs: Number(settings?.pollIntervalMs) || 20000,
    retryBackoff: settings?.retryBackoff || { baseMs: 5000, maxMs: 60000 },
    orientation: settings?.orientation || "auto",
    theme: settings?.theme || {},
    mockData: data,
  };

  return [
    "// Конфиг макета и поведения.",
    "// Файл создан кнопкой «Сохранить в папку» в админ-панели " +
      new Date().toLocaleString("ru-RU") +
      ".",
    "// Предыдущая версия лежит в config.backup.js",
    "",
    "window.BoardConfig = " + JSON.stringify(base, null, 2) + ";",
    "",
  ].join("\n");
}

// ——— Именованные конфигурации ———

// Список сохранённых конфигов (без самих данных)
app.get("/api/configs", (req, res) => {
  res.json(
    savedConfigs.map(({ id, name, createdAt }) => ({ id, name, createdAt }))
  );
});

// Сохранить текущие настройки под именем
app.post("/api/configs", (req, res) => {
  const name = String(req.body?.name || "").trim();
  const data = req.body?.data;

  if (!name) {
    return res.status(400).json({ error: "Укажите название конфигурации" });
  }
  if (!data || typeof data !== "object") {
    return res.status(400).json({ error: "Неверный формат данных" });
  }

  const entry = {
    id: `cfg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: name.slice(0, 120),
    createdAt: new Date().toISOString(),
    data,
  };

  const file = configFileName(entry);
  if (!writeJsonFile(path.join(CONFIGS_DIR, file), entry)) {
    return res.status(500).json({ error: "Не удалось сохранить конфигурацию" });
  }

  savedConfigs.unshift({
    id: entry.id,
    name: entry.name,
    createdAt: entry.createdAt,
    file,
  });

  // Храним последние 50, старые файлы удаляем
  for (const extra of savedConfigs.slice(MAX_SAVED_CONFIGS)) {
    removeConfigFile(extra);
  }
  savedConfigs = savedConfigs.slice(0, MAX_SAVED_CONFIGS);

  res.json({ id: entry.id, name: entry.name, createdAt: entry.createdAt });
});

// Забрать один конфиг целиком
app.get("/api/configs/:id", (req, res) => {
  const entry = savedConfigs.find((item) => item.id === req.params.id);
  const stored = entry
    ? readJsonFile(path.join(CONFIGS_DIR, entry.file))
    : null;
  if (!stored) {
    return res.status(404).json({ error: "Конфигурация не найдена" });
  }
  res.json(stored);
});

// Удалить конфиг
app.delete("/api/configs/:id", (req, res) => {
  const entry = savedConfigs.find((item) => item.id === req.params.id);
  if (!entry) {
    return res.status(404).json({ error: "Конфигурация не найдена" });
  }
  savedConfigs = savedConfigs.filter((item) => item.id !== entry.id);
  removeConfigFile(entry);
  res.json({ success: true });
});

function readJsonFile(file) {
  try {
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    console.error("Не удалось прочитать " + file + ":", e.message);
    return null;
  }
}

function writeJsonFile(file, value) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(value, null, 2), "utf8");
    return true;
  } catch (e) {
    console.error("Не удалось записать " + file + ":", e.message);
    return false;
  }
}

// Файлы называем по дате сохранения: Сохранение_01-11-2026.json.
// Если за день их несколько — добавляем номер.
function configFileName(entry) {
  const date = new Date(entry.createdAt || Date.now());
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const base = `Сохранение_${dd}-${mm}-${date.getFullYear()}`;

  let name = base + ".json";
  for (let i = 2; fs.existsSync(path.join(CONFIGS_DIR, name)); i += 1) {
    name = `${base}_${i}.json`;
  }
  return name;
}

function removeConfigFile(entry) {
  try {
    fs.rmSync(path.join(CONFIGS_DIR, entry.file), { force: true });
  } catch (e) {
    console.error("Не удалось удалить " + entry.file + ":", e.message);
  }
}

// Собираем список из папки data/configs, перенося старый единый configs.json
function loadSavedConfigs() {
  migrateLegacyConfigs();

  let names = [];
  try {
    names = fs.readdirSync(CONFIGS_DIR).filter((n) => n.endsWith(".json"));
  } catch (e) {
    return [];
  }

  const list = [];
  for (const file of names) {
    const entry = readJsonFile(path.join(CONFIGS_DIR, file));
    if (!entry?.id) continue;
    list.push({
      id: entry.id,
      name: entry.name || file.replace(/\.json$/, ""),
      createdAt: entry.createdAt || "",
      file,
    });
  }

  // Свежие сверху — так же, как их добавляет панель
  list.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return list;
}

// Папка data из старых версий переезжает в «Сохранения»
function migrateLegacyDataDir() {
  try {
    if (!fs.existsSync(LEGACY_DATA_DIR) || fs.existsSync(DATA_DIR)) return;
    fs.renameSync(LEGACY_DATA_DIR, DATA_DIR);
  } catch (e) {
    console.error("Не удалось перенести папку data:", e.message);
  }
}

function migrateLegacyConfigs() {
  const legacy = readJsonFile(LEGACY_CONFIGS_FILE);
  if (!Array.isArray(legacy)) return;

  for (const entry of legacy) {
    if (!entry?.id) continue;
    writeJsonFile(path.join(CONFIGS_DIR, configFileName(entry)), entry);
  }

  try {
    fs.renameSync(LEGACY_CONFIGS_FILE, LEGACY_CONFIGS_FILE + ".old");
  } catch (e) {
    console.error("Не удалось убрать старый configs.json:", e.message);
  }
}

function buildMapsoftUrl() {
  // TODO: заменить на реальный маршрут после получения спецификации
  // Пример: `${MAPSOFT_BASE}/schedule?date=today&department=...`
  return `${MAPSOFT_BASE}/mock-schedule`;
}

function buildAuthHeaders() {
  const h = { "Content-Type": "application/json" };
  if (MAPSOFT_AUTH_MODE === "token" && MAPSOFT_TOKEN) {
    h.Authorization = `Bearer ${MAPSOFT_TOKEN}`;
  } else if (MAPSOFT_AUTH_MODE === "basic" && MAPSOFT_USER) {
    const b64 = Buffer.from(`${MAPSOFT_USER}:${MAPSOFT_PASS}`).toString(
      "base64"
    );
    h.Authorization = `Basic ${b64}`;
  }
  return h;
}

function normalizeMapsoft(raw) {
  if (raw && Array.isArray(raw.departments)) {
    return {
      ...raw,
      display: normalizeDisplay(raw.display),
    };
  }

  const departmentId = raw?.departmentId || "dept-mapsoft";
  const departmentName = raw?.departmentName || raw?.clinicName || "Отделение";
  const departmentNumber = raw?.departmentNumber || "";

  const doctors = Array.isArray(raw?.items)
    ? raw.items.map((item, index) => adaptMapsoftDoctor(item, index))
    : [];

  return {
    rotation: {
      intervalSec: raw?.rotation?.intervalSec ?? 60,
      pageSize: raw?.rotation?.pageSize ?? 1,
      departmentOrder:
        raw?.rotation?.departmentOrder ?? (departmentId ? [departmentId] : []),
    },
    departments: [
      {
        id: departmentId,
        number: departmentNumber,
        name: departmentName,
        showInRotation: true,
        doctors,
      },
    ],
    display: normalizeDisplay(raw?.display),
    updatedAt: raw?.updatedAt ?? new Date().toISOString(),
  };
}

function adaptMapsoftDoctor(record, index) {
  const id = String(record?.id ?? record?.doctorId ?? cryptoRandomId());
  const accepts = {
    byTicket:
      record?.accepts?.byTicket === undefined
        ? true
        : Boolean(record.accepts.byTicket),
    withoutTicket:
      record?.accepts?.withoutTicket === undefined
        ? true
        : Boolean(record.accepts.withoutTicket),
  };

  const schedule = normalizeDoctorSchedule(record);

  return {
    id,
    fullName: record?.fullName ?? record?.fio ?? "ФИО неизвестно",
    specialty: record?.specialty ?? record?.spec ?? "",
    office: normalizeOffice(record?.office ?? record?.room ?? ""),
    accepts,
    schedule,
    updatedAt: record?.updatedAt ?? new Date().toISOString(),
  };
}

function normalizeDoctorSchedule(record) {
  const fallbackTime =
    record?.scheduleText ??
    buildScheduleText(record?.schedule ?? record?.slots ?? []) ??
    "—";
  const fallbackTickets =
    typeof record?.freeTickets === "number"
      ? record.freeTickets
      : countFree(record?.slots) ?? "";

  const fallbackWeek = createUniformWeek(fallbackTime, fallbackTickets);

  const byTicketWeek =
    normalizeMapsoftWeek(record?.schedule?.byTicket ?? record?.privateWeek) ||
    fallbackWeek;
  const withoutTicketWeek =
    normalizeMapsoftWeek(
      record?.schedule?.withoutTicket ?? record?.publicWeek ?? record?.commonWeek
    ) || fallbackWeek;

  return {
    byTicket: byTicketWeek,
    withoutTicket: withoutTicketWeek,
  };
}

// Недельная сетка из ответа MAPSOFT: null означает «данных нет»
function normalizeMapsoftWeek(source) {
  if (!source || typeof source !== "object") {
    return null;
  }

  let hasData = false;
  const out = {};

  for (const day of DAY_ORDER) {
    const entry = source[day];
    if (!entry) {
      out[day] = { time: "", tickets: "" };
      continue;
    }

    if (typeof entry === "string") {
      out[day] = { time: entry, tickets: "" };
      if (entry.trim()) hasData = true;
      continue;
    }

    const time = entry.time ?? entry.hours ?? entry.value ?? "";
    const tickets =
      entry.tickets ?? entry.freeTickets ?? entry.quota ?? entry.count ?? "";

    if ((time && time.trim()) || tickets === 0 || tickets) {
      hasData = true;
    }

    out[day] = { time, tickets };
  }

  return hasData ? out : null;
}

function createUniformWeek(time, tickets) {
  const week = {};
  for (const day of DAY_ORDER) {
    week[day] = { time: time || "", tickets: tickets ?? "" };
  }
  return week;
}

function buildScheduleText(slots) {
  if (!Array.isArray(slots) || slots.length === 0) return null;
  // Склеиваем в диапазоны, пример: "09:00–13:00, 14:00–18:00"
  const times = slots
    .map((s) => [s.start, s.end])
    .filter((p) => p[0] && p[1])
    .map((p) => `${p[0]}–${p[1]}`);
  return times.join(", ");
}

function countFree(slots) {
  if (!Array.isArray(slots)) return null;
  return slots.filter((s) => s.free === true || s.status === "free").length;
}

function cryptoRandomId() {
  return Math.random().toString(36).slice(2, 10);
}

function fallbackEmpty() {
  return {
    rotation: { intervalSec: 60, pageSize: 1, departmentOrder: [] },
    departments: [],
    display: normalizeDisplay(),
    updatedAt: new Date().toISOString(),
  };
}

function withNormalizedDisplay(payload) {
  return {
    ...payload,
    display: normalizeDisplay(payload?.display),
  };
}

app.listen(PORT, () => {
  console.log("Server listening on " + PORT);
});