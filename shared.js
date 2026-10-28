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
  };
}

// Дни, которые видны на табло: воскресенье — никогда, суббота — по настройке
export function getVisibleDays(showWeekends = DEFAULTS.showWeekends) {
  const days = showWeekends ? DAY_ORDER.slice(0, 6) : DAY_ORDER.slice(0, 5);
  return days.filter((day) => day !== HIDDEN_DAY);
}

// Расписание задаётся двумя значениями — для чётных и нечётных чисел месяца.
// На табло они сами чередуются по дням недели.
export const PARITY_KEYS = ["even", "odd"];

export const PARITY_LABELS = {
  even: "Чётные числа",
  odd: "Нечётные числа",
};

export const PARITY_SHORT = {
  even: "чёт",
  odd: "нечёт",
};

export function createEmptySchedule() {
  return {
    even: { time: "", tickets: "" },
    odd: { time: "", tickets: "" },
  };
}

function normalizeSlot(slot) {
  if (!slot || typeof slot !== "object") {
    return { time: "", tickets: "" };
  }
  return {
    time: slot.time ?? slot.hours ?? "",
    tickets:
      slot.tickets === undefined || slot.tickets === null ? "" : slot.tickets,
  };
}

// Принимает и новый формат {even, odd}, и старый — сетку по дням недели
export function normalizeSchedule(source) {
  if (!source || typeof source !== "object") {
    return createEmptySchedule();
  }

  if (source.even || source.odd) {
    return {
      even: normalizeSlot(source.even),
      odd: normalizeSlot(source.odd),
    };
  }

  // Старые данные: берём первый день со временем и ставим его в оба поля
  const firstFilledDay = DAY_ORDER.map((day) => source[day]).find(
    (entry) => entry && String(entry.time ?? entry.hours ?? "").trim()
  );

  if (!firstFilledDay) {
    return createEmptySchedule();
  }

  const slot = normalizeSlot(firstFilledDay);
  return { even: { ...slot }, odd: { ...slot } };
}

// Дата дня недели в той же неделе, что и сегодняшняя
export function getDateOfWeekday(day, today = new Date()) {
  const target = DAY_ORDER.indexOf(day);
  if (target === -1) return new Date(today);

  // В JS воскресенье — 0, а у нас неделя начинается с понедельника
  const current = (today.getDay() + 6) % 7;
  const date = new Date(today);
  date.setDate(today.getDate() + (target - current));
  return date;
}

// Какое из двух значений действует в этот день
export function getParityForDay(day, today = new Date()) {
  return getDateOfWeekday(day, today).getDate() % 2 === 0 ? "even" : "odd";
}

export function isDoctorVisibleToday(doctor) {
  return Boolean(doctor) && !doctor.hidden;
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
