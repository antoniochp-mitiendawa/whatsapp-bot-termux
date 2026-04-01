#!/bin/bash

echo "===================================="
echo "🚀 INSTALADOR WHATSAPP BOT v47.0"
echo "📦 MODO: ZERO-INSTALLATION + PAIRING"
echo "===================================="

# 1. Dependencias de sistema
pkg update -y && pkg upgrade -y
pkg install git nodejs-lts python make clang -y

# 2. Blindaje de Red (Solución Error 128)
git config --global url."https://github.com/".insteadOf ssh://git@github.com/

# 3. Descarga Limpia
rm -rf whatsapp-bot-termux 2>/dev/null
git clone https://github.com/antoniochp-mitiendawa/whatsapp-bot-termux.git
cd whatsapp-bot-termux/whatsapp-bot

# 4. Instalación de Librerías (Incluyendo readline para interacción)
rm -rf node_modules package-lock.json
npm init -y
npm install @whiskeysockets/baileys @hapi/boom qrcode-terminal node-cron axios pino link-preview-js @rodrigogs/baileys-store

# 5. Creación de carpetas raíz
mkdir -p logs
mkdir -p /storage/emulated/0/WhatsAppBot/archivos

echo ""
echo "===================================="
echo "✅ INSTALACIÓN COMPLETA"
echo "===================================="
echo "Escribe 1 para INICIAR el proceso de vinculación"
echo "Escribe 2 para SALIR"
read OPCION

if [ "$OPCION" == "1" ]; then
    node bot.js
else
    echo "👋 Usa 'node bot.js' para vincular después."
fi
