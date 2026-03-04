#!/bin/bash

echo "===================================="
echo "CONFIGURANDO WHATSAPP BOT"
echo "===================================="
echo ""

# PASO 1: Actualizar Termux
echo "📦 PASO 1: Actualizando Termux..."
pkg update -y
pkg upgrade -y

# PASO 2: Instalar Git
echo "📦 PASO 2: Instalando Git..."
pkg install git -y

# PASO 3: Instalar Node.js
echo "📦 PASO 3: Instalando Node.js..."
pkg install nodejs -y

# PASO 4: Instalar yarn
echo "📦 PASO 4: Instalando Yarn..."
pkg install yarn -y

# PASO 5: Instalar cron (para actualizaciones automáticas)
echo "📦 PASO 5: Instalando cron..."
pkg install cronie termux-services -y

# PASO 6: Clonar el repositorio
echo "📦 PASO 6: Descargando el bot..."
git clone https://github.com/antoniochp-mitiendawa/whatsapp-bot-termux.git

# PASO 7: Mover URL a la carpeta correcta
echo "📦 PASO 7: Guardando URL..."
cp url_sheets.txt whatsapp-bot-termux/url_sheets.txt
cp url_sheets.txt whatsapp-bot-termux/whatsapp-bot/url_sheets.txt

# PASO 8: Entrar a la carpeta del bot
cd whatsapp-bot-termux/whatsapp-bot

# PASO 9: Inicializar proyecto
echo "📦 PASO 8: Preparando proyecto..."
npm init -y

# PASO 10: Instalar TODAS las librerías
echo "📦 PASO 9: Instalando librerías principales..."
npm install @whiskeysockets/baileys
npm install @hapi/boom
npm install qrcode-terminal
npm install node-cron
npm install axios
npm install pino
npm install link-preview-js
npm install @rodrigogs/baileys-store

# PASO 11: Configurar cron para actualizaciones automáticas (cada 15 días)
echo "📦 PASO 10: Configurando actualizaciones automáticas..."
cd /data/data/com.termux/files/home
sv up cron
(crontab -l 2>/dev/null; echo "0 3 */15 * * /data/data/com.termux/files/home/whatsapp-bot-termux/update-baileys.sh") | crontab -

echo ""
echo "===================================="
echo "✅ CONFIGURACIÓN COMPLETA"
echo "===================================="
echo ""
echo "Todo está instalado correctamente."
echo ""
echo "🚀 Para INICIAR el bot ahora:"
echo "cd whatsapp-bot-termux/whatsapp-bot"
echo "node bot.js"
echo ""
echo "📝 El bot se actualizará automáticamente cada 15 días a las 3 AM"
echo ""
