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

// У каждого врача свой способ задать расписание
export const SCHEDULE_MODES = ["weekly", "parity"];

export const SCHEDULE_MODE_LABELS = {
  weekly: "\u041f\u043e \u0434\u043d\u044f\u043c \u043d\u0435\u0434\u0435\u043b\u0438",
  parity: "\u041f\u043e \u0447\u0451\u0442\u043d\u044b\u043c \u0438 \u043d\u0435\u0447\u0451\u0442\u043d\u044b\u043c \u0447\u0438\u0441\u043b\u0430\u043c",
};

export const DEFAULT_SCHEDULE_MODE = "weekly";

export function normalizeScheduleMode(value) {
  return SCHEDULE_MODES.includes(value) ? value : DEFAULT_SCHEDULE_MODE;
}

// У старых записей режим не указан — определяем его по тому, что заполнено
export function inferScheduleMode(doctor) {
  if (doctor?.scheduleMode) return normalizeScheduleMode(doctor.scheduleMode);

  const schedules = Object.values(doctor?.schedule || {});
  const hasWeek = schedules.some((item) =>
    DAY_ORDER.some((day) => String(item?.week?.[day]?.time || item?.[day]?.time || "").trim())
  );
  if (hasWeek) return "weekly";

  const hasParity = schedules.some(
    (item) => String(item?.even?.time || "").trim() || String(item?.odd?.time || "").trim()
  );
  return hasParity ? "parity" : DEFAULT_SCHEDULE_MODE;
}

export function createEmptySchedule() {
  return {
    even: { time: "", tickets: "" },
    odd: { time: "", tickets: "" },
    week: createEmptyWeek(),
  };
}

export function createEmptyWeek() {
  return DAY_ORDER.reduce((acc, day) => {
    acc[day] = { time: "", tickets: "" };
    return acc;
  }, {});
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

function normalizeWeek(source) {
  const week = createEmptyWeek();
  if (!source || typeof source !== "object") return week;

  for (const day of DAY_ORDER) {
    if (source[day]) week[day] = normalizeSlot(source[day]);
  }
  return week;
}

// Храним оба вида сразу, чтобы переключение режима ничего не теряло.
// Понимает и старый формат — голую сетку по дням недели
export function normalizeSchedule(source) {
  if (!source || typeof source !== "object") {
    return createEmptySchedule();
  }

  const hasParity = Boolean(source.even || source.odd);
  const weekSource = source.week || (hasParity ? null : source);
  const week = normalizeWeek(weekSource);

  if (hasParity) {
    return {
      even: normalizeSlot(source.even),
      odd: normalizeSlot(source.odd),
      week,
    };
  }

  // Старые данные: первый день со временем становится заготовкой для чёт/нечёт
  const firstFilledDay = DAY_ORDER.map((day) => week[day]).find((entry) =>
    String(entry?.time || "").trim()
  );
  const slot = firstFilledDay ? { ...firstFilledDay } : { time: "", tickets: "" };

  return { even: { ...slot }, odd: { ...slot }, week };
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
