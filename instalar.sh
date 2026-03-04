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

# PASO 5: CREAR SCRIPT DE ACTUALIZACIÓN AUTOMÁTICA
cd ..
cat > update-baileys.sh << 'EOF'
#!/bin/bash
echo "$(date): Iniciando actualización programada de Baileys..." >> /storage/emulated/0/WhatsAppBot/logs/updates.log
pkill -f "node bot.js"
sleep 3
cd /data/data/com.termux/files/home/whatsapp-bot-termux/whatsapp-bot
npm update @whiskeysockets/baileys
cd /data/data/com.termux/files/home/whatsapp-bot-termux/whatsapp-bot
nohup node bot.js > /dev/null 2>&1 &
echo "$(date): Bot reiniciado" >> /storage/emulated/0/WhatsAppBot/logs/updates.log
EOF

chmod +x update-baileys.sh

# PASO 6: CONFIGURAR CRON (CADA 15 DÍAS)
sv up cron
(crontab -l 2>/dev/null; echo "0 3 */15 * * /data/data/com.termux/files/home/whatsapp-bot-termux/update-baileys.sh") | crontab -

# PASO 7: Crear carpeta de logs
mkdir -p /storage/emulated/0/WhatsAppBot/logs

echo ""
echo "===================================="
echo "✅ INSTALACIÓN COMPLETA"
echo "===================================="
echo ""

# PASO 8: Preguntar si quiere iniciar
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
