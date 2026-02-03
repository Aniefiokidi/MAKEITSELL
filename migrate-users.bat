@echo off
echo.
echo 📧 Email Verification Migration Helper (Windows)
echo.

if "%1"=="" goto help
if "%1"=="help" goto help

echo Running migration with filter: %1
node migrate-existing-users.js "%1"
goto end

:help
echo Available commands:
echo.
echo   migrate-users.bat                    - Migrate all unverified users
echo   migrate-users.bat @gmail.com         - Migrate users with @gmail in email  
echo   migrate-users.bat user@example.com   - Migrate specific user
echo.
echo PowerShell users can also use quotes:
echo   node migrate-existing-users.js "@gmail.com"
echo.

:end