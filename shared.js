// Общие правила для табло, админ-панели и сервера.
// Раньше они были продублированы в трёх файлах и успели разойтись.

export const DAY_ORDER = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export const DAY_SHORT = {
  Пн: "пн",
  Вт: "вт",
  Ср: "ср",
  Чт: "чт",
  Пт: "пт",
  Сб: "сб",
  Вс: "вс",
};

// Воскресенье не показывается и не редактируется
export const HIDDEN_DAY = "Вс";
export const EDITABLE_DAYS = DAY_ORDER.filter((day) => day !== HIDDEN_DAY);

export const BACKGROUND_STYLES = ["night-sky", "aurora", "forest"];

export const DEFAULTS = {
  backgroundStyle: BACKGROUND_STYLES[0],
  showWeekends: false,
  showTicketsRemaining: true,
  useByTicket: false,
  departmentLayout: "2",
  fontFamily: "Inter",
  fontScale: 1,
};

export function normalizeBackgroundStyle(value) {
  if (typeof value !== "string") return DEFAULTS.backgroundStyle;
  return BACKGROUND_STYLES.includes(value) ? value : DEFAULTS.backgroundStyle;
}

// "row"/"column" — старый формат, число 1–4 — текущий
export function normalizeDepartmentLayout(value) {
  if (value === "row") return "2";
  if (value === "column") return "1";

  const number = Number(value);
  if (!Number.isFinite(number) || number < 1 || number > 4) {
    return DEFAULTS.departmentLayout;
  }
  return String(number);
}

export function normalizeFontScale(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return DEFAULTS.fontScale;
  }
  return Math.max(0.5, Math.min(2, value));
}

export function normalizeDisplay(display = {}) {
  const source = display && typeof display === "object" ? display : {};
  const flag = (key) =>
    source[key] === undefined ? DEFAULTS[key] : Boolean(source[key]);

  return {
    // Неизвестные поля сохраняем, чтобы не терять будущие настройки
    ...source,
    backgroundStyle: normalizeBackgroundStyle(source.backgroundStyle),
    showWeekends: flag("showWeekends"),
    showTicketsRemaining: flag("showTicketsRemaining"),
    useByTicket: flag("useByTicket"),
    departmentLayout: normalizeDepartmentLayout(source.departmentLayout),
    fontFamily: source.fontFamily || DEFAULTS.fontFamily,
    fontScale: normalizeFontScale(source.fontScale),
  };
}

// Дни, которые видны на табло: воскресенье — никогда, суббота — по настройке
export function getVisibleDays(showWeekends = DEFAULTS.showWeekends) {
  const days = showWeekends ? DAY_ORDER.slice(0, 6) : DAY_ORDER.slice(0, 5);
  return days.filter((day) => day !== HIDDEN_DAY);
}

export function createEmptyWeek() {
  return DAY_ORDER.reduce((acc, day) => {
    acc[day] = { time: "", tickets: "" };
    return acc;
  }, {});
}

export function normalizeWeek(week) {
  if (!week || typeof week !== "object") {
    return createEmptyWeek();
  }

  const result = {};
  for (const day of DAY_ORDER) {
    const entry = week[day] || {};
    result[day] = {
      time: entry.time ?? entry.hours ?? "",
      tickets:
        entry.tickets === undefined || entry.tickets === null
          ? ""
          : entry.tickets,
    };
  }
  return result;
}

// Обе галочки (или ни одной) — врач принимает в любое число
export function normalizeParity(parity) {
  if (!parity || typeof parity !== "object") {
    return { even: true, odd: true };
  }
  return {
    even: parity.even === undefined ? true : Boolean(parity.even),
    odd: parity.odd === undefined ? true : Boolean(parity.odd),
  };
}

// Врач скрыт вручную или сегодняшнее число другой чётности
export function isDoctorVisibleToday(doctor, today = new Date()) {
  if (!doctor || doctor.hidden) return false;

  const { even, odd } = normalizeParity(doctor.parity);
  if (even === odd) return true;

  return today.getDate() % 2 === 0 ? even : odd;
}

export function normalizeOffice(office) {
  if (!office) return "";
  return String(office).replace(/^Каб\.?\s*/i, "").trim();
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
