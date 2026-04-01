#!/bin/bash

echo "===================================="
echo "CONFIGURANDO WHATSAPP BOT V47.0"
echo "===================================="
echo ""

# PASO 1: Actualizar Termux
echo "📦 PASO 1: Actualizando Termux..."
pkg update -y
pkg upgrade -y

# PASO 2: Instalar Git
echo "📦 PASO 2: Instalando Git..."
pkg install git -y

# PASO 3: Instalar Node.js LTS
echo "📦 PASO 3: Instalando Node.js..."
pkg install nodejs-lts -y

# PASO 4: Instalar yarn
echo "📦 PASO 4: Instalando Yarn..."
pkg install yarn -y

# PASO 5: Crear carpeta del bot si no existe
echo "📦 PASO 5: Creando carpeta del bot..."
mkdir -p whatsapp-bot

# PASO 6: Copiar URL a la carpeta del bot
echo "📦 PASO 6: Copiando configuración..."
cp url_sheets.txt whatsapp-bot/

# PASO 7: Entrar a la carpeta del bot
cd whatsapp-bot

# PASO 8: Inicializar proyecto Node.js
echo "📦 PASO 7: Inicializando proyecto..."
npm init -y

# PASO 9: Instalar dependencias
echo "📦 PASO 8: Instalando librerías..."
npm install @whiskeysockets/baileys@6.7.0
npm install @hapi/boom
npm install qrcode-terminal
npm install node-cron
npm install axios
npm install pino
npm install link-preview-js
npm install @rodrigogs/baileys-store

# PASO 10: Crear carpetas necesarias
echo "📦 PASO 9: Creando carpetas..."
mkdir -p logs
mkdir -p cache
mkdir -p sesion_whatsapp

echo ""
echo "===================================="
echo "✅ CONFIGURACIÓN COMPLETA"
echo "===================================="
echo ""
echo "Bot instalado en: $(pwd)"
echo ""
echo "Para iniciar el bot:"
echo "node bot.js"
echo ""
