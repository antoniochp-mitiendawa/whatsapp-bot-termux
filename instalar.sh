#!/bin/bash

echo "===================================="
echo "🚀 INSTALADOR WHATSAPP BOT v40.0"
echo "===================================="
echo ""

# PASO 1: Instalar lo básico
echo "📦 PASO 1: Instalando programas necesarios..."
pkg update -y
pkg install git -y
pkg install nodejs -y
pkg install yarn -y
pkg install cronie termux-services -y
pkg install wget -y

# PASO 2: Clonar el repositorio
echo "📦 PASO 2: Descargando el bot..."
rm -rf whatsapp-bot-termux 2>/dev/null
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
mkdir -p whatsapp-bot
echo $USER_URL > whatsapp-bot/url_sheets.txt

# PASO 4: Instalar dependencias
echo ""
echo "📦 PASO 3: Instalando librerías..."
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

# PASO 5: Crear carpeta de logs
mkdir -p /storage/emulated/0/WhatsAppBot/logs

# PASO 6: Crear script de reinicio automático
echo "🤖 Creando script de reinicio automático..."
cat > iniciar.sh << 'EOF'
#!/bin/bash

while true; do
    echo "===================================="
    echo "🚀 INICIANDO BOT WHATSAPP"
    echo "===================================="
    echo ""
    
    node bot.js
    
    echo ""
    echo "❌ EL BOT SE DETUVO O DESCONECTÓ"
    echo "===================================="
    echo "Reiniciando en 5 segundos..."
    echo "Presiona Ctrl+C para salir"
    echo "===================================="
    echo ""
    
    sleep 5
done
EOF

chmod +x iniciar.sh

echo ""
echo "===================================="
echo "✅ INSTALACIÓN COMPLETA"
echo "===================================="
echo ""

# PASO 7: Preguntar si quiere iniciar
echo "🤖 El bot ya está instalado"
echo ""
echo "¿Quieres iniciar el bot AHORA? (con reinicio automático)"
echo "Escribe 1 y presiona Enter para INICIAR"
echo "Escribe 2 y presiona Enter para SALIR"
echo ""
read OPCION

if [ "$OPCION" == "1" ]; then
    echo ""
    echo "🚀 INICIANDO BOT (con reinicio automático)..."
    echo "======================"
    echo ""
    ./iniciar.sh
else
    echo ""
    echo "📝 Para iniciar el bot después:"
    echo "cd whatsapp-bot-termux/whatsapp-bot"
    echo "./iniciar.sh"
    echo ""
fi
