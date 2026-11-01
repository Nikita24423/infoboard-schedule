// Конфиг макета и поведения.
// Файл создан кнопкой «Сохранить в config.js» в админ-панели 28.10.2026, 20:15:24.
// Предыдущая версия лежит в config.backup.js

window.BoardConfig = {
  "dataSource": "backend",
  "backendUrl": "/api/schedule",
  "pollIntervalMs": 20000,
  "retryBackoff": {
    "baseMs": 5000,
    "maxMs": 60000
  },
  "orientation": "auto",
  "theme": {},
  "mockData": {
    "rotation": {
      "intervalSec": 60,
      "pageSize": 1,
      "departmentOrder": [
        "dept-therapy",
        "dept-surgery",
        "dept-cardiology",
        "dept-neurology"
      ]
    },
    "departments": [
      {
        "id": "dept-therapy",
        "number": "1",
        "name": "Терапевтическое отделение",
        "showInRotation": true,
        "sortOrder": 1,
        "doctors": [
          {
            "id": "doc-ivanov",
            "fullName": "Иванов И.И.",
            "specialty": "Терапевт",
            "office": "203",
            "officeDescription": "",
            "hidden": false,
            "parity": {
              "even": true,
              "odd": true
            },
            "accepts": {
              "byTicket": true,
              "withoutTicket": true
            },
            "schedule": {
              "byTicket": {
                "Пн": {
                  "time": "09:00–13:00",
                  "tickets": 12
                },
                "Вт": {
                  "time": "09:00–13:00",
                  "tickets": 12
                },
                "Ср": {
                  "time": "09:00–13:00",
                  "tickets": 12
                },
                "Чт": {
                  "time": "09:00–13:00",
                  "tickets": 12
                },
                "Пт": {
                  "time": "09:00–13:00",
                  "tickets": 12
                },
                "Сб": {
                  "time": "09:00–13:00",
                  "tickets": 12
                },
                "Вс": {
                  "time": "09:00–13:00",
                  "tickets": 12
                }
              },
              "withoutTicket": {
                "Пн": {
                  "time": "14:00–18:00",
                  "tickets": 0
                },
                "Вт": {
                  "time": "14:00–18:00",
                  "tickets": 0
                },
                "Ср": {
                  "time": "14:00–18:00",
                  "tickets": 0
                },
                "Чт": {
                  "time": "14:00–18:00",
                  "tickets": 0
                },
                "Пт": {
                  "time": "14:00–18:00",
                  "tickets": 0
                },
                "Сб": {
                  "time": "14:00–18:00",
                  "tickets": 0
                },
                "Вс": {
                  "time": "14:00–18:00",
                  "tickets": 0
                }
              }
            },
            "updatedAt": "2026-10-28T17:15:19.413Z"
          },
          {
            "id": "doc-petrova",
            "fullName": "Петрова А.А.",
            "specialty": "Педиатр",
            "office": "107",
            "officeDescription": "",
            "hidden": false,
            "parity": {
              "even": true,
              "odd": true
            },
            "accepts": {
              "byTicket": true,
              "withoutTicket": false
            },
            "schedule": {
              "byTicket": {
                "Пн": {
                  "time": "08:30–12:30",
                  "tickets": 10
                },
                "Вт": {
                  "time": "08:30–12:30",
                  "tickets": 10
                },
                "Ср": {
                  "time": "08:30–12:30",
                  "tickets": 10
                },
                "Чт": {
                  "time": "08:30–12:30",
                  "tickets": 10
                },
                "Пт": {
                  "time": "08:30–12:30",
                  "tickets": 10
                },
                "Сб": {
                  "time": "08:30–12:30",
                  "tickets": 10
                },
                "Вс": {
                  "time": "08:30–12:30",
                  "tickets": 10
                }
              },
              "withoutTicket": {
                "Пн": {
                  "time": "—",
                  "tickets": 0
                },
                "Вт": {
                  "time": "—",
                  "tickets": 0
                },
                "Ср": {
                  "time": "—",
                  "tickets": 0
                },
                "Чт": {
                  "time": "—",
                  "tickets": 0
                },
                "Пт": {
                  "time": "—",
                  "tickets": 0
                },
                "Сб": {
                  "time": "—",
                  "tickets": 0
                },
                "Вс": {
                  "time": "—",
                  "tickets": 0
                }
              }
            },
            "updatedAt": "2026-10-28T17:15:19.413Z"
          }
        ]
      },
      {
        "id": "dept-surgery",
        "number": "2",
        "name": "Хирургическое отделение",
        "showInRotation": true,
        "sortOrder": 2,
        "doctors": [
          {
            "id": "doc-sidorov",
            "fullName": "Сидоров Б.Б.",
            "specialty": "Хирург",
            "office": "310",
            "officeDescription": "",
            "hidden": false,
            "parity": {
              "even": true,
              "odd": true
            },
            "accepts": {
              "byTicket": false,
              "withoutTicket": true
            },
            "schedule": {
              "byTicket": {
                "Пн": {
                  "time": "—",
                  "tickets": 0
                },
                "Вт": {
                  "time": "—",
                  "tickets": 0
                },
                "Ср": {
                  "time": "—",
                  "tickets": 0
                },
                "Чт": {
                  "time": "—",
                  "tickets": 0
                },
                "Пт": {
                  "time": "—",
                  "tickets": 0
                },
                "Сб": {
                  "time": "—",
                  "tickets": 0
                },
                "Вс": {
                  "time": "—",
                  "tickets": 0
                }
              },
              "withoutTicket": {
                "Пн": {
                  "time": "13:00–18:00",
                  "tickets": 0
                },
                "Вт": {
                  "time": "13:00–18:00",
                  "tickets": 0
                },
                "Ср": {
                  "time": "13:00–18:00",
                  "tickets": 0
                },
                "Чт": {
                  "time": "13:00–18:00",
                  "tickets": 0
                },
                "Пт": {
                  "time": "13:00–18:00",
                  "tickets": 0
                },
                "Сб": {
                  "time": "13:00–18:00",
                  "tickets": 0
                },
                "Вс": {
                  "time": "13:00–18:00",
                  "tickets": 0
                }
              }
            },
            "updatedAt": "2026-10-28T17:15:19.413Z"
          }
        ]
      },
      {
        "id": "dept-cardiology",
        "number": "3",
        "name": "Кардиологическое отделение",
        "showInRotation": true,
        "sortOrder": 3,
        "doctors": [
          {
            "id": "doc-kuznetsov",
            "fullName": "Кузнецов В.В.",
            "specialty": "Кардиолог",
            "office": "415",
            "officeDescription": "",
            "hidden": false,
            "parity": {
              "even": true,
              "odd": true
            },
            "accepts": {
              "byTicket": true,
              "withoutTicket": true
            },
            "schedule": {
              "byTicket": {
                "Пн": {
                  "time": "08:00–12:00",
                  "tickets": 15
                },
                "Вт": {
                  "time": "08:00–12:00",
                  "tickets": 15
                },
                "Ср": {
                  "time": "08:00–12:00",
                  "tickets": 15
                },
                "Чт": {
                  "time": "08:00–12:00",
                  "tickets": 15
                },
                "Пт": {
                  "time": "08:00–12:00",
                  "tickets": 15
                },
                "Сб": {
                  "time": "08:00–12:00",
                  "tickets": 15
                },
                "Вс": {
                  "time": "08:00–12:00",
                  "tickets": 15
                }
              },
              "withoutTicket": {
                "Пн": {
                  "time": "14:00–17:00",
                  "tickets": 0
                },
                "Вт": {
                  "time": "14:00–17:00",
                  "tickets": 0
                },
                "Ср": {
                  "time": "14:00–17:00",
                  "tickets": 0
                },
                "Чт": {
                  "time": "14:00–17:00",
                  "tickets": 0
                },
                "Пт": {
                  "time": "14:00–17:00",
                  "tickets": 0
                },
                "Сб": {
                  "time": "14:00–17:00",
                  "tickets": 0
                },
                "Вс": {
                  "time": "14:00–17:00",
                  "tickets": 0
                }
              }
            },
            "updatedAt": "2026-10-28T17:15:19.413Z"
          },
          {
            "id": "doc-smirnova",
            "fullName": "Смирнова Е.П.",
            "specialty": "Кардиолог",
            "office": "416",
            "officeDescription": "",
            "hidden": false,
            "parity": {
              "even": true,
              "odd": true
            },
            "accepts": {
              "byTicket": true,
              "withoutTicket": false
            },
            "schedule": {
              "byTicket": {
                "Пн": {
                  "time": "09:00–13:00",
                  "tickets": 20
                },
                "Вт": {
                  "time": "09:00–13:00",
                  "tickets": 20
                },
                "Ср": {
                  "time": "09:00–13:00",
                  "tickets": 20
                },
                "Чт": {
                  "time": "09:00–13:00",
                  "tickets": 20
                },
                "Пт": {
                  "time": "09:00–13:00",
                  "tickets": 20
                },
                "Сб": {
                  "time": "09:00–13:00",
                  "tickets": 20
                },
                "Вс": {
                  "time": "09:00–13:00",
                  "tickets": 20
                }
              },
              "withoutTicket": {
                "Пн": {
                  "time": "—",
                  "tickets": 0
                },
                "Вт": {
                  "time": "—",
                  "tickets": 0
                },
                "Ср": {
                  "time": "—",
                  "tickets": 0
                },
                "Чт": {
                  "time": "—",
                  "tickets": 0
                },
                "Пт": {
                  "time": "—",
                  "tickets": 0
                },
                "Сб": {
                  "time": "—",
                  "tickets": 0
                },
                "Вс": {
                  "time": "—",
                  "tickets": 0
                }
              }
            },
            "updatedAt": "2026-10-28T17:15:19.413Z"
          }
        ]
      },
      {
        "id": "dept-neurology",
        "number": "4",
        "name": "Неврологическое отделение",
        "showInRotation": true,
        "sortOrder": 4,
        "doctors": [
          {
            "id": "doc-volkov",
            "fullName": "Волков Д.С.",
            "specialty": "Невролог",
            "office": "520",
            "officeDescription": "",
            "hidden": false,
            "parity": {
              "even": true,
              "odd": true
            },
            "accepts": {
              "byTicket": true,
              "withoutTicket": true
            },
            "schedule": {
              "byTicket": {
                "Пн": {
                  "time": "10:00–14:00",
                  "tickets": 18
                },
                "Вт": {
                  "time": "10:00–14:00",
                  "tickets": 18
                },
                "Ср": {
                  "time": "10:00–14:00",
                  "tickets": 18
                },
                "Чт": {
                  "time": "10:00–14:00",
                  "tickets": 18
                },
                "Пт": {
                  "time": "10:00–14:00",
                  "tickets": 18
                },
                "Сб": {
                  "time": "10:00–14:00",
                  "tickets": 18
                },
                "Вс": {
                  "time": "10:00–14:00",
                  "tickets": 18
                }
              },
              "withoutTicket": {
                "Пн": {
                  "time": "15:00–18:00",
                  "tickets": 0
                },
                "Вт": {
                  "time": "15:00–18:00",
                  "tickets": 0
                },
                "Ср": {
                  "time": "15:00–18:00",
                  "tickets": 0
                },
                "Чт": {
                  "time": "15:00–18:00",
                  "tickets": 0
                },
                "Пт": {
                  "time": "15:00–18:00",
                  "tickets": 0
                },
                "Сб": {
                  "time": "15:00–18:00",
                  "tickets": 0
                },
                "Вс": {
                  "time": "15:00–18:00",
                  "tickets": 0
                }
              }
            },
            "updatedAt": "2026-10-28T17:15:19.413Z"
          }
        ]
      }
    ],
    "display": {
      "backgroundStyle": "night-sky",
      "showWeekends": false,
      "showTicketsRemaining": true,
      "useByTicket": false,
      "departmentLayout": "2",
      "fontFamily": "Inter",
      "fontScale": 1
    },
    "updatedAt": "2026-10-28T17:15:19.413Z"
  }
};
