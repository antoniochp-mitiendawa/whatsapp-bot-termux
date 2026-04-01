#!/bin/bash

echo "===================================="
echo "CONFIGURANDO WHATSAPP BOT"
echo "🚀 INSTALADOR AUTOMÁTICO"
echo "WHATSAPP BOT PARA TERMUX"
echo "===================================="
echo ""

# PASO 1: Actualizar Termux
echo "📦 PASO 1: Actualizando Termux..."
pkg update -y
pkg upgrade -y

# PASO 2: Instalar Git
echo "📦 PASO 2: Instalando Git..."
# PASO 1: Instalar Git (para poder descargar)
echo " PASO 1: Instalando Git..."
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
# PASO 2: Intentar clonar de diferentes formas
echo " PASO 2: Descargando el bot..."

# PASO 6: Entrar a la carpeta
cd whatsapp-bot
# Intento 1: Con git clone normal
git clone https://github.com/antoniochp-mitiendawa/whatsapp-bot-termux.git
sleep 2

# PASO 7: Inicializar proyecto Node.js
echo "📦 PASO 6: Preparando proyecto..."
npm init -y
# Si falla, intentamos con wget y zip
if [ $? -ne 0 ]; then
  echo " Intento 2: Usando método alternativo..."
  pkg install wget -y
  pkg install unzip -y
  wget https://github.com/antoniochp-mitiendawa/whatsapp-bot-termux/archive/refs/heads/main.zip
  unzip main.zip
  mv whatsapp-bot-termux-main whatsapp-bot-termux
fi

# PASO 8: Instalar Baileys
echo "📦 PASO 7: Instalando Baileys..."
npm install @whiskeysockets/baileys
# Esperar un momento antes de continuar
sleep 2

# PASO 9: Instalar otras librerías útiles
echo "📦 PASO 8: Instalando librerías adicionales..."
npm install qrcode-terminal
npm install node-cron
npm install axios
npm install @hapi/boom
npm install pino
npm install link-preview-js
npm install @rodrigogs/baileys-store
# Entrar a la carpeta
cd whatsapp-bot-termux

# PASO 3: Pedir la URL
echo ""
echo "===================================="
echo "✅ CONFIGURACIÓN COMPLETA"
echo "🔗 NECESITAS TU URL DE GOOGLE SHEETS"
echo "===================================="
echo "1. Ve a Google Sheets"
echo "2. Menú 'Control WhatsApp'"
echo "3. Haz clic en 'Obtener URL'"
echo "4. Copia la URL"
echo "===================================="
echo ""
echo "✏️  Pega la URL aquí:"
read URL_SHEETS

# PASO 4: Guardar la URL
echo $URL_SHEETS > url_sheets.txt

# PASO 5: Ejecutar la configuración completa
echo ""
echo "Todo está instalado correctamente."
echo "El bot está en la carpeta: whatsapp-bot"
echo " PASO 3: Configurando todo..."
bash setup.sh

echo ""
echo "Para iniciar el bot escribe:"
echo "cd whatsapp-bot"
echo "node bot.js"
echo "===================================="
echo "✅ TODO INSTALADO CORRECTAMENTE"
echo "===================================="
echo "El bot está listo para usar"
echo ""
