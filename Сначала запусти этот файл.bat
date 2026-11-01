@echo off
chcp 65001 >nul
echo ========================================
echo   Запуск проекта информационного табло
echo ========================================
echo.

REM Получаем путь к директории, где находится этот batch файл
REM Папку с файлами программы ищем по server.js — так имя папки не важно
set "PROJECT_PATH="
for /d %%D in ("%~dp0*") do if exist "%%~fD\server.js" set "PROJECT_PATH=%%~fD"
if not defined PROJECT_PATH (
    echo ОШИБКА: рядом с этим файлом нет папки с программой!
    pause
    exit /b 1
)

echo [1/4] Путь к проекту: %PROJECT_PATH%
echo.

REM Переходим в директорию проекта
echo [2/4] Переход в директорию проекта...
cd /d "%PROJECT_PATH%"
if errorlevel 1 (
    echo ОШИБКА: Не удалось перейти в директорию проекта!
    pause
    exit /b 1
)
echo Успешно перешли в директорию проекта.
echo.

REM Проверяем наличие npm
echo [3/4] Проверка наличия npm...
where npm >nul 2>&1
if errorlevel 1 (
    echo ОШИБКА: npm не найден! Убедитесь, что Node.js установлен.
    pause
    exit /b 1
)
echo npm найден.
echo.

REM Устанавливаем зависимости (если node_modules не существует)
echo [4/4] Установка зависимостей (npm install)...
if not exist "node_modules\express\package.json" (
    echo Установка зависимостей...
    call npm install
    if errorlevel 1 (
        echo ОШИБКА: Не удалось установить зависимости!
        pause
        exit /b 1
    )
    echo Зависимости успешно установлены!
) else (
    echo Зависимости уже установлены, пропускаем...
)
echo.

REM Запускаем сервер
echo ========================================
echo   Запуск сервера (npm start)
echo ========================================
echo.
npm start

