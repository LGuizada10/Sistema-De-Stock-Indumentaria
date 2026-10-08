@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist frontend\vendor mkdir frontend\vendor
echo Bajando librerias...
curl -fsSL https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js -o frontend\vendor\xlsx.full.min.js || goto error
curl -fsSL https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js -o frontend\vendor\jspdf.umd.min.js || goto error
curl -fsSL https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js -o frontend\vendor\supabase.min.js || goto error
echo.
echo Huellas SHA-256 (guardalas):
(for %%f in (frontend\vendor\*.js) do certutil -hashfile "%%f" SHA256 | findstr /v "hash CertUtil") > frontend\vendor\HUELLAS.txt
type frontend\vendor\HUELLAS.txt
echo Listo.
pause
exit /b 0
:error
echo ERROR: no se pudo bajar una libreria. Revisa tu internet.
pause
exit /b 1
