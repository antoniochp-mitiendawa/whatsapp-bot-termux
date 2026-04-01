#!/bin/bash

echo "===================================="
echo "⚙️  CONFIGURACIÓN RÁPIDA v48.0"
echo "===================================="

# Verificar si ya existe la URL
if [ -f "url_sheets.txt" ]; then
    echo "✅ Archivo url_sheets.txt encontrado"
    URL_SHEETS=$(cat url_sheets.txt)
    echo "URL configurada: ${URL_SHEETS:0:50}..."
else
    echo "🔗 No se encontró URL, por favor ingrésala:"
    read URL_SHEETS
    echo $URL_SHEETS > url_sheets.txt
    echo "✅ URL guardada"
fi

# Verificar carpetas
mkdir -p logs auth_info_baileys

echo ""
echo "===================================="
echo "✅ CONFIGURACIÓN COMPLETA"
echo "===================================="
echo ""
echo "Inicia el bot con: node bot.js"
echo ""
