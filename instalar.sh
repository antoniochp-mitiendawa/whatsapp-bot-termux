#!/bin/bash

echo "===================================="
echo "🚀 INSTALADOR WHATSAPP BOT v41.0"
echo "CON PERSISTENCIA PARA TERMUX"
echo "===================================="
echo ""

# PASO 1: Instalar dependencias del sistema (Tus originales + PM2)
echo "📦 PASO 1: Instalando programas necesarios..."
pkg update -y
pkg upgrade -y
pkg install git nodejs termux-api cronie termux-services wget -y
npm install -g pm2

# PASO 2: Configuración de carpeta
echo "📦 PASO 2: Configurando directorio..."
cd ~
mkdir -p whatsapp-bot-termux
cd whatsapp-bot-termux

# PASO 3: Guardar la URL de Google Sheets
echo ""
echo "===================================="
echo "🔗 URL DE GOOGLE SHEETS"
echo "===================================="
echo "📝 Escribe la URL y presiona Enter:"
read USER_URL
echo $USER_URL > url_sheets.txt

# PASO 4: Instalar librerías de Node (Todas las de tu Botjs.txt)
echo ""
echo "📦 PASO 3: Instalando librerías..."
npm init -y
npm install @whiskeysockets/baileys @hapi/boom qrcode-terminal node-cron axios pino link-preview-js @rodrigogs/baileys-store

# PASO 5: Crear carpeta de logs en memoria externa
mkdir -p /storage/emulated/0/WhatsAppBot/logs

# PASO 6: ACTIVAR WAKE LOCK
# Esto evita que Android suspenda a Termux cuando apagas la pantalla
termux-wake-lock

echo ""
echo "===================================="
echo "✅ INSTALACIÓN COMPLETA"
echo "===================================="
echo "1. Crea el archivo Bot.js y pega el código"
echo "2. Para iniciar usa: pm2 start Bot.js --name bot-wa"
echo "3. Para ver el QR usa: pm2 logs bot-wa"
echo "===================================="
