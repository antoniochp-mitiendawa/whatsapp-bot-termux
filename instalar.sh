#!/bin/bash

echo "===================================="
echo "🚀 INSTALADOR WHATSAPP BOT v48.0"
echo "===================================="

# 1. Dependencias de sistema
echo "📦 Instalando dependencias..."
pkg update -y && pkg upgrade -y
pkg install git nodejs-lts python make clang wget -y

# 2. Blindaje de Red
git config --global url."https://github.com/".insteadOf ssh://git@github.com/

# 3. Crear carpeta del bot
mkdir -p whatsapp-bot
cd whatsapp-bot

# 4. Inicializar proyecto
npm init -y

# 5. Instalar librerías
npm install @whiskeysockets/baileys@6.7.5
npm install @hapi/boom
npm install qrcode-terminal
npm install node-cron
npm install axios
npm install pino

# 6. Crear carpetas
mkdir -p logs
mkdir -p auth_info_baileys
mkdir -p /storage/emulated/0/WhatsAppBot/archivos

# 7. Solicitar URL de Google Sheets
echo ""
echo "🔗 Pega la URL de Google Sheets:"
read URL_SHEETS
echo $URL_SHEETS > url_sheets.txt
echo "✅ URL guardada"

# 8. Descargar bot.js desde el repositorio
echo "📥 Descargando bot.js..."
wget -O bot.js https://raw.githubusercontent.com/antoniochp-mitiendawa/whatsapp-bot-termux/main/whatsapp-bot-termux/bot.js

echo ""
echo "===================================="
echo "✅ INSTALACIÓN COMPLETA"
echo "===================================="
echo ""
echo "Iniciando el bot..."
echo ""

# 9. Iniciar el bot
node bot.js
