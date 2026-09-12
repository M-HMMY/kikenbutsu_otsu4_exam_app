@echo off
rem ---------------------------------------------------------------
rem  Launcher for the Seisei-AI Passport study app.
rem  Called from the desktop shortcut. The real work is in launch.ps1
rem  (window title and messages are set there, in Japanese).
rem
rem  This file is kept ASCII-only on purpose: cmd reads .cmd files in
rem  the OEM code page, so Japanese text here would be garbled.
rem ---------------------------------------------------------------
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0launch.ps1"
if errorlevel 1 pause
