#!/bin/bash

echo "===================================="
echo "🚀 INSTALADOR WHATSAPP BOT v47.0"
echo "📦 OPTIMIZADO PARA TERMUX (SIN SSH)"
echo "===================================="
echo ""

# PASO 1: Instalar dependencias del sistema y compilación
echo "📦 PASO 1: Instalando programas necesarios..."
pkg update -y
pkg upgrade -y
pkg install git nodejs-lts python make clang -y

# PASO 2: Configurar Git para evitar Error 128 (Documentación Oficial)
# Esto fuerza a usar HTTPS en lugar de SSH para las dependencias de Baileys
echo "🔧 PASO 2: Configurando protocolo Git seguro..."
git config --global url."https://github.com/".insteadOf ssh://git@github.com/

# PASO 3: Clonar el repositorio
echo "📦 PASO 3: Descargando el repositorio..."
rm -rf whatsapp-bot-termux 2>/dev/null
git clone https://github.com/antoniochp-mitiendawa/whatsapp-bot-termux.git
cd whatsapp-bot-termux

# PASO 4: Guardar la URL de Google Sheets
echo ""
echo "===================================="
echo "🔗 URL DE GOOGLE SHEETS"
echo "===================================="
echo "1. Abre Google Sheets"
echo "2. En el menú 'Control WhatsApp'"
echo "3. Ve a '📚 Ver Instrucciones'"
echo "4. Copia la URL que aparece"
echo "===================================="
echo ""
echo "📝 Escribe la URL y presiona Enter:"
read USER_URL
echo $USER_URL > url_sheets.txt

# Crear carpeta del bot si no existe y copiar la URL
mkdir -p whatsapp-bot
echo $USER_URL > whatsapp-bot/url_sheets.txt

# PASO 5: Instalar dependencias de Node.js
echo ""
echo "📦 PASO 4: Instalando librerías de Node..."
cd whatsapp-bot
# Limpieza previa para instalación limpia
rm -rf node_modules package-lock.json

npm init -y
# Instalación de Baileys y dependencias críticas
npm install @whiskeysockets/baileys
npm install @hapi/boom qrcode-terminal node-cron axios pino link-preview-js @rodrigogs/baileys-store

# PASO 6: Crear carpetas de sistema
mkdir -p /storage/emulated/0/WhatsAppBot/logs

echo ""
echo "===================================="
echo "✅ INSTALACIÓN COMPLETA"
echo "===================================="
echo ""

# PASO 7: Menú de inicio
echo "🤖 El bot ya está instalado"
echo ""
echo "¿Quieres iniciar el bot AHORA?"
echo "Escribe 1 y presiona Enter para INICIAR"
echo "Escribe 2 y presiona Enter para SALIR"
read OPCION

if [ "$OPCION" == "1" ]; then
    echo "🚀 Iniciando bot..."
    node bot.js
else
    echo "👋 Instalación terminada. Para iniciar después usa:"
    echo "cd ~/whatsapp-bot-termux/whatsapp-bot && node bot.js"
fi
