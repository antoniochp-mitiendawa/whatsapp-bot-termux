#!/bin/bash

echo "===================================="
echo "🚀 INSTALADOR AUTOMÁTICO"
echo "WHATSAPP BOT PARA TERMUX"
echo "===================================="
echo ""

# PASO 1: Instalar Git
echo " PASO 1: Instalando Git..."
pkg install git -y

# PASO 2: Intentar clonar de diferentes formas
echo " PASO 2: Descargando el bot..."

# Intento 1: Con git clone normal
git clone https://github.com/antoniochp-mitiendawa/whatsapp-bot-termux.git
sleep 2

# Si falla, intentamos con wget y zip
if [ $? -ne 0 ]; then
  echo " Intento 2: Usando método alternativo..."
  pkg install wget -y
  pkg install unzip -y
  wget https://github.com/antoniochp-mitiendawa/whatsapp-bot-termux/archive/refs/heads/main.zip
  unzip main.zip
  mv whatsapp-bot-termux-main whatsapp-bot-termux
fi

# Esperar un momento antes de continuar
sleep 2

# Entrar a la carpeta del repositorio
cd whatsapp-bot-termux

# PASO 3: Pedir la URL
echo ""
echo "===================================="
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
echo " PASO 3: Configurando todo..."
bash setup.sh

echo ""
echo "===================================="
echo "✅ TODO INSTALADO CORRECTAMENTE"
echo "===================================="
echo "El bot está listo para usar"
echo ""
