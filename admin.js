import {
  DAY_ORDER,
  DEFAULTS,
  EDITABLE_DAYS,
  HIDDEN_DAY,
  createEmptyWeek,
  escapeHtml,
  normalizeBackgroundStyle,
  normalizeDepartmentLayout,
  normalizeParity,
  normalizeWeek,
} from "./shared.js";

(function () {
  const cfg = window.BoardConfig || {};
  const storageKey = "admin:scheduleData";
  const UI_STORAGE_KEY = "admin:uiSettings";

  const THEME_PRESETS = {
    light: {
      "--bg-admin": "#f5f7fa",
      "--bg-card": "#ffffff",
      "--fg": "#1a202c",
      "--fg-muted": "#4a5568",
      "--border": "#e2e8f0",
      "--primary": "#3b82f6",
      "--primary-hover": "#2563eb",
      "--success": "#10b981",
      "--success-hover": "#059669",
      "--danger": "#ef4444",
      "--danger-hover": "#dc2626",
      "--secondary": "#6b7280",
      "--secondary-hover": "#4b5563",
      "--header-bg": "#ffffff",
      "--header-fg": "#1a202c",
      "--schedule-bg": "#f9fafb",
      "--clock-bg": "rgba(15, 23, 42, 0.05)",
      "--clock-border": "rgba(148, 163, 184, 0.35)",
    },
    dark: {
      "--bg-admin": "#0f172a",
      "--bg-card": "#1e293b",
      "--fg": "#f1f5f9",
      "--fg-muted": "#94a3b8",
      "--border": "#334155",
      "--primary": "#60a5fa",
      "--primary-hover": "#3b82f6",
      "--success": "#34d399",
      "--success-hover": "#22c55e",
      "--danger": "#f87171",
      "--danger-hover": "#ef4444",
      "--secondary": "#94a3b8",
      "--secondary-hover": "#64748b",
      "--header-bg": "#1e293b",
      "--header-fg": "#f8fafc",
      "--schedule-bg": "#15213a",
      "--clock-bg": "rgba(148, 163, 184, 0.12)",
      "--clock-border": "rgba(148, 163, 184, 0.3)",
    },
  };
  const BACKGROUND_OPTIONS = ["night-sky", "aurora", "forest"];
  const DEFAULT_BACKGROUND_STYLE = DEFAULTS.backgroundStyle;
  const DEFAULT_SHOW_WEEKENDS = DEFAULTS.showWeekends;
  const DEFAULT_SHOW_TICKETS_REMAINING = DEFAULTS.showTicketsRemaining;
  const DEFAULT_USE_BY_TICKET = DEFAULTS.useByTicket;
  const DEFAULT_DEPARTMENT_LAYOUT = DEFAULTS.departmentLayout;
  const DEFAULT_FONT_FAMILY = DEFAULTS.fontFamily;

  let doctorIdCounter = 0;

  // Date.now() не годится: два врача, добавленных в одну миллисекунду,
  // получали одинаковый id — и удалялись вместе
  function createDoctorId() {
    doctorIdCounter += 1;
    return `doc-${Date.now()}-${doctorIdCounter}-${Math.random()
      .toString(36)
      .slice(2, 7)}`;
  }

  let uiSettings = loadUiSettings();
  let currentData = normalizeData(loadInitialData());
  let clockTimerId = null;

  function init() {
    applyThemeSettings(uiSettings);
    populateThemeControls();
    renderForm();
    setupEventListeners();
    startClock();
    refreshConfigList();
    updateHeaderHeight();
    setupHeaderToggle();
  }

  function updateHeaderHeight() {
    const header = document.getElementById("adminHeader");
    if (header && !header.classList.contains("header-hidden")) {
      const height = header.offsetHeight;
      document.documentElement.style.setProperty("--header-height", `${height}px`);
    }
  }

  function setupHeaderToggle() {
    const toggleBtn = document.getElementById("toggleHeaderBtn");
    const header = document.getElementById("adminHeader");
    const body = document.body;
    
    if (!toggleBtn || !header) return;

    // Загружаем состояние из localStorage
    const isHidden = localStorage.getItem("admin:headerHidden") === "true";
    if (isHidden) {
      header.classList.add("header-hidden");
      body.classList.add("header-hidden");
    } else {
      // Обновляем высоту при загрузке, если хедер видим
      setTimeout(updateHeaderHeight, 100);
    }

    toggleBtn.addEventListener("click", () => {
      const isCurrentlyHidden = header.classList.contains("header-hidden");
      
      if (isCurrentlyHidden) {
        header.classList.remove("header-hidden");
        body.classList.remove("header-hidden");
        localStorage.setItem("admin:headerHidden", "false");
        // Обновляем высоту после показа хедера
        setTimeout(updateHeaderHeight, 50);
      } else {
        header.classList.add("header-hidden");
        body.classList.add("header-hidden");
        localStorage.setItem("admin:headerHidden", "true");
      }
    });

    // Обновляем высоту при изменении размера окна
    let resizeTimeout;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(updateHeaderHeight, 100);
    });
  }

  function loadInitialData() {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (err) {
        console.warn("Ошибка чтения сохраненных данных:", err);
      }
    }
    return structuredClone(cfg.mockData || createEmptyData());
  }

  function loadUiSettings() {
    const defaults = {
      theme: "light",
      headerBgColor: "",
      headerFgColor: "",
    };
    try {
      const raw = localStorage.getItem(UI_STORAGE_KEY);
      if (!raw) return defaults;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return defaults;
      return {
        ...defaults,
        ...parsed,
      };
    } catch (err) {
      console.warn("Ошибка чтения настроек оформления:", err);
      return defaults;
    }
  }

  function saveUiSettings() {
    try {
      localStorage.setItem(UI_STORAGE_KEY, JSON.stringify(uiSettings));
    } catch (err) {
      console.warn("Не удалось сохранить настройки оформления:", err);
    }
  }

  function getThemePreset(theme) {
    return THEME_PRESETS[theme] || THEME_PRESETS.light;
  }

  function applyThemeSettings(settings) {
    const preset = getThemePreset(settings.theme);
    const root = document.documentElement;

    Object.entries(preset).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    if (settings.headerBgColor) {
      root.style.setProperty("--header-bg", settings.headerBgColor);
    }
    if (settings.headerFgColor) {
      root.style.setProperty("--header-fg", settings.headerFgColor);
    }

    document.body.setAttribute("data-theme", settings.theme);
  }

  function populateThemeControls() {
    const themeSelect = document.getElementById("themeSelect");
    const preset = getThemePreset(uiSettings.theme);

    if (themeSelect) {
      themeSelect.value = uiSettings.theme;
    }

    populateBackgroundControls(
      currentData.display?.backgroundStyle || DEFAULT_BACKGROUND_STYLE
    );
  }

  function getValidBackgroundStyle(value) {
    return normalizeBackgroundStyle(value);
  }

  function populateBackgroundControls(selectedStyle = DEFAULT_BACKGROUND_STYLE) {
    const normalized = getValidBackgroundStyle(selectedStyle);
    const inputs = document.querySelectorAll('input[name="backgroundStyle"]');
    inputs.forEach((input) => {
      const isActive = input.value === normalized;
      input.checked = isActive;
      const option = input.closest(".background-option");
      if (option) {
        option.classList.toggle("active", isActive);
      }
    });
  }

  function startClock() {
    if (clockTimerId) {
      clearInterval(clockTimerId);
    }
    updateAdminClock();
    clockTimerId = setInterval(updateAdminClock, 1000);
  }

  function updateAdminClock() {
    const clockElement = document.getElementById("adminClock");
    if (!clockElement) return;
    const now = new Date();
    clockElement.textContent = now.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  function handleThemeSelectChange(event) {
    const value = event.target.value === "dark" ? "dark" : "light";
    if (uiSettings.theme === value) return;
    uiSettings = {
      ...uiSettings,
      theme: value,
    };
    applyThemeSettings(uiSettings);
    populateThemeControls();
    saveUiSettings();
  }

  function handleBackgroundChange(event) {
    const value = getValidBackgroundStyle(event.target.value);
    syncCurrentData();
    currentData.display = {
      ...(currentData.display || {}),
      backgroundStyle: value,
    };
    populateBackgroundControls(value);
  }

  function isWeekendsEnabled(data = currentData) {
    const flag = data?.display?.showWeekends;
    if (flag === undefined || flag === null) return DEFAULT_SHOW_WEEKENDS;
    return Boolean(flag);
  }

  function updateWeekendToggleUI() {
    const toggle = document.getElementById("showWeekendsToggle");
    const show = isWeekendsEnabled();
    if (toggle) toggle.checked = show;
    applyWeekendVisibility(show);
  }

  function applyWeekendVisibility(show) {
    // Суббота показывается/скрывается в зависимости от переключателя
    document
      .querySelectorAll('.schedule-day[data-day="Сб"]')
      .forEach((el) => {
        if (show) {
          el.classList.remove("is-hidden");
        } else {
          el.classList.add("is-hidden");
        }
      });
  }

  function handleWeekendToggle(event) {
    const show = Boolean(event.target.checked);
    syncCurrentData();
    currentData.display = {
      ...(currentData.display || {}),
      showWeekends: show,
    };
    applyWeekendVisibility(show);
  }

  function isTicketsRemainingEnabled(data = currentData) {
    const flag = data?.display?.showTicketsRemaining;
    if (flag === undefined || flag === null) return DEFAULT_SHOW_TICKETS_REMAINING;
    return Boolean(flag);
  }

  function updateTicketsRemainingToggleUI() {
    const toggle = document.getElementById("showTicketsRemainingToggle");
    const show = isTicketsRemainingEnabled();
    if (toggle) toggle.checked = show;
  }

  function handleTicketsRemainingToggle(event) {
    const show = Boolean(event.target.checked);
    syncCurrentData();
    currentData.display = {
      ...(currentData.display || {}),
      showTicketsRemaining: show,
    };
  }

  function isUseByTicketEnabled(data = currentData) {
    const flag = data?.display?.useByTicket;
    if (flag === undefined || flag === null) return DEFAULT_USE_BY_TICKET;
    return Boolean(flag);
  }

  function updateUseByTicketToggleUI() {
    const toggle = document.getElementById("useByTicketToggle");
    const show = isUseByTicketEnabled();
    if (toggle) toggle.checked = show;
  }

  function handleUseByTicketToggle(event) {
    const show = Boolean(event.target.checked);
    syncCurrentData();
    currentData.display = {
      ...(currentData.display || {}),
      useByTicket: show,
    };
    renderForm();
  }

  function getDepartmentLayout(data = currentData) {
    return normalizeDepartmentLayout(data?.display?.departmentLayout);
  }

  function updateDepartmentLayoutUI() {
    const select = document.getElementById("departmentLayout");
    const layout = getDepartmentLayout();
    if (select) select.value = layout;
  }

  function handleDepartmentLayoutChange(event) {
    const layout = event.target.value;
    syncCurrentData();
    currentData.display = {
      ...(currentData.display || {}),
      departmentLayout: layout,
    };
  }

  function getFontFamily(data = currentData) {
    const font = data?.display?.fontFamily;
    if (typeof font === "string" && font.trim()) return font.trim();
    return DEFAULT_FONT_FAMILY;
  }

  function updateFontFamilyUI() {
    const select = document.getElementById("fontFamily");
    const font = getFontFamily();
    if (select) select.value = font;
  }

  function handleFontFamilyChange(event) {
    const font = event.target.value || DEFAULT_FONT_FAMILY;
    syncCurrentData();
    currentData.display = {
      ...(currentData.display || {}),
      fontFamily: font,
    };
  }

  function normalizeData(data) {
    const base = {
      rotation: {
        intervalSec: 60,
        pageSize: 1,
        departmentOrder: [],
      },
      departments: [],
      display: {
        backgroundStyle: DEFAULT_BACKGROUND_STYLE,
        showWeekends: DEFAULT_SHOW_WEEKENDS,
        showTicketsRemaining: DEFAULT_SHOW_TICKETS_REMAINING,
        departmentLayout: DEFAULT_DEPARTMENT_LAYOUT,
        fontFamily: DEFAULT_FONT_FAMILY,
      },
      updatedAt: new Date().toISOString(),
    };

    if (!data || typeof data !== "object") {
      return base;
    }

    if (!Array.isArray(data.departments)) {
      // миграция из старого формата
      const items = Array.isArray(data.items) ? data.items : [];
      const deptId = data.departmentId || "dept-default";
      const backgroundStyle = getValidBackgroundStyle(
        data.display?.backgroundStyle
      );
      const showWeekends =
        data.display?.showWeekends === undefined
          ? DEFAULT_SHOW_WEEKENDS
          : Boolean(data.display.showWeekends);
      const showTicketsRemaining =
        data.display?.showTicketsRemaining === undefined
          ? DEFAULT_SHOW_TICKETS_REMAINING
          : Boolean(data.display.showTicketsRemaining);
      const useByTicket =
        data.display?.useByTicket === undefined
          ? DEFAULT_USE_BY_TICKET
          : Boolean(data.display.useByTicket);
      const departmentLayout = getDepartmentLayout(data);
      const fontFamily = getFontFamily(data);
      return {
        ...base,
        rotation: {
          intervalSec: data.rotation?.intervalSec ?? 60,
          pageSize: data.rotation?.pageSize ?? 1,
          departmentOrder: [deptId],
        },
        departments: [
          {
            id: deptId,
            number: data.departmentNumber || "",
            name: data.departmentName || data.clinicName || "Отделение",
            showInRotation: true,
            sortOrder: 1,
            doctors: items.map((item, idx) => migrateDoctor(item, idx)),
          },
        ],
        display: {
          backgroundStyle,
          showWeekends,
          showTicketsRemaining,
          useByTicket,
          departmentLayout,
          fontFamily,
        },
        updatedAt: data.updatedAt || new Date().toISOString(),
      };
    }

    const rotation = {
      intervalSec: Number(data.rotation?.intervalSec) || 60,
      pageSize: Math.max(1, Number(data.rotation?.pageSize) || 1),
      departmentOrder: Array.isArray(data.rotation?.departmentOrder)
        ? data.rotation.departmentOrder
        : [],
    };

    const departments = data.departments.map((dept, idx) =>
      normalizeDepartment(dept, idx)
    );

    if (rotation.departmentOrder.length) {
      const orderMap = new Map();
      rotation.departmentOrder.forEach((id, idx) => orderMap.set(id, idx));
      departments.sort((a, b) => {
        const aOrder = orderMap.has(a.id)
          ? orderMap.get(a.id)
          : rotation.departmentOrder.length + a.sortOrder;
        const bOrder = orderMap.has(b.id)
          ? orderMap.get(b.id)
          : rotation.departmentOrder.length + b.sortOrder;
        return aOrder - bOrder;
      });
    }

    const backgroundStyle = getValidBackgroundStyle(
      data.display?.backgroundStyle
    );
    const showWeekends =
      data.display?.showWeekends === undefined
        ? DEFAULT_SHOW_WEEKENDS
        : Boolean(data.display.showWeekends);
    const showTicketsRemaining =
      data.display?.showTicketsRemaining === undefined
        ? DEFAULT_SHOW_TICKETS_REMAINING
        : Boolean(data.display.showTicketsRemaining);
    const useByTicket =
      data.display?.useByTicket === undefined
        ? DEFAULT_USE_BY_TICKET
        : Boolean(data.display.useByTicket);
    const departmentLayout = getDepartmentLayout(data);
    const fontFamily = getFontFamily(data);

    return {
      rotation,
      departments,
      display: {
        backgroundStyle,
        showWeekends,
        showTicketsRemaining,
        useByTicket,
        departmentLayout,
        fontFamily,
      },
      updatedAt: data.updatedAt || new Date().toISOString(),
    };
  }

  function createEmptyData() {
    return {
      rotation: {
        intervalSec: 60,
        pageSize: 1,
        departmentOrder: [],
      },
      departments: [],
      display: {
        backgroundStyle: DEFAULT_BACKGROUND_STYLE,
        showWeekends: DEFAULT_SHOW_WEEKENDS,
        showTicketsRemaining: DEFAULT_SHOW_TICKETS_REMAINING,
        useByTicket: DEFAULT_USE_BY_TICKET,
        departmentLayout: DEFAULT_DEPARTMENT_LAYOUT,
        fontFamily: DEFAULT_FONT_FAMILY,
      },
      updatedAt: new Date().toISOString(),
    };
  }

  function normalizeDepartment(dept, index) {
    const id = dept?.id || `dept-${index + 1}`;
    const doctors = Array.isArray(dept?.doctors)
      ? dept.doctors.map((doctor, dIdx) => normalizeDoctor(doctor, dIdx))
      : [];

    return {
      id,
      number: dept?.number || "",
      name: dept?.name || `Отделение ${index + 1}`,
      showInRotation:
        dept?.showInRotation === undefined ? true : Boolean(dept.showInRotation),
      sortOrder: Number.isFinite(dept?.sortOrder)
        ? Number(dept.sortOrder)
        : index + 1,
      doctors,
    };
  }

  function normalizeDoctor(doctor, index) {
    if (!doctor || typeof doctor !== "object") {
      return createEmptyDoctor();
    }
    const id = doctor.id || createDoctorId();
    return {
      id,
      fullName: doctor.fullName || "",
      specialty: doctor.specialty || "",
      office: doctor.office || "",
      officeDescription: doctor.officeDescription || "",
      hidden: Boolean(doctor.hidden),
      parity: normalizeParity(doctor.parity),
      accepts: {
        byTicket:
          doctor.accepts?.byTicket === undefined
            ? true
            : Boolean(doctor.accepts.byTicket),
        withoutTicket:
          doctor.accepts?.withoutTicket === undefined
            ? true
            : Boolean(doctor.accepts.withoutTicket),
      },
      schedule: {
        byTicket: normalizeWeek(doctor.schedule?.byTicket),
        withoutTicket: normalizeWeek(doctor.schedule?.withoutTicket),
      },
      updatedAt: doctor.updatedAt || new Date().toISOString(),
    };
  }

  function migrateDoctor(item, index) {
    const legacySchedule = createWeekFromLegacy(item?.scheduleText, item?.freeTickets);
    return {
      id: item?.id || createDoctorId(),
      fullName: item?.fullName || "",
      specialty: item?.specialty || "",
      office: item?.office || "",
      officeDescription: item?.officeDescription || "",
      hidden: Boolean(item?.hidden),
      parity: normalizeParity(item?.parity),
      accepts: { byTicket: true, withoutTicket: true },
      schedule: {
        byTicket: legacySchedule,
        withoutTicket: legacySchedule,
      },
      updatedAt: item?.updatedAt || new Date().toISOString(),
    };
  }

  // Обе галочки (или ни одной) — врач принимает в любое число
  function createEmptyDepartment() {
    return {
      id: `dept-${Date.now()}`,
      number: "",
      name: "Новое отделение",
      showInRotation: true,
      sortOrder: currentData.departments.length + 1,
      doctors: [],
    };
  }

  function createEmptyDoctor() {
    const useByTicket = isUseByTicketEnabled();
    return {
      id: createDoctorId(),
      fullName: "",
      specialty: "",
      office: "",
      officeDescription: "",
      hidden: false,
      parity: { even: true, odd: true },
      accepts: {
        byTicket: useByTicket,
        withoutTicket: true,
      },
      schedule: {
        byTicket: createEmptyWeek(),
        withoutTicket: createEmptyWeek(),
      },
      updatedAt: new Date().toISOString(),
    };
  }

  function createWeekFromLegacy(scheduleText, tickets) {
    const time = scheduleText || "";
    const ticketsValue = Number.isFinite(Number(tickets)) ? Number(tickets) : "";
    return DAY_ORDER.reduce((acc, day) => {
      acc[day] = { time, tickets: ticketsValue };
      return acc;
    }, {});
  }

  function renderForm() {
    const rotationInterval = document.getElementById("rotationInterval");
    const rotationPageSize = document.getElementById("rotationPageSize");
    rotationInterval.value = currentData.rotation.intervalSec || 60;
    rotationPageSize.value = currentData.rotation.pageSize || 1;
    populateBackgroundControls(
      getValidBackgroundStyle(currentData.display?.backgroundStyle)
    );
    const showWeekendsToggle = document.getElementById("showWeekendsToggle");
    const showWeekendsEnabled =
      currentData.display?.showWeekends === true;
    if (showWeekendsToggle) {
      showWeekendsToggle.checked = showWeekendsEnabled;
    }

    updateTicketsRemainingToggleUI();
    updateUseByTicketToggleUI();
    updateDepartmentLayoutUI();
    updateFontFamilyUI();

    const departmentsList = document.getElementById("departmentsList");
    departmentsList.innerHTML = "";

    if (!currentData.departments.length) {
      departmentsList.innerHTML =
        '<p class="empty-placeholder">Отделения не добавлены. Нажмите «Добавить отделение».</p>';
      return;
    }

    currentData.departments.forEach((dept, index) => {
      departmentsList.insertAdjacentHTML(
        "beforeend",
        renderDepartmentCard(dept, index)
      );
    });

    applyWeekendVisibility(showWeekendsEnabled);
  }

  function groupDoctorsBySpecialty(doctors) {
    const groups = new Map();
    
    doctors.forEach((doctor, index) => {
      const specialty = doctor.specialty?.trim() || "Без специальности";
      if (!groups.has(specialty)) {
        groups.set(specialty, []);
      }
      groups.get(specialty).push({ doctor, originalIndex: index });
    });
    
    return groups;
  }

  function renderDepartmentCard(dept, index) {
    let doctorsHtml = "";
    
    if (dept.doctors.length === 0) {
      doctorsHtml = '<div class="doctor-card-empty">Врачи не добавлены</div>';
    } else {
      const specialtyGroups = groupDoctorsBySpecialty(dept.doctors);
      const specialtyHtmls = [];
      
      specialtyGroups.forEach((doctorsInGroup, specialty) => {
        const doctorsListHtml = doctorsInGroup
          .map(({ doctor, originalIndex }) => 
            renderDoctorCard(doctor, dept.id, originalIndex, specialty)
          )
          .join("");
        
        specialtyHtmls.push(`
          <div class="specialty-group" data-specialty="${escapeHtml(specialty)}">
            <div class="specialty-group-header">
              <h5 class="specialty-title">${escapeHtml(specialty)}</h5>
              <button type="button" tabindex="-1" class="btn btn-success btn-sm" data-action="add-doctor-to-specialty" data-dept-id="${dept.id}" data-specialty="${escapeHtml(specialty)}">+ Добавить врача</button>
            </div>
            <div class="doctor-list">
              ${doctorsListHtml}
            </div>
          </div>
        `);
      });
      
      doctorsHtml = specialtyHtmls.join("");
    }

    return `
      <div class="department-card" data-dept-id="${dept.id}">
        <div class="department-card-header">
          <h3>Отделение #${index + 1}</h3>
          <div class="department-actions">
            <button type="button" tabindex="-1" class="btn btn-secondary btn-sm" data-action="move-up" data-dept-id="${dept.id}" ${index === 0 ? "disabled" : ""}>↑</button>
            <button type="button" tabindex="-1" class="btn btn-secondary btn-sm" data-action="move-down" data-dept-id="${dept.id}" ${index === currentData.departments.length - 1 ? "disabled" : ""}>↓</button>
            <button type="button" tabindex="-1" class="btn btn-danger btn-sm" data-action="remove-dept" data-dept-id="${dept.id}">Удалить</button>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Номер отделения</label>
            <input type="text" class="form-input" name="deptNumber" value="${escapeHtml(dept.number)}" placeholder="Например, 1" />
          </div>
          <div class="form-group">
            <label>Название отделения</label>
            <input type="text" class="form-input" name="deptName" value="${escapeHtml(dept.name)}" placeholder="Название" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group form-group-inline">
            <label>
              <input type="checkbox" name="deptShow" ${dept.showInRotation ? "checked" : ""} />
              Показывать на табло
            </label>
          </div>
        </div>
        <div class="department-doctors-header">
          <h4>Врачи отделения</h4>
          <button type="button" tabindex="-1" class="btn btn-success btn-sm" data-action="add-doctor" data-dept-id="${dept.id}">+ Добавить врача (новая специальность)</button>
        </div>
        <div class="specialty-groups-container">
          ${doctorsHtml}
        </div>
      </div>
    `;
  }

  function renderDoctorCard(doctor, deptId, index, currentSpecialty = null) {
    return `
      <div class="doctor-form${doctor.hidden ? " is-doctor-hidden" : ""}" data-doctor-id="${doctor.id}" data-dept-id="${deptId}" data-updated-at="${doctor.updatedAt || ""}">
        <div class="doctor-form-header">
          <h5>Врач #${index + 1}</h5>
          <div class="doctor-form-actions">
            <button type="button" tabindex="-1" class="btn btn-danger btn-sm" data-action="remove-doctor" data-dept-id="${deptId}" data-doctor-id="${doctor.id}">Удалить</button>
          </div>
        </div>
        <div class="form-row form-row-vertical">
          <div class="form-group form-group-horizontal">
            <label>ФИО</label>
            <input type="text" class="form-input" name="doctorFullName" value="${escapeHtml(
              doctor.fullName
            )}" placeholder="Фамилия Имя Отчество" />
          </div>
          <div class="form-group form-group-horizontal">
            <label>Специальность</label>
            <input type="text" class="form-input" name="doctorSpecialty" value="${escapeHtml(
              doctor.specialty
            )}" placeholder="Специальность" data-current-specialty="${escapeHtml(currentSpecialty || "")}" />
          </div>
          <div class="form-group form-group-horizontal">
            <label>Кабинет</label>
            <input type="text" class="form-input" name="doctorOffice" value="${escapeHtml(
              doctor.office
            )}" placeholder="203" />
          </div>
        </div>
        <div class="form-row form-row-pair">
          <div class="form-group form-group-inline">
            ${isUseByTicketEnabled() ? `
            <label>
              <input type="checkbox" name="acceptsByTicket" ${doctor.accepts.byTicket ? "checked" : ""} />
              Прием по талону
            </label>
            ` : ""}
            <label>
              <input type="checkbox" name="acceptsWithoutTicket" ${doctor.accepts.withoutTicket ? "checked" : ""} />
              Прием без талона
            </label>
            <label>
              <input type="checkbox" name="parityEven" ${doctor.parity?.even !== false ? "checked" : ""} />
              Чётные
            </label>
            <label>
              <input type="checkbox" name="parityOdd" ${doctor.parity?.odd !== false ? "checked" : ""} />
              Нечётные
            </label>
            <label class="doctor-hidden-toggle">
              <input type="checkbox" name="doctorHidden" ${doctor.hidden ? "checked" : ""} />
              Скрыть врача
            </label>
          </div>
          <div class="form-group">
            <label>Описание кабинета</label>
            <textarea class="form-textarea" name="doctorOfficeDescription" rows="2" placeholder="Описание кабинета врача">${escapeHtml(doctor.officeDescription || "")}</textarea>
          </div>
        </div>
        <div class="schedule-wrapper">
          ${isUseByTicketEnabled() ? renderScheduleMode(doctor.schedule.byTicket, "byTicket", "По талону") : ""}
          ${renderScheduleMode(
            doctor.schedule.withoutTicket,
            "withoutTicket",
            "Без талона"
          )}
        </div>
      </div>
    `;
  }

  function renderScheduleMode(week, modeKey, label) {
    const showWeekends = isWeekendsEnabled();
    const rows = EDITABLE_DAYS.map((day) => {
      const entry = week?.[day] || { time: "", tickets: "" };
      const isWeekend = day === "Сб";
      // Суббота показывается только при включённом переключателе
      const shouldHide = day === "Сб" && !showWeekends;
      return `
        <div class="schedule-day ${shouldHide ? 'is-hidden' : ''}" data-mode="${modeKey}" data-day="${day}" ${isWeekend ? 'data-weekend="true"' : ''}>
          <div class="schedule-day-label">${day}</div>
          <div class="schedule-day-inputs">
            <input
              type="text"
              class="form-input schedule-input"
              data-field="time"
              placeholder="09:00–13:00"
              value="${escapeHtml(entry.time || "")}"
            />
            <input
              type="number"
              class="form-input schedule-input"
              data-field="tickets"
              placeholder="Количество талонов"
              min="0"
              value="${entry.tickets === "" ? "" : escapeHtml(String(entry.tickets))}"
            />
          </div>
        </div>
      `;
    }).join("");

    return `
      <section class="schedule-mode" data-mode="${modeKey}">
        <header class="schedule-mode-header">
          <h6>${label}</h6>
        </header>
        <div class="schedule-grid">
          ${rows}
        </div>
      </section>
    `;
  }

  function setupEventListeners() {
    const saveBtn = document.getElementById("saveBtn");
    if (saveBtn) {
      saveBtn.addEventListener("click", handleSaveClick);
    }

    const loadFromConfigBtn = document.getElementById("loadFromConfigBtn");
    if (loadFromConfigBtn) {
      loadFromConfigBtn.addEventListener("click", handleLoadFromConfig);
    }

    const saveConfigBtn = document.getElementById("saveConfigBtn");
    if (saveConfigBtn) {
      saveConfigBtn.addEventListener("click", handleSaveConfig);
    }

    const configList = document.getElementById("configList");
    if (configList) {
      configList.addEventListener("click", handleConfigListClick);
    }

    const saveToConfigBtn = document.getElementById("saveToConfigBtn");
    if (saveToConfigBtn) {
      saveToConfigBtn.addEventListener("click", handleSaveToConfig);
    }

    const addDepartmentBtn = document.getElementById("addDepartmentBtn");
    if (addDepartmentBtn) {
      addDepartmentBtn.addEventListener("click", handleAddDepartment);
    }

    const departmentsList = document.getElementById("departmentsList");
    if (departmentsList) {
      departmentsList.addEventListener("click", handleDepartmentsListClick);
      departmentsList.addEventListener("keydown", handleFieldKeydown);
      departmentsList.addEventListener("change", handleHiddenToggle);
    }

    const themeSelect = document.getElementById("themeSelect");
    if (themeSelect) {
      themeSelect.addEventListener("change", handleThemeSelectChange);
    }

    const showWeekendsToggle = document.getElementById("showWeekendsToggle");
    if (showWeekendsToggle) {
      showWeekendsToggle.addEventListener("change", handleWeekendToggle);
    }

    const showTicketsRemainingToggle = document.getElementById("showTicketsRemainingToggle");
    if (showTicketsRemainingToggle) {
      showTicketsRemainingToggle.addEventListener("change", handleTicketsRemainingToggle);
    }

    const useByTicketToggle = document.getElementById("useByTicketToggle");
    if (useByTicketToggle) {
      useByTicketToggle.addEventListener("change", handleUseByTicketToggle);
    }

    const departmentLayout = document.getElementById("departmentLayout");
    if (departmentLayout) {
      departmentLayout.addEventListener("change", handleDepartmentLayoutChange);
    }

    const fontFamily = document.getElementById("fontFamily");
    if (fontFamily) {
      fontFamily.addEventListener("change", handleFontFamilyChange);
    }

    document
      .querySelectorAll('input[name="backgroundStyle"]')
      .forEach((input) => {
        input.addEventListener("change", handleBackgroundChange);
      });
  }

  function handleAddDepartment() {
    syncCurrentData();
    currentData.departments.push(createEmptyDepartment());
    renderForm();
  }

  // Enter в поле ввода переводит к следующему полю, Shift+Enter — к предыдущему
  function handleFieldKeydown(event) {
    if (event.key !== "Enter" || event.target.tagName !== "INPUT") return;
    if (event.target.type === "checkbox") return;

    event.preventDefault();
    const fields = Array.from(
      document.querySelectorAll(
        "#departmentsList input:not([type=checkbox]), #departmentsList textarea"
      )
    ).filter((el) => !el.disabled && el.offsetParent !== null);

    const index = fields.indexOf(event.target);
    if (index === -1) return;

    const next = fields[index + (event.shiftKey ? -1 : 1)];
    if (next) {
      next.focus();
      if (typeof next.select === "function") next.select();
    }
  }

  function handleHiddenToggle(event) {
    if (event.target.name !== "doctorHidden") return;
    const form = event.target.closest(".doctor-form");
    if (form) {
      form.classList.toggle("is-doctor-hidden", event.target.checked);
    }
  }

  function handleDepartmentsListClick(event) {
    const actionBtn = event.target.closest("[data-action]");
    if (!actionBtn) return;

    const action = actionBtn.dataset.action;
    const deptId = actionBtn.dataset.deptId;
    const doctorId = actionBtn.dataset.doctorId;

    switch (action) {
      case "remove-dept":
        removeDepartment(deptId);
        break;
      case "move-up":
        moveDepartment(deptId, -1);
        break;
      case "move-down":
        moveDepartment(deptId, 1);
        break;
      case "add-doctor":
        addDoctorToDepartment(deptId);
        break;
      case "add-doctor-to-specialty":
        const specialty = actionBtn.dataset.specialty;
        addDoctorToDepartment(deptId, specialty);
        break;
      case "remove-doctor":
        removeDoctorFromDepartment(deptId, doctorId);
        break;
      default:
        break;
    }
  }

  function removeDepartment(deptId) {
    if (!confirm("Удалить отделение и всех его врачей?")) return;
    syncCurrentData();
    currentData.departments = currentData.departments.filter(
      (dept) => dept.id !== deptId
    );
    renderForm();
    showNotification("Отделение удалено", "success");
  }

  function moveDepartment(deptId, direction) {
    syncCurrentData();
    const index = currentData.departments.findIndex((dept) => dept.id === deptId);
    const targetIndex = index + direction;
    if (index === -1 || targetIndex < 0 || targetIndex >= currentData.departments.length) {
      return;
    }
    const [dept] = currentData.departments.splice(index, 1);
    currentData.departments.splice(targetIndex, 0, dept);
    renderForm();
  }

  function addDoctorToDepartment(deptId, specialty = null) {
    syncCurrentData();
    const dept = currentData.departments.find((d) => d.id === deptId);
    if (!dept) return;
    const newDoctor = createEmptyDoctor();
    if (specialty) {
      newDoctor.specialty = specialty;
    }
    dept.doctors.push(newDoctor);
    renderForm();
    showNotification("Добавлен новый врач", "success");
  }

  function removeDoctorFromDepartment(deptId, doctorId) {
    if (!confirm("Удалить врача?")) return;
    syncCurrentData();
    const dept = currentData.departments.find((d) => d.id === deptId);
    if (!dept) return;
    dept.doctors = dept.doctors.filter((doc) => doc.id !== doctorId);
    renderForm();
    showNotification("Врач удален", "success");
  }

  function handleLoadFromConfig() {
    if (!cfg || !cfg.mockData) {
      showNotification("Данные из config.js не найдены", "error");
      return;
    }
    
    if (!confirm("Загрузить данные из config.js? Текущие несохраненные изменения будут потеряны.")) {
      return;
    }

    try {
      const configData = structuredClone(cfg.mockData);
      currentData = normalizeData(configData);
      renderForm();
      showNotification("Данные загружены из config.js", "success");
    } catch (err) {
      console.error("Ошибка загрузки из config.js:", err);
      showNotification("Не удалось загрузить данные из config.js", "error");
    }
  }

  // Парная кнопка к «Загрузить из config.js»: пишет текущие данные в файл
  async function handleSaveToConfig() {
    if (
      !confirm(
        "Записать текущие настройки в config.js? Прежняя версия файла будет сохранена как config.backup.js."
      )
    ) {
      return;
    }

    syncCurrentData();

    try {
      const response = await fetch("/api/config-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: currentData,
          settings: {
            dataSource: cfg?.dataSource,
            backendUrl: cfg?.backendUrl,
            pollIntervalMs: cfg?.pollIntervalMs,
            retryBackoff: cfg?.retryBackoff,
            orientation: cfg?.orientation,
            theme: cfg?.theme,
          },
        }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      showNotification("Данные записаны в config.js", "success");
    } catch (err) {
      console.error("Ошибка записи config.js:", err);
      showNotification("Не удалось записать config.js", "error");
    }
  }

  function handleSaveClick() {
    try {
      currentData = readDataFromForm({ forSave: true });
      localStorage.setItem(storageKey, JSON.stringify(currentData));

      if (cfg && cfg.mockData) {
        Object.assign(cfg.mockData, currentData);
      }

      sendToServer(currentData)
        .then(() => showNotification("Данные сохранены", "success"))
        .catch((err) => {
          console.warn("Ошибка отправки на сервер:", err);
          showNotification(
            "Сохранено локально. Ошибка отправки на сервер",
            "error"
          );
        });
    } catch (err) {
      console.error("Ошибка сохранения:", err);
      showNotification("Не удалось сохранить данные", "error");
    }
  }

  function syncCurrentData() {
    currentData = readDataFromForm({ forSave: false });
  }

  // Врач из уже загруженных данных — нужен, чтобы не терять то,
  // чего сейчас нет на экране
  function findStoredDoctor(deptId, doctorId) {
    const dept = currentData.departments?.find((item) => item.id === deptId);
    return dept?.doctors?.find((doc) => doc.id === doctorId) || null;
  }

  function readDataFromForm({ forSave }) {
    const rotationInterval = document.getElementById("rotationInterval");
    const rotationPageSize = document.getElementById("rotationPageSize");
    const backgroundInput = document.querySelector(
      'input[name="backgroundStyle"]:checked'
    );
    const showWeekendsToggle = document.getElementById("showWeekendsToggle");
    const showTicketsRemainingToggle = document.getElementById("showTicketsRemainingToggle");
    const useByTicketToggle = document.getElementById("useByTicketToggle");
    const departmentLayoutSelect = document.getElementById("departmentLayout");
    const fontFamilySelect = document.getElementById("fontFamily");

    const intervalSec = Math.max(
      5,
      Number(rotationInterval.value || currentData.rotation.intervalSec || 60)
    );
    const pageSize = Math.max(
      1,
      Number(rotationPageSize.value || currentData.rotation.pageSize || 1)
    );

    const deptCards = Array.from(
      document.querySelectorAll(".department-card")
    );

    const backgroundStyle = getValidBackgroundStyle(
      backgroundInput?.value || currentData.display?.backgroundStyle
    );
    const showWeekends = Boolean(showWeekendsToggle?.checked);
    const showTicketsRemaining = Boolean(showTicketsRemainingToggle?.checked);
    const useByTicket = Boolean(useByTicketToggle?.checked);
    const departmentLayout = departmentLayoutSelect?.value || DEFAULT_DEPARTMENT_LAYOUT;
    const fontFamily = fontFamilySelect?.value || DEFAULT_FONT_FAMILY;

    const departments = deptCards.map((card, index) => {
      const deptId = card.dataset.deptId || `dept-${index + 1}`;
      const nameInput = card.querySelector('input[name="deptName"]');
      const numberInput = card.querySelector('input[name="deptNumber"]');
      const showCheckbox = card.querySelector('input[name="deptShow"]');

      const doctorForms = Array.from(
        card.querySelectorAll(".doctor-form")
      );

      const doctors = doctorForms.map((form, idx) => {
        const doctorId = form.dataset.doctorId || createDoctorId();
        const updatedAt = form.dataset.updatedAt || new Date().toISOString();

        // При выключенном режиме «по талону» полей в форме нет, поэтому берём
        // ранее введённые данные из памяти, а не затираем их
        const storedDoctor = findStoredDoctor(deptId, doctorId);

        const acceptsByTicket = useByTicket
          ? form.querySelector('input[name="acceptsByTicket"]')?.checked
          : storedDoctor?.accepts?.byTicket;
        const acceptsWithoutTicket = form.querySelector(
          'input[name="acceptsWithoutTicket"]'
        )?.checked;

        const schedule = {};
        for (const modeKey of ["byTicket", "withoutTicket"]) {
          // Если полей этого режима на экране нет, сохраняем ранее введённое
          if (!form.querySelector(`.schedule-day[data-mode="${modeKey}"]`)) {
            schedule[modeKey] =
              normalizeWeek(storedDoctor?.schedule?.[modeKey]) || createEmptyWeek();
            continue;
          }

          schedule[modeKey] = {};
          for (const day of DAY_ORDER) {
            const container = form.querySelector(
              `.schedule-day[data-mode="${modeKey}"][data-day="${day}"]`
            );
            if (!container) {
              // День скрыт (например воскресенье) — берём старое значение
              schedule[modeKey][day] = storedDoctor?.schedule?.[modeKey]?.[day] || {
                time: "",
                tickets: "",
              };
              continue;
            }
            const timeInput = container.querySelector(
              '.schedule-input[data-field="time"]'
            );
            const ticketsInput = container.querySelector(
              '.schedule-input[data-field="tickets"]'
            );
            const timeValue = (timeInput?.value || "").trim();
            const ticketsValueRaw = ticketsInput?.value;
            let ticketsValue = "";
            if (ticketsValueRaw !== "" && ticketsValueRaw !== undefined) {
              const num = Number(ticketsValueRaw);
              ticketsValue = Number.isNaN(num) ? ticketsValueRaw : num;
            }
            schedule[modeKey][day] = {
              time: timeValue,
              tickets: ticketsValue,
            };
          }
        }

        return {
          id: doctorId,
          fullName:
            form.querySelector('input[name="doctorFullName"]')?.value.trim() ||
            "",
          specialty:
            form.querySelector('input[name="doctorSpecialty"]')?.value.trim() ||
            "",
          office:
            form.querySelector('input[name="doctorOffice"]')?.value.trim() ||
            "",
          officeDescription:
            form.querySelector('textarea[name="doctorOfficeDescription"]')?.value.trim() ||
            "",
          hidden: Boolean(
            form.querySelector('input[name="doctorHidden"]')?.checked
          ),
          parity: {
            even: Boolean(form.querySelector('input[name="parityEven"]')?.checked),
            odd: Boolean(form.querySelector('input[name="parityOdd"]')?.checked),
          },
          accepts: {
            byTicket: Boolean(acceptsByTicket),
            withoutTicket: Boolean(acceptsWithoutTicket),
          },
          schedule,
          updatedAt: forSave ? new Date().toISOString() : updatedAt,
        };
      });

      return {
        id: deptId,
        number: numberInput?.value.trim() || "",
        name: nameInput?.value.trim() || `Отделение ${index + 1}`,
        showInRotation: Boolean(showCheckbox?.checked),
        sortOrder: index + 1,
        doctors,
      };
    });

    const departmentOrder = departments.map((dept) => dept.id);

    return {
      rotation: {
        intervalSec,
        pageSize,
        departmentOrder,
      },
      departments,
      display: {
        backgroundStyle,
        showWeekends,
        showTicketsRemaining,
        useByTicket,
        departmentLayout,
        fontFamily,
      },
      updatedAt: forSave ? new Date().toISOString() : currentData.updatedAt,
    };
  }

  // ——— Сохранённые конфигурации ———

  async function refreshConfigList() {
    const list = document.getElementById("configList");
    if (!list) return;

    try {
      const response = await fetch("/api/configs");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      renderConfigList(await response.json());
    } catch (err) {
      console.warn("Не удалось загрузить список конфигураций:", err);
      list.innerHTML =
        '<p class="config-empty">Сервер недоступен — список конфигураций не загружен.</p>';
    }
  }

  function renderConfigList(configs) {
    const list = document.getElementById("configList");
    if (!list) return;

    if (!Array.isArray(configs) || configs.length === 0) {
      list.innerHTML =
        '<p class="config-empty">Сохранённых конфигураций пока нет.</p>';
      return;
    }

    list.innerHTML = configs
      .map(
        (config) => `
      <div class="config-item" data-config-id="${escapeHtml(config.id)}">
        <span class="config-item-name">${escapeHtml(config.name)}</span>
        <span class="config-item-date">${escapeHtml(
          formatConfigDate(config.createdAt)
        )}</span>
        <button type="button" class="btn btn-primary btn-sm" data-config-action="restore">Восстановить</button>
        <button type="button" class="btn btn-danger btn-sm" data-config-action="delete">Удалить</button>
      </div>
    `
      )
      .join("");
  }

  function formatConfigDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  async function handleSaveConfig() {
    const nameInput = document.getElementById("configName");
    const name = (nameInput?.value || "").trim();

    if (!name) {
      showNotification("Введите название конфигурации", "error");
      nameInput?.focus();
      return;
    }

    syncCurrentData();

    try {
      const response = await fetch("/api/configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, data: currentData }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      if (nameInput) nameInput.value = "";
      await refreshConfigList();
      showNotification("Конфигурация сохранена", "success");
    } catch (err) {
      console.error("Ошибка сохранения конфигурации:", err);
      showNotification("Не удалось сохранить конфигурацию", "error");
    }
  }

  function handleConfigListClick(event) {
    const button = event.target.closest("[data-config-action]");
    if (!button) return;

    const item = button.closest(".config-item");
    const id = item?.dataset.configId;
    if (!id) return;

    if (button.dataset.configAction === "restore") {
      restoreConfig(id, item.querySelector(".config-item-name")?.textContent);
    } else {
      deleteConfig(id);
    }
  }

  async function restoreConfig(id, name) {
    const title = name || id;
    if (
      !confirm(
        `Восстановить конфигурацию «${title}»? Текущие настройки будут заменены.`
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/configs/${encodeURIComponent(id)}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const config = await response.json();

      currentData = normalizeData(config.data);
      renderForm();

      // Применяем ко всей программе: локально и на сервере
      localStorage.setItem(storageKey, JSON.stringify(currentData));
      await sendToServer(currentData);

      showNotification("Конфигурация восстановлена", "success");
    } catch (err) {
      console.error("Ошибка восстановления:", err);
      showNotification("Не удалось восстановить конфигурацию", "error");
    }
  }

  async function deleteConfig(id) {
    if (!confirm("Удалить сохранённую конфигурацию?")) return;

    try {
      const response = await fetch(`/api/configs/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await refreshConfigList();
      showNotification("Конфигурация удалена", "success");
    } catch (err) {
      console.error("Ошибка удаления:", err);
      showNotification("Не удалось удалить конфигурацию", "error");
    }
  }

  async function sendToServer(data) {
    try {
      const response = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    } catch (err) {
      console.warn("Сервер недоступен, данные сохранены локально");
      throw err;
    }
  }

  function showNotification(message, type = "success") {
    const notification = document.getElementById("notification");
    notification.textContent = message;
    notification.className = `notification ${type} show`;
    setTimeout(() => notification.classList.remove("show"), 3000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
