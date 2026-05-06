@echo off
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "PATH=%JAVA_HOME%\bin;%PATH%"

echo JAVA_HOME = %JAVA_HOME%
java -version

echo.
echo Syncing web assets...
copy /Y ..\index.html ..\www\ >nul 2>nul
copy /Y ..\style.css ..\www\ >nul 2>nul
copy /Y ..\game.js ..\www\ >nul 2>nul

echo Building APK...
call gradlew.bat assembleDebug

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ===================================
    echo   APK Built Successfully!
    echo   Location: app\build\outputs\apk\debug\app-debug.apk
    echo ===================================
) else (
    echo.
    echo Build failed with error code %ERRORLEVEL%
)
pause
