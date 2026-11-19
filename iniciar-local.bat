@echo off
title Chaperia Pro - Lanzador Local (PostgreSQL 18 + NestJS + Angular)
echo ============================================================================
echo   INICIANDO SISTEMA CHAPERIA PRO (CHILE - BOLIVIA) EN MODO LOCAL
echo ============================================================================
echo.
echo [1/2] Levantando Backend NestJS + PostgreSQL 18 en http://localhost:3000/api ...
start "Chaperia Backend (NestJS)" cmd /k "cd /d %~dp0Backend && npm run start:dev"

echo [2/2] Levantando Frontend Angular + Signals en http://localhost:4200 ...
start "Chaperia Frontend (Angular)" cmd /k "cd /d %~dp0Frontend && npm start"

echo.
echo Listo! En unos segundos abre en tu navegador: http://localhost:4200
pause

