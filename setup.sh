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

# PASO 5: Crear carpeta para el bot
echo "📦 PASO 5: Creando carpeta del bot..."
mkdir -p whatsapp-bot

# PASO 6: Entrar a la carpeta
cd whatsapp-bot

# PASO 7: Inicializar proyecto Node.js
echo "📦 PASO 6: Preparando proyecto..."
npm init -y

# PASO 8: Instalar Baileys (VERSIÓN ESPECÍFICA)
echo "📦 PASO 7: Instalando Baileys..."
npm install @whiskeysockets/baileys@6.7.0

# PASO 9: Instalar otras librerías útiles
echo "📦 PASO 8: Instalando librerías adicionales..."
npm install qrcode-terminal
npm install node-cron
npm install axios
npm install @hapi/boom
npm install pino
npm install link-preview-js
npm install @rodrigogs/baileys-store

echo ""
echo "===================================="
echo "✅ CONFIGURACIÓN COMPLETA"
echo "===================================="
echo ""
echo "Todo está instalado correctamente."
echo "El bot está en la carpeta: whatsapp-bot"
echo ""
echo "Para iniciar el bot escribe:"
echo "cd whatsapp-bot"
echo "node bot.js"
echo ""
