#!/bin/bash

echo "===================================="
echo "🚀 INSTALADOR WHATSAPP BOT v40.0"
echo "===================================="
echo ""

# PASO 1: Instalar lo básico
echo "📦 Instalando programas necesarios..."
pkg update -y
pkg install git -y
pkg install nodejs -y
pkg install yarn -y
pkg install cronie termux-services -y
pkg install wget -y

# PASO 2: Limpiar instalaciones anteriores (por si acaso)
rm -rf whatsapp-bot-termux 2>/dev/null

# PASO 3: Clonar el repositorio
echo "📦 Descargando el bot..."
git clone https://github.com/antoniochp-mitiendawa/whatsapp-bot-termux.git
cd whatsapp-bot-termux

# PASO 4: PEDIR LA URL (FORMA SIMPLE Y DIRECTA)
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
echo "📝 Pega la URL COMPLETA y presiona Enter:"
read USER_URL

# PASO 5: GUARDAR LA URL EN MÚLTIPLES LUGARES (para asegurar)
echo "📦 Guardando URL..."

# Crear el archivo en la raíz
echo "$USER_URL" > url_sheets.txt
echo "✅ URL guardada en: $(pwd)/url_sheets.txt"

# Crear la carpeta del bot si no existe
mkdir -p whatsapp-bot

# Guardar en la carpeta del bot
echo "$USER_URL" > whatsapp-bot/url_sheets.txt
echo "✅ URL guardada en: $(pwd)/whatsapp-bot/url_sheets.txt"

# Guardar también como variable de entorno (por si acaso)
export BOT_SHEETS_URL="$USER_URL"

# PASO 6: VERIFICAR QUE LA URL SE GUARDÓ CORRECTAMENTE
echo ""
echo "📋 VERIFICANDO URL GUARDADA:"
if [ -f "whatsapp-bot/url_sheets.txt" ]; then
    URL_GUARDADA=$(cat whatsapp-bot/url_sheets.txt)
    echo "✅ Archivo existe: whatsapp-bot/url_sheets.txt"
    echo "📌 Contenido: ${URL_GUARDADA:0:50}..."
    
    if [ -z "$URL_GUARDADA" ]; then
        echo "❌ ERROR: El archivo está vacío. Reintentando..."
        echo "$USER_URL" > whatsapp-bot/url_sheets.txt
    fi
else
    echo "❌ ERROR: No se pudo crear el archivo. Creándolo ahora..."
    mkdir -p whatsapp-bot
    echo "$USER_URL" > whatsapp-bot/url_sheets.txt
fi

# PASO 7: Instalar dependencias
echo ""
echo "📦 Instalando librerías..."
cd whatsapp-bot

# Inicializar npm (si no existe package.json)
if [ ! -f "package.json" ]; then
    npm init -y
fi

# Instalar librerías
npm install @whiskeysockets/baileys
npm install @hapi/boom
npm install qrcode-terminal
npm install node-cron
npm install axios
npm install pino
npm install link-preview-js
npm install @rodrigogs/baileys-store

# PASO 8: MODIFICAR EL bot.js (solo añadir las 2 líneas necesarias)
echo ""
echo "📦 Aplicando mejoras al bot.js..."

# Hacer backup
cp bot.js bot.js.backup

# Añadir keepAliveIntervalMs después de cachedGroupMetadata
sed -i '/cachedGroupMetadata:/a\            keepAliveIntervalMs: 25000,' bot.js

# Añadir filtro de grupos en el evento messages.upsert
sed -i '/if (!mensaje.key || mensaje.key.fromMe || !mensaje.message) {/a\
            \
            // IGNORAR GRUPOS COMPLETAMENTE\
            if (remitente \&\& remitente.includes('\''@g.us'\'')) {\
                return;\
            }' bot.js

echo "✅ Mejoras aplicadas"

# PASO 9: Crear script de actualización automática
cd ..
cat > update-baileys.sh << 'EOF'
#!/bin/bash
echo "$(date): Iniciando actualización programada..." >> /storage/emulated/0/WhatsAppBot/logs/updates.log
pkill -f "node bot.js"
sleep 3
cd /data/data/com.termux/files/home/whatsapp-bot-termux/whatsapp-bot
npm update @whiskeysockets/baileys
cd /data/data/com.termux/files/home/whatsapp-bot-termux/whatsapp-bot
nohup node bot.js > /dev/null 2>&1 &
echo "$(date): Bot reiniciado" >> /storage/emulated/0/WhatsAppBot/logs/updates.log
EOF

chmod +x update-baileys.sh

# PASO 10: Configurar cron
sv up cron
(crontab -l 2>/dev/null; echo "0 3 */15 * * /data/data/com.termux/files/home/whatsapp-bot-termux/update-baileys.sh") | crontab -

# PASO 11: Crear carpeta de logs
mkdir -p /storage/emulated/0/WhatsAppBot/logs

echo ""
echo "===================================="
echo "✅ INSTALACIÓN COMPLETA"
echo "===================================="
echo ""
echo "📌 URL guardada en: whatsapp-bot/url_sheets.txt"
echo ""

# PASO 12: VERIFICACIÓN FINAL ANTES DE INICIAR
cd whatsapp-bot

echo "🔍 VERIFICACIÓN FINAL:"
if [ -f "url_sheets.txt" ]; then
    URL_FINAL=$(cat url_sheets.txt)
    if [ ! -z "$URL_FINAL" ]; then
        echo "✅ URL verificada correctamente"
        echo "📌 La URL comienza con: ${URL_FINAL:0:30}..."
    else
        echo "⚠️  Archivo URL vacío. Re-escribiendo..."
        echo "$USER_URL" > url_sheets.txt
    fi
else
    echo "⚠️  Archivo URL no encontrado. Creándolo..."
    echo "$USER_URL" > url_sheets.txt
fi

echo ""
echo "🚀 ¿Quieres iniciar el bot AHORA?"
echo "Escribe 1 y presiona Enter para INICIAR"
echo "Escribe 2 y presiona Enter para SALIR"
echo ""
read OPCION

if [ "$OPCION" == "1" ]; then
    echo ""
    echo "🚀 INICIANDO BOT..."
    echo "======================"
    echo ""
    
    # Última verificación antes de ejecutar node
    ls -la url_sheets.txt
    echo "Contenido del archivo: $(cat url_sheets.txt)"
    
    node bot.js
else
    echo ""
    echo "📝 Para iniciar el bot después:"
    echo "cd whatsapp-bot-termux/whatsapp-bot"
    echo "node bot.js"
    echo ""
fi
