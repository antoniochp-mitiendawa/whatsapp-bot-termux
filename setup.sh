#!/bin/bash

echo "===================================="
echo "CONFIGURANDO WHATSAPP BOT"
echo "===================================="
echo ""

# Actualizar Termux
echo "Paso 1: Actualizando Termux..."
pkg update -y && pkg upgrade -y

# Instalar Node.js (necesario para el bot)
echo "Paso 2: Instalando Node.js..."
pkg install nodejs -y

# Instalar git (para descargar cosas)
echo "Paso 3: Instalando Git..."
pkg install git -y

# Crear carpeta para el bot
echo "Paso 4: Creando carpeta del bot..."
mkdir whatsapp-bot
cd whatsapp-bot

# Inicializar proyecto Node.js
echo "Paso 5: Preparando proyecto..."
npm init -y

echo ""
echo "✅ Termux preparado"
echo ""
echo "Ahora ejecuta: npm install"
echo "Y luego: npm install @whiskeysockets/baileys"
