#!/bin/bash

echo "===================================="
echo "🚀 INSTALADOR WHATSAPP BOT v48.0"
echo "📦 MODO: PAIRING FIX + MÚLTIPLES HOJAS"
echo "===================================="

# 1. Dependencias de sistema
echo "📦 Instalando dependencias del sistema..."
pkg update -y && pkg upgrade -y
pkg install git nodejs-lts python make clang -y

# 2. Blindaje de Red (Solución Error 128)
echo "🔧 Configurando Git..."
git config --global url."https://github.com/".insteadOf ssh://git@github.com/

# 3. Crear carpeta del bot
echo "📁 Creando carpeta del bot..."
mkdir -p whatsapp-bot
cd whatsapp-bot

# 4. Inicializar proyecto Node.js
echo "📦 Inicializando proyecto..."
npm init -y

# 5. Instalación de librerías
echo "📦 Instalando librerías..."
npm install @whiskeysockets/baileys@6.7.5
npm install @hapi/boom
npm install qrcode-terminal
npm install node-cron
npm install axios
npm install pino

# 6. Creación de carpetas necesarias
echo "📁 Creando carpetas..."
mkdir -p logs
mkdir -p auth_info_baileys
mkdir -p /storage/emulated/0/WhatsAppBot/archivos

# 7. Solicitar URL de Google Sheets
echo ""
echo "===================================="
echo "🔗 CONFIGURACIÓN DE GOOGLE SHEETS"
echo "===================================="
echo "1. Abre Google Sheets"
echo "2. Ve al menú 'Control WhatsApp'"
echo "3. Haz clic en 'Obtener URL de Webhook'"
echo "4. Copia la URL que aparece"
echo "===================================="
echo ""
echo "✏️  Pega la URL de Google Sheets:"
read URL_SHEETS

echo $URL_SHEETS > url_sheets.txt
echo ""
echo "✅ URL guardada correctamente"

# 8. Crear archivo bot.js
echo "📝 Creando archivo bot.js..."
cat > bot.js << 'EOF'
[CONTENIDO DEL BOT.JS COMPLETO - PEGAR AQUÍ EL CÓDIGO ANTERIOR]
EOF

echo ""
echo "===================================="
echo "✅ INSTALACIÓN COMPLETA"
echo "===================================="
echo ""
echo "Para iniciar el bot:"
echo "cd whatsapp-bot"
echo "node bot.js"
echo ""
echo "===================================="
