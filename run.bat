@echo off
chcp 65001 > nul
title PDF-Lingua - Quick Launcher

set ROOT_DIR=%~dp0
set BACKEND_DIR=%ROOT_DIR%Code\backend
set FRONTEND_FILE=%ROOT_DIR%Code\frontend\index.html
set VENV_PYTHON=%BACKEND_DIR%\venv\Scripts\python.exe
set VENV_PIP=%BACKEND_DIR%\venv\Scripts\pip.exe

:MENU
cls
echo ======================================================================
echo                      PDF-LINGUA - CONTROL PANEL
echo ======================================================================
echo.
echo   [1] Khoi dong He thong (Backend Server + Mo Giao dien Frontend)
echo   [2] Chay toan bo bo Kiem thu tu dong (144 Test Cases)
echo   [3] Cai dat / Cap nhat Dependencies (pip install)
echo   [4] Mo tai lieu API Swagger Docs (http://127.0.0.1:8000/docs)
echo   [0] Thoat
echo.
echo ======================================================================
set /p CHOICE="Nhap lua chon cua ban [0-4]: "

if "%CHOICE%"=="1" goto START_SYSTEM
if "%CHOICE%"=="2" goto RUN_TESTS
if "%CHOICE%"=="3" goto INSTALL_DEPS
if "%CHOICE%"=="4" goto OPEN_DOCS
if "%CHOICE%"=="0" goto EXIT_APP

echo.
echo [!] Lua chon khong hop le. Vui long chon tu 0 den 4.
timeout /t 2 > nul
goto MENU

:START_SYSTEM
cls
echo ======================================================================
echo                 DANG KHOI DONG HE THONG PDF-LINGUA
echo ======================================================================
echo.
if not exist "%VENV_PYTHON%" (
    echo [!] Khong tim thay moi truong ao venv tai:
    echo     %VENV_PYTHON%
    echo     Vui long chon muc [3] de cai dat moi truong truoc.
    pause
    goto MENU
)

echo [*] Dang mo giao dien nguoi dung tren trinh duyet...
start "" "%FRONTEND_FILE%"

echo [*] Khoi dong Backend API Server tai http://127.0.0.1:8000 ...
echo [*] Nhan Ctrl + C tren cua so nay de dung server khi hoan tat.
echo.
cd /d "%BACKEND_DIR%"
"%VENV_PYTHON%" -m uvicorn app.main:app --reload --port 8000
echo.
echo [!] Server da dung.
pause
goto MENU

:RUN_TESTS
cls
echo ======================================================================
echo                DANG CHAY BO KIEM THU TU DONG PYTEST
echo ======================================================================
echo.
if not exist "%VENV_PYTHON%" (
    echo [!] Khong tim thay moi truong ao venv tai %VENV_PYTHON%
    pause
    goto MENU
)

cd /d "%BACKEND_DIR%"
echo [*] Dang thuc thi: pytest tests -v
echo.
"%VENV_PYTHON%" -m pytest tests -v
echo.
echo ======================================================================
pause
goto MENU

:INSTALL_DEPS
cls
echo ======================================================================
echo                 CAI DAT / CAP NHAT DEPENDENCIES
echo ======================================================================
echo.
if not exist "%VENV_PYTHON%" (
    echo [*] Dang khoi tao moi truong ao python venv moi...
    cd /d "%BACKEND_DIR%"
    python -m venv venv
    if errorlevel 1 (
        echo [!] Khong the tao venv. Hay dam bao ban da cai dat Python 3.10+ tren may.
        pause
        goto MENU
    )
)

echo [*] Dang cai dat thu vien tu requirements.txt...
cd /d "%BACKEND_DIR%"
"%VENV_PIP%" install --upgrade pip
"%VENV_PIP%" install -r requirements.txt
echo.
echo [*] Hoan tat cai dat dependencies.
pause
goto MENU

:OPEN_DOCS
cls
echo [*] Dang mo tai lieu API Swagger tren trinh duyet...
start "" "http://127.0.0.1:8000/docs"
timeout /t 2 > nul
goto MENU

:EXIT_APP
cls
echo Cam on ban da su dung PDF-Lingua!
timeout /t 1 > nul
exit

