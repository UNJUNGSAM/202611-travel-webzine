@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

echo ========================================================
echo   [2026.11 가족 여행 웹진] GitHub 커밋 및 Netlify 자동 배포
echo ========================================================
echo.

git add .

git diff-index --quiet HEAD --
if %ERRORLEVEL% equ 0 (
    echo [안내] 커밋할 새 변경 사항이 없습니다. 푸시만 진행합니다.
) else (
    set "COMMIT_MSG=%~1"
    if "!COMMIT_MSG!"=="" (
        set "COMMIT_MSG=웹진 업데이트 (%date% %time:~0,5%)"
    )
    echo 커밋 생성 중: "!COMMIT_MSG!"
    git commit -m "!COMMIT_MSG!"
)

echo.
echo GitHub 저장소로 푸시 중...
git push -u origin main

if %ERRORLEVEL% equ 0 (
    echo.
    echo ========================================================
    echo   [완료] GitHub 푸시 성공! Netlify에서 자동 배포됩니다.
    echo ========================================================
) else (
    echo.
    echo [안내] 원격 저장소(UNJUNGSAM/202611-travel-webzine)가 아직 없거나
    echo GitHub 로그인이 필요합니다. 확인 후 다시 실행해 주세요.
)

echo.
pause
