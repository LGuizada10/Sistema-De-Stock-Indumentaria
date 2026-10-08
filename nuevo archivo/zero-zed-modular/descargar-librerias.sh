#!/bin/sh
# Descarga UNA VEZ las librerías externas a frontend/vendor/ para que el programa no dependa de internet para cargarlas.
cd "$(dirname "$0")" || exit 1
mkdir -p frontend/vendor
bajar(){ echo "Bajando $2 ..."; curl -fsSL "$1" -o "frontend/vendor/$2" || { echo "ERROR bajando $2"; exit 1; }; }
bajar https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js xlsx.full.min.js
bajar https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js jspdf.umd.min.js
bajar https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js supabase.min.js
echo; echo "Listo. Huellas SHA-256 (guardalas: si algún día cambian sin que actualices, algo se alteró):"
( cd frontend/vendor && (sha256sum *.js 2>/dev/null || shasum -a 256 *.js) | tee HUELLAS.txt )
