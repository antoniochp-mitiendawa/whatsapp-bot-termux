#!/bin/bash

echo "===================================="
echo "🚀 INSTALADOR WHATSAPP BOT - V2.0"
echo "===================================="
echo ""
echo "🔧 PASO 0: Reparando posibles errores de Termux..."
echo ""

# Reparar posibles errores de librerías
echo "   → Configurando repositorios..."
termux-change-repo << EOF
1
EOF

echo "   → Actualizando paquetes..."
pkg update -y && pkg upgrade -y

echo "   → Instalando librería faltante (libandroid-posix-semaphore)..."
pkg install libandroid-posix-semaphore -y

echo ""
echo "✅ Reparación completada"
echo ""

# PASO 1: Instalar lo básico
echo " PASO 1: Instalando programas necesarios..."
pkg install git -y
pkg install nodejs -y
pkg install yarn -y
pkg install wget -y

# PASO 2: Clonar el repositorio
echo " PASO 2: Descargando el bot..."
git clone https://github.com/antoniochp-mitiendawa/whatsapp-bot-termux.git
cd whatsapp-bot-termux

# PASO 3: Guardar la URL
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

# PASO 4: Instalar dependencias
echo ""
echo " PASO 3: Instalando librerías..."
cd whatsapp-bot
npm init -y
npm install @whiskeysockets/baileys
npm install @hapi/boom
npm install qrcode-terminal
npm install node-cron
npm install axios
npm install pino
npm install link-preview-js
npm install @rodrigogs/baileys-store
npm install crypto

echo ""
echo "===================================="
echo "✅ INSTALACIÓN COMPLETA"
echo "===================================="
echo ""

# PASO 5: Preguntar si quiere iniciar
echo "🤖 El bot ya está instalado"
echo ""
echo "¿Quieres iniciar el bot AHORA?"
echo "Escribe 1 y presiona Enter para INICIAR"
echo "Escribe 2 y presiona Enter para SALIR"
echo ""
read OPCION

if [ "$OPCION" == "1" ]; then
    echo ""
    echo "🚀 INICIANDO BOT..."
    echo "======================"
    echo ""
    cd whatsapp-bot
    node bot.js
else
    echo ""
    echo "📝 Para iniciar el bot después:"
    echo "cd whatsapp-bot-termux/whatsapp-bot"
    echo "node bot.js"
    echo ""
fi
