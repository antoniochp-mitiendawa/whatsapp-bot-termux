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
pkg install nodejs-lts -y

# PASO 4: Instalar yarn
echo "📦 PASO 4: Instalando Yarn..."
pkg install yarn -y

# PASO 5: Entrar a la carpeta del bot
echo "📦 PASO 5: Entrando a la carpeta del bot..."
cd whatsapp-bot

# PASO 6: Inicializar proyecto Node.js
echo "📦 PASO 6: Inicializando proyecto..."
npm init -y

# PASO 7: Instalar dependencias
echo "📦 PASO 7: Instalando librerías..."
npm install @whiskeysockets/baileys@6.7.0
npm install @hapi/boom
npm install qrcode-terminal
npm install node-cron
npm install axios
npm install pino
npm install link-preview-js
npm install @rodrigogs/baileys-store

# PASO 8: Crear carpetas necesarias
echo "📦 PASO 8: Creando carpetas..."
mkdir -p logs
mkdir -p cache
mkdir -p sesion_whatsapp

echo ""
echo "===================================="
echo "✅ CONFIGURACIÓN COMPLETA"
echo "===================================="
echo ""
echo "Todo está instalado correctamente."
echo ""
echo "Para iniciar el bot:"
echo "cd ~/whatsapp-bot-termux/whatsapp-bot"
echo "node bot.js"
echo ""
