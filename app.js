import {
  DAY_ORDER,
  DAY_SHORT,
  DEFAULTS,
  HIDDEN_DAY,
  PARITY_SHORT,
  escapeHtml,
  getDateOfWeekday,
  getParityForDay,
  getVisibleDays,
  inferScheduleMode,
  isDoctorVisibleToday,
  normalizeDisplay,
  normalizeOffice,
  normalizeSchedule,
} from "./shared.js";

(function () {
  const cfg = window.BoardConfig || {};
  const root = document.getElementById("root");

  const DEFAULT_SHOW_WEEKENDS = DEFAULTS.showWeekends;
  const DEFAULT_SHOW_TICKETS_REMAINING = DEFAULTS.showTicketsRemaining;
  const DEFAULT_DEPARTMENT_LAYOUT = DEFAULTS.departmentLayout;
  const DEFAULT_FONT_FAMILY = DEFAULTS.fontFamily;
  const DEFAULT_SCALE = 1;

  const state = {
    payload: null,
    error: null,
    lastOkPayload: migratePayload(loadCache()),
    rotation: {
      pages: [],
      index: 0,
      intervalMs: 60000,
      timerId: null,
    },
  };

  window.addEventListener("orientationchange", () => {
    setTimeout(() => {
      const payload = state.payload || state.lastOkPayload;
      if (payload) {
        let departmentLayout = payload?.display?.departmentLayout || DEFAULT_DEPARTMENT_LAYOUT;
        if (departmentLayout === "row") departmentLayout = "2";
        if (departmentLayout === "column") departmentLayout = "1";
        const columns = Number(departmentLayout);
        const numColumns = Number.isFinite(columns) && columns >= 1 && columns <= 4 ? columns : 2;
        const pages = state.rotation.pages;
        const currentDepartments = pages[state.rotation.index] || [];
        applyDisplaySettings(payload, numColumns, currentDepartments.length);
        renderLastKnown();
      }
    }, 100);
  });
  window.addEventListener("resize", () => {
    // При изменении размера окна пересчитываем масштаб
    const payload = state.payload || state.lastOkPayload;
    if (payload) {
      let departmentLayout = payload?.display?.departmentLayout || DEFAULT_DEPARTMENT_LAYOUT;
      if (departmentLayout === "row") departmentLayout = "2";
      if (departmentLayout === "column") departmentLayout = "1";
      const columns = Number(departmentLayout);
      const numColumns = Number.isFinite(columns) && columns >= 1 && columns <= 4 ? columns : 2;
      const pages = state.rotation.pages;
      const currentDepartments = pages[state.rotation.index] || [];
      applyDisplaySettings(payload, numColumns, currentDepartments.length);
    }
    renderLastKnown();
  });
  window.addEventListener("storage", handleStorageSync);

  loop();

  setInterval(updateRealtimeClock, 1000);
  updateRealtimeClock();
  applyDisplaySettings(state.lastOkPayload);

  function renderLastKnown() {
    const payload = state.payload || state.lastOkPayload;
    if (!payload) return;
    drawPage(payload, state.rotation.index);
  }

  function handleStorageSync(event) {
    if (event.key !== "admin:scheduleData" || !event.newValue) return;
    try {
      const parsed = JSON.parse(event.newValue);
      const payload = migratePayload(parsed);
      state.payload = payload;
      state.lastOkPayload = payload;
      saveCache(payload);
      renderTemplate(payload, { restartRotation: true });
    } catch (err) {
      console.warn("Storage sync error:", err);
    }
  }

  function updateRealtimeClock() {
    const clockEl = document.getElementById("realtime-clock");
    if (clockEl) {
      clockEl.textContent = fmtTime(new Date());
    }
  }

  async function loop() {
    let interval = cfg.pollIntervalMs || 20000;
    const retryCfg = cfg.retryBackoff || { baseMs: 5000, maxMs: 60000 };

    for (;;) {
      try {
        const payload = await fetchPayload();
        state.payload = payload;
        state.error = null;
        state.lastOkPayload = payload;
        saveCache(payload);
        renderTemplate(payload, { restartRotation: true });
        interval = cfg.pollIntervalMs || 20000;
        await sleep(interval);
      } catch (err) {
        console.warn("Fetch error:", err);
        state.error = String(err);
        if (state.lastOkPayload) {
          renderTemplate(state.lastOkPayload, { restartRotation: false });
        } else {
          root.innerHTML =
            '<div class="board"><div class="topbar"><div class="left">Нет данных</div></div></div>';
        }
        interval = Math.min((interval || retryCfg.baseMs) * 1.7, retryCfg.maxMs);
        await sleep(interval);
      }
    }
  }

  async function fetchPayload() {
    if (cfg.dataSource === "mock") {
      const adminData = localStorage.getItem("admin:scheduleData");
      if (adminData) {
        try {
          return migratePayload(JSON.parse(adminData));
        } catch (err) {
          console.warn("Ошибка загрузки данных админа:", err);
        }
      }
      return migratePayload(structuredClone(cfg.mockData));
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch(cfg.backendUrl || "/api/schedule", {
        signal: controller.signal,
        headers: { "X-Client": "infoboard" },
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();

      // Сервер ещё без данных — показываем демоданные вместо пустого экрана
      const isEmpty =
        !Array.isArray(data?.departments) || data.departments.length === 0;
      if (isEmpty && cfg.mockData) {
        return migratePayload(structuredClone(cfg.mockData));
      }

      return migratePayload(data);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  function renderTemplate(payload, { restartRotation } = {}) {
    const rotation = buildRotation(payload);
    state.rotation.pages = rotation.pages;
    state.rotation.intervalMs = rotation.intervalMs;

    if (
      restartRotation ||
      state.rotation.index >= state.rotation.pages.length
    ) {
      state.rotation.index = 0;
    }

    drawPage(payload, state.rotation.index, rotation.pages.length);
    setupRotationTimer(payload);
    updateRealtimeClock();
  }

  function setupRotationTimer(payload) {
    if (state.rotation.timerId) {
      clearTimeout(state.rotation.timerId);
      state.rotation.timerId = null;
    }

    if (state.rotation.pages.length <= 1) {
      return;
    }

    state.rotation.timerId = setTimeout(() => {
      state.rotation.index =
        (state.rotation.index + 1) % state.rotation.pages.length;
      drawPage(payload, state.rotation.index, state.rotation.pages.length);
      setupRotationTimer(payload);
    }, state.rotation.intervalMs);
  }

  function drawPage(payload, pageIndex = 0, totalPagesOverride) {
    const visibleDays = getVisibleDays(payload?.display?.showWeekends);
    const showTicketsRemaining = payload?.display?.showTicketsRemaining !== undefined
      ? Boolean(payload.display.showTicketsRemaining)
      : DEFAULT_SHOW_TICKETS_REMAINING;
    // Получаем количество столбцов (по умолчанию 2, поддерживаем старый формат для обратной совместимости)
    let departmentLayout = payload?.display?.departmentLayout || DEFAULT_DEPARTMENT_LAYOUT;
    if (departmentLayout === "row") departmentLayout = "2";
    if (departmentLayout === "column") departmentLayout = "1";
    const columns = Number(departmentLayout);
    const numColumns = Number.isFinite(columns) && columns >= 1 && columns <= 4 ? columns : 2;
    
    const pages = state.rotation.pages;
    const totalPages = totalPagesOverride || pages.length || 1;
    const currentDepartments = pages[pageIndex] || [];
    
    // Применяем настройки отображения с учетом количества столбцов и отделений для автоматического масштабирования
    applyDisplaySettings(payload, numColumns, currentDepartments.length);
    const now = new Date();

    const departmentsHtml =
      currentDepartments.length > 0
        ? currentDepartments
            .map((dept) => renderDepartment(dept, visibleDays, showTicketsRemaining))
            .join("")
        : `<div class="board-empty">Нет отделений для отображения</div>`;

    root.innerHTML = `
      <div class="board">
        <div class="topbar">
          <div class="left">${fmtHeaderLeft(now)}</div>
          <div class="right" id="realtime-clock">${fmtTime(now)}</div>
        </div>
        <div class="content multi-department" data-department-columns="${numColumns}">
          ${departmentsHtml}
        </div>
      </div>
    `;
    updateRealtimeClock();
  }

  function renderDepartment(dept, visibleDays, showTicketsRemaining) {
    const titleNumber = dept.number ? `№${dept.number}` : "Без номера";
    const doctors = (Array.isArray(dept.doctors) ? dept.doctors : []).filter(
      isDoctorVisibleToday
    );
    const doctorsHtml =
      doctors.length > 0
        ? doctors.map((doc) => renderDoctorCard(doc, dept, visibleDays, showTicketsRemaining)).join("")
        : '<div class="department-placeholder">Врачи не назначены</div>';

    return `
      <section class="department-card">
        <header class="department-header">
          <div class="department-number">${escapeHtml(titleNumber)}</div>
          <div class="department-name">${escapeHtml(dept.name || "Отделение")}</div>
        </header>
        <div class="department-body">
          ${doctorsHtml}
        </div>
      </section>
    `;
  }

  // Врач не показывается, если отмечен как скрытый или сегодняшнее число
  // не совпадает с выбранной чётностью. Обе галочки или ни одной — показываем всегда.
  function renderDoctorCard(doctor, dept, visibleDays, showTicketsRemaining) {
    const accepts = doctor.accepts || {};
    const scheduleMode = inferScheduleMode(doctor);
    const schedule = doctor.schedule || {};
    // В таблицу попадает готовый HTML, поэтому экранируем каждую часть
    const officeNumber = doctor.office
      ? `Каб. ${escapeHtml(doctor.office)}`
      : "";
    const officeDescription = (doctor.officeDescription || "").trim()
      ? `<span class="office-description">${escapeHtml(
          doctor.officeDescription
        )}</span>`
      : "";

    let office = [officeNumber, officeDescription]
      .filter(Boolean)
      .join("<br>");
    if (!office) office = "—";

    // Подпись режима нужна, только когда строк две — иначе различать нечего
    const showModeLabels = Boolean(accepts.byTicket && accepts.withoutTicket);

    const tableRows = [
      accepts.byTicket
        ? renderScheduleRow(
            "По талону",
            office,
            schedule.byTicket,
            visibleDays,
            showTicketsRemaining,
            showModeLabels,
            scheduleMode
          )
        : "",
      accepts.withoutTicket
        ? renderScheduleRow(
            "Без талона",
            office,
            schedule.withoutTicket,
            visibleDays,
            showTicketsRemaining,
            showModeLabels,
            scheduleMode
          )
        : "",
    ]
      .filter(Boolean)
      .join("");

    const table =
      tableRows ||
      `<tr><td colspan="${visibleDays.length + 1}" class="schedule-empty">Режим приема не задан</td></tr>`;

    return `
      <article class="doctor-schedule-card">
        <div class="doctor-info">
          <div class="doctor-title-row">
            <div class="doctor-name">${escapeHtml(doctor.fullName || "—")}</div>
            <div class="doctor-specialty">${escapeHtml(
              doctor.specialty || "Специальность не указана"
            )}</div>
          </div>
          <table class="schedule-table">
            <thead>
              <tr>
                <th class="mode-col"></th>
                ${visibleDays
                  .map((day) => {
                    // Число и чётность нужны только в режиме чёт/нечёт
                    const parityHint =
                      scheduleMode === "parity"
                        ? `<span class="day-parity">${getDateOfWeekday(
                            day
                          ).getDate()}, ${PARITY_SHORT[getParityForDay(day)]}</span>`
                        : "";
                    return `<th class="day-col${
                      day === getCurrentDay() ? " day-col-current" : ""
                    }">${DAY_SHORT[day] || day.toLowerCase()}${parityHint}</th>`;
                  })
                  .join("")}
              </tr>
            </thead>
            <tbody>
              ${table}
            </tbody>
          </table>
        </div>
      </article>
    `;
  }

  function calculateAutoScale(numColumns, numDepartments = 1) {
    if (typeof window === "undefined") return DEFAULT_SCALE;
    
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Отступы (padding по 24px с каждой стороны)
    const padding = 48;
    // Gap между отделениями (12px между столбцами и строками)
    const gap = 12;
    
    // Доступная ширина для контента (экран минус padding)
    const availableWidth = viewportWidth - padding;
    
    // Ширина одного столбца при равномерном распределении (grid с 1fr)
    const gapWidth = gap * (numColumns - 1);
    const columnWidth = (availableWidth - gapWidth) / numColumns;
    
    // Минимальная ширина одного отделения для комфортного отображения
    // Это базовая ширина контента отделения без масштабирования
    const baseDepartmentWidth = 400;
    
    // Рассчитываем масштаб так, чтобы столбцы занимали всю доступную ширину
    // и при этом контент был читаемым
    let scaleByWidth = columnWidth / baseDepartmentWidth;
    
    // Для 3-4 столбцов немного увеличиваем масштаб, чтобы они занимали всю ширину
    if (numColumns === 3) {
      // Для 3 столбцов используем немного больший масштаб, чтобы они растянулись
      scaleByWidth = Math.min(1, scaleByWidth * 1.05);
    } else if (numColumns === 4) {
      // Для 4 столбцов немного уменьшаем, чтобы они точно поместились
      scaleByWidth = Math.min(1, scaleByWidth * 0.98);
    }
    
    // Учитываем высоту с учетом возможных нескольких строк отделений
    // Рассчитываем количество строк на основе количества отделений
    const numRows = Math.ceil(numDepartments / numColumns);
    
    // Высота одного отделения (примерная, зависит от количества врачей)
    // Учитываем уменьшенные отступы: padding 14px 16px 16px, gap 14px внутри, gap 12px между
    const departmentHeight = 420; // Примерная высота одного отделения с 2-3 врачами (уменьшена из-за меньших отступов)
    const gapHeight = gap * (numRows - 1);
    const estimatedContentHeight = (departmentHeight * numRows) + gapHeight;
    
    const topbarHeight = 80; // Высота верхней панели
    const requiredHeight = estimatedContentHeight + topbarHeight + padding;
    let scaleByHeight = viewportHeight / requiredHeight;
    
    // Берем минимальный масштаб, чтобы контент поместился и по ширине, и по высоте
    // Не превышаем 1.0, чтобы не увеличивать контент
    let autoScale = Math.min(scaleByWidth, scaleByHeight, 1);
    
    // Ограничиваем масштаб разумными пределами (от 0.5 до 1.0)
    autoScale = Math.max(0.5, Math.min(1, autoScale));
    
    return autoScale;
  }

  function applyDisplaySettings(payload, numColumns = null, numDepartments = 1) {
    const style = normalizeDisplay(payload?.display).backgroundStyle;
    const fontFamily = payload?.display?.fontFamily || DEFAULT_FONT_FAMILY;
    
    // Масштаб считается автоматически по числу столбцов и отделений
    const fontScale =
      numColumns !== null && numColumns >= 1 && numColumns <= 4
        ? calculateAutoScale(numColumns, numDepartments)
        : DEFAULT_SCALE;
    
    if (typeof document !== "undefined" && document.body) {
      document.body.setAttribute("data-board-bg", style);
      document.documentElement.style.setProperty("--font-family", fontFamily);
      document.documentElement.style.setProperty("--font-scale", fontScale);
      
      // Масштабируем контейнер #root вместо body для лучшего контроля
      const rootElement = document.getElementById("root");
      if (rootElement) {
        if (fontScale !== 1) {
          // Используем абсолютное позиционирование с центрированием через transform
          rootElement.style.position = "absolute";
          rootElement.style.top = "50%";
          rootElement.style.left = "50%";
          rootElement.style.transform = `translate(-50%, -50%) scale(${fontScale})`;
          rootElement.style.transformOrigin = "center center";
          // Компенсируем размеры контейнера, чтобы контент не выходил за пределы
          rootElement.style.width = `${100 / fontScale}%`;
          rootElement.style.height = `${100 / fontScale}%`;
        } else {
          rootElement.style.position = "";
          rootElement.style.top = "";
          rootElement.style.left = "";
          rootElement.style.transform = "";
          rootElement.style.transformOrigin = "";
          rootElement.style.width = "";
          rootElement.style.height = "";
        }
      }
      
      // Убеждаемся, что html и body не создают прокрутку
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
      document.body.style.margin = "0";
      document.body.style.padding = "0";
    }
  }

  function getCurrentDay() {
    const now = new Date();
    const dayIndex = now.getDay(); // 0 = воскресенье, 1 = понедельник, ..., 6 = суббота
    // Преобразуем: воскресенье (0) -> индекс 6 в DAY_ORDER, понедельник (1) -> индекс 0, и т.д.
    const dayOrderIndex = dayIndex === 0 ? 6 : dayIndex - 1;
    return DAY_ORDER[dayOrderIndex] || null;
  }

  function renderScheduleRow(
    modeLabel,
    office,
    schedule = {},
    dayOrder = DAY_ORDER,
    showTicketsRemaining = DEFAULT_SHOW_TICKETS_REMAINING,
    showModeLabel = false,
    scheduleMode = "weekly"
  ) {
    const days = (
      Array.isArray(dayOrder) && dayOrder.length ? dayOrder : DAY_ORDER
    ).filter((day) => day !== HIDDEN_DAY);
    const currentDay = getCurrentDay();
    const pair = normalizeSchedule(schedule);

    return `
      <tr>
        <td class="mode-col">${
          showModeLabel
            ? `<span class="mode-name">${escapeHtml(modeLabel)}</span>`
            : ""
        }${office}</td>
        ${days
          .map((day) => {
            // Чётное или нечётное число выпадает на этот день текущей недели
            const entry =
              scheduleMode === "parity"
                ? pair[getParityForDay(day)]
                : pair.week?.[day];
            const time = compactRange(entry?.time || "\u2014");

            const rawTickets = entry?.tickets;
            let tickets = "\u2014";
            if (
              rawTickets !== undefined &&
              rawTickets !== null &&
              rawTickets !== ""
            ) {
              const numeric = Number(rawTickets);
              tickets = Number.isNaN(numeric) ? rawTickets : numeric;
            }

            let ticketsText = "";
            if (showTicketsRemaining && tickets !== "\u2014") {
              // Для режима "без талона" не показываем "талонов нет"
              if (tickets === 0 && modeLabel === "\u0411\u0435\u0437 \u0442\u0430\u043b\u043e\u043d\u0430") {
                ticketsText = "";
              } else if (tickets === 0) {
                ticketsText = `<div class="slot-tickets">\u0442\u0430\u043b\u043e\u043d\u043e\u0432 \u043d\u0435\u0442</div>`;
              } else {
                ticketsText = `<div class="slot-tickets">${escapeHtml(
                  `${tickets} ${pluralizeTickets(tickets)}`
                )}</div>`;
              }
            }

            const isCurrentDay = day === currentDay;
            const cellClass = isCurrentDay
              ? "slot-cell slot-cell-current"
              : "slot-cell";

            return `
              <td class="${cellClass}">
                <div class="slot-time">${escapeHtml(time || "\u2014")}</div>
                ${ticketsText}
              </td>
            `;
          })
          .join("")}
      </tr>
    `;
  }

  function buildRotation(payload) {
    const rotation = payload.rotation || {};
    const rawInterval = Number(rotation.intervalSec);
    const intervalSec = Number.isFinite(rawInterval) && rawInterval > 0
      ? rawInterval
      : 60;
    const rawPageSize = Number(rotation.pageSize);
    const pageSize =
      Number.isFinite(rawPageSize) && rawPageSize > 0
        ? Math.min(Math.floor(rawPageSize), 6)
        : 1;

    const departments = Array.isArray(payload.departments)
      ? payload.departments.slice()
      : [];

    const deptMap = new Map(departments.map((d) => [d.id, d]));
    const orderedIds = Array.isArray(rotation.departmentOrder)
      ? rotation.departmentOrder
      : [];
    const shouldShow = (dept) =>
      dept && (dept.showInRotation !== false || dept.forceInclude === true);

    const orderedDepartments = [];

    for (const id of orderedIds) {
      const dept = deptMap.get(id);
      if (dept && shouldShow(dept)) {
        orderedDepartments.push(dept);
      }
      deptMap.delete(id);
    }

    for (const dept of departments) {
      if (!deptMap.has(dept.id)) continue;
      if (shouldShow(dept)) {
        orderedDepartments.push(dept);
      }
      deptMap.delete(dept.id);
    }

    if (orderedDepartments.length === 0) {
      const fallback = departments.filter(shouldShow);
      orderedDepartments.push(...fallback);
    }

    const pages = [];
    if (orderedDepartments.length === 0) {
      pages.push([]);
    } else {
      for (let i = 0; i < orderedDepartments.length; i += pageSize) {
        pages.push(orderedDepartments.slice(i, i + pageSize));
      }
    }

    return {
      pages,
      intervalMs: Math.max(intervalSec, 5) * 1000,
    };
  }

  function migratePayload(raw) {
    if (!raw || typeof raw !== "object") {
      return {
        rotation: { intervalSec: 60, pageSize: 1, departmentOrder: [] },
        departments: [],
        display: normalizeDisplay(),
      };
    }

    if (Array.isArray(raw.departments)) {
      return {
        ...raw,
        display: normalizeDisplay(raw.display),
      };
    }

    const departmentId = raw.departmentId || "dept-default";
    const departmentName =
      raw.departmentName || raw.clinicName || "Отделение";

    const doctors = Array.isArray(raw.items)
      ? raw.items.map(migrateDoctor)
      : [];

    return {
      rotation: {
        intervalSec: raw.rotation?.intervalSec ?? 60,
        pageSize: raw.rotation?.pageSize ?? 1,
        departmentOrder: raw.rotation?.departmentOrder ?? [departmentId],
      },
      departments: [
        {
          id: departmentId,
          number: raw.departmentNumber || "",
          name: departmentName,
          showInRotation: true,
          doctors,
        },
      ],
      display: normalizeDisplay(raw.display),
      updatedAt: raw.updatedAt || new Date().toISOString(),
    };
  }

  function migrateDoctor(item, index) {
    const id = item?.id || `doctor-${index + 1}`;
    const legacyScheduleText = item?.scheduleText || "—";
    const schedule = createScheduleFromLegacy(legacyScheduleText, item?.freeTickets);

    return {
      id,
      fullName: item?.fullName || "Неизвестный врач",
      specialty: item?.specialty || "",
      office: normalizeOffice(item?.office),
      accepts: {
        byTicket: true,
        withoutTicket: true,
      },
      schedule: {
        byTicket: schedule,
        withoutTicket: schedule,
      },
      updatedAt: item?.updatedAt || new Date().toISOString(),
    };
  }

  function createScheduleFromLegacy(scheduleText, tickets) {
    const slot = {
      time: compactRange(scheduleText || "\u2014"),
      tickets: typeof tickets === "number" && tickets >= 0 ? tickets : "\u2014",
    };
    const week = DAY_ORDER.reduce((acc, day) => {
      acc[day] = { ...slot };
      return acc;
    }, {});
    return { even: { ...slot }, odd: { ...slot }, week };
  }

  function compactRange(text) {
    if (!text || text === "—") return "—";
    return text
      .split(/[,;]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((segment) => {
        const match = segment.match(
          /(\d{1,2})(?::?(\d{2}))?\s*[–-]\s*(\d{1,2})(?::?(\d{2}))?/
        );
        if (!match) return segment;
        const [_, sh, sm, eh, em] = match;
        const startMinutes = (sm ?? "00").padStart(2, "0");
        const endMinutes = (em ?? "00").padStart(2, "0");
        const left = `${sh.padStart(2, "0")}:${startMinutes}`;
        const right = `${eh.padStart(2, "0")}:${endMinutes}`;
        return `${left}-${right}`;
      })
      .join(", ");
  }

  function pluralizeTickets(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return "талонов";
    const abs = Math.abs(num) % 100;
    const last = abs % 10;
    if (abs > 10 && abs < 20) return "талонов";
    if (last === 1) return "талон";
    if (last >= 2 && last <= 4) return "талона";
    return "талонов";
  }

  function fmtHeaderLeft(date) {
    const weekdays = [
      "Воскресенье",
      "Понедельник",
      "Вторник",
      "Среда",
      "Четверг",
      "Пятница",
      "Суббота",
    ];
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yyyy = date.getFullYear();
    return `${weekdays[date.getDay()]}, ${dd}.${mm}.${yyyy}`;
  }

  function fmtTime(date) {
    return date.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  function saveCache(payload) {
    try {
      localStorage.setItem("board:last", JSON.stringify(payload));
    } catch (err) {
      console.warn("Не удалось сохранить кеш:", err);
    }
  }

  function loadCache() {
    try {
      const raw = localStorage.getItem("board:last");
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
})();