// Конфиг макета и поведения. Можно менять на лету.
const MOCK_NOW = new Date().toISOString();

function createWeek(time, tickets) {
  const days = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  return days.reduce((acc, day) => {
    acc[day] = { time, tickets };
    return acc;
  }, {});
}

window.BoardConfig = {
  dataSource: "backend", // "mock" | "backend"
  backendUrl: "/api/schedule",
  pollIntervalMs: 20000,
  retryBackoff: { baseMs: 5000, maxMs: 60000 },

  // Экран
  orientation: "auto", // "auto" | "landscape" | "portrait"
  theme: {
    // можно кастомизировать цвета через CSS-переменные при необходимости
  },

  // Демоданные
  mockData: {
    updatedAt: MOCK_NOW,
    rotation: {
      intervalSec: 60,
      pageSize: 1,
      departmentOrder: ["dept-therapy", "dept-surgery", "dept-cardiology", "dept-neurology"],
    },
    display: {
      backgroundStyle: "night-sky",
      showWeekends: false,
      showTicketsRemaining: true,
    },
    departments: [
      {
        id: "dept-therapy",
        number: "1",
        name: "Терапевтическое отделение",
        showInRotation: true,
        sortOrder: 1,
        doctors: [
          {
            id: "doc-ivanov",
            fullName: "Иванов И.И.",
            specialty: "Терапевт",
            office: "203",
            accepts: {
              byTicket: true,
              withoutTicket: true,
            },
            schedule: {
              byTicket: createWeek("09:00–13:00", 12),
              withoutTicket: createWeek("14:00–18:00", 0),
            },
            updatedAt: MOCK_NOW,
          },
          {
            id: "doc-petrova",
            fullName: "Петрова А.А.",
            specialty: "Педиатр",
            office: "107",
            accepts: {
              byTicket: true,
              withoutTicket: false,
            },
            schedule: {
              byTicket: createWeek("08:30–12:30", 10),
              withoutTicket: createWeek("—", 0),
            },
            updatedAt: MOCK_NOW,
          },
        ],
      },
      {
        id: "dept-surgery",
        number: "2",
        name: "Хирургическое отделение",
        showInRotation: true,
        sortOrder: 2,
        doctors: [
          {
            id: "doc-sidorov",
            fullName: "Сидоров Б.Б.",
            specialty: "Хирург",
            office: "310",
            accepts: {
              byTicket: false,
              withoutTicket: true,
            },
            schedule: {
              byTicket: createWeek("—", 0),
              withoutTicket: createWeek("13:00–18:00", 0),
            },
            updatedAt: MOCK_NOW,
          },
        ],
      },
      {
        id: "dept-cardiology",
        number: "3",
        name: "Кардиологическое отделение",
        showInRotation: true,
        sortOrder: 3,
        doctors: [
          {
            id: "doc-kuznetsov",
            fullName: "Кузнецов В.В.",
            specialty: "Кардиолог",
            office: "415",
            accepts: {
              byTicket: true,
              withoutTicket: true,
            },
            schedule: {
              byTicket: createWeek("08:00–12:00", 15),
              withoutTicket: createWeek("14:00–17:00", 0),
            },
            updatedAt: MOCK_NOW,
          },
          {
            id: "doc-smirnova",
            fullName: "Смирнова Е.П.",
            specialty: "Кардиолог",
            office: "416",
            accepts: {
              byTicket: true,
              withoutTicket: false,
            },
            schedule: {
              byTicket: createWeek("09:00–13:00", 20),
              withoutTicket: createWeek("—", 0),
            },
            updatedAt: MOCK_NOW,
          },
        ],
      },
      {
        id: "dept-neurology",
        number: "4",
        name: "Неврологическое отделение",
        showInRotation: true,
        sortOrder: 4,
        doctors: [
          {
            id: "doc-volkov",
            fullName: "Волков Д.С.",
            specialty: "Невролог",
            office: "520",
            accepts: {
              byTicket: true,
              withoutTicket: true,
            },
            schedule: {
              byTicket: createWeek("10:00–14:00", 18),
              withoutTicket: createWeek("15:00–18:00", 0),
            },
            updatedAt: MOCK_NOW,
          },
        ],
      },
    ],
  },
};