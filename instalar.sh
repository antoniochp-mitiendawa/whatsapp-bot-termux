#!/bin/bash

echo "===================================="
echo "🚀 INSTALADOR AUTOMÁTICO"
echo "WHATSAPP BOT PARA TERMUX"
echo "VERSIÓN 47.0 - CONFIG NEGOCIO"
echo "===================================="
echo ""

# PASO 1: Instalar Git
echo "📦 PASO 1: Instalando Git..."
pkg install git -y

# PASO 2: Actualizar repositorio
echo "📦 PASO 2: Actualizando repositorio..."
git pull origin main 2>/dev/null || true

# PASO 3: Pedir la URL de Google Sheets
echo ""
echo "===================================="
echo "🔗 NECESITAS TU URL DE GOOGLE SHEETS"
echo "===================================="
echo "1. Ve a Google Sheets"
echo "2. Menú 'Control WhatsApp'"
echo "3. Haz clic en 'Obtener URL'"
echo "4. Copia la URL"
echo "===================================="
echo ""
echo "✏️ Pega la URL aquí y presiona ENTER:"
read URL_SHEETS

# PASO 4: Guardar la URL
echo $URL_SHEETS > url_sheets.txt
echo "✅ URL guardada correctamente"

# PASO 5: Ejecutar la configuración completa
echo ""
echo "📦 PASO 3: Configurando todo..."
bash setup.sh

echo ""
echo "===================================="
echo "✅ TODO INSTALADO CORRECTAMENTE"
echo "===================================="
echo ""
echo "Para iniciar el bot:"
echo "cd whatsapp-bot && node bot.js"
echo ""
