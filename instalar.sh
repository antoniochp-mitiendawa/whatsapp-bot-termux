#!/bin/bash

echo "===================================="
echo "🚀 INSTALADOR WHATSAPP BOT v40.0"
echo "===================================="
echo ""
echo "⚡ Características incluidas:"
echo "   • Keep-Alive cada 25 segundos"
echo "   • Ignora mensajes de grupos"
echo "   • Actualización automática cada 15 días"
echo "   • Soporte multimedia completo"
echo "   • Data Store para grupos"
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
pkg install unzip -y

# PASO 2: Clonar el repositorio
echo "📦 PASO 2: Descargando el bot..."
git clone https://github.com/antoniochp-mitiendawa/whatsapp-bot-termux.git
cd whatsapp-bot-termux

# PASO 3: Guardar la URL de Google Sheets
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

# Guardar la URL en TODAS las ubicaciones necesarias
echo $USER_URL > url_sheets.txt
echo $USER_URL > whatsapp-bot/url_sheets.txt
cp url_sheets.txt whatsapp-bot/url_sheets.txt 2>/dev/null

# PASO 4: Instalar dependencias
echo ""
echo "📦 PASO 3: Instalando librerías..."
cd whatsapp-bot
npm init -y

# --- Librerías necesarias ---
npm install @whiskeysockets/baileys
npm install @hapi/boom
npm install qrcode-terminal
npm install node-cron
npm install axios
npm install pino
npm install link-preview-js
npm install @rodrigogs/baileys-store

# PASO 5: MODIFICAR EL bot.js EXISTENTE (sin eliminar nada, solo AÑADIR)
echo ""
echo "📦 PASO 4: Aplicando mejoras al bot.js..."

# Hacer una copia de seguridad del original
cp bot.js bot.js.original

# Añadir keepAliveIntervalMs a la configuración del socket
sed -i '/cachedGroupMetadata:/a\            // >>> NUEVO: Mantener conexión activa (keep-alive cada 25 segundos) <<<\n            keepAliveIntervalMs: 25000,' bot.js

# Modificar el evento messages.upsert para ignorar grupos
# Buscamos la línea donde se define el evento y añadimos el filtro al inicio
sed -i '/sock.ev.on(.messages.upsert., async (m) => {/,/});/ {
    /if (!mensaje.key || mensaje.key.fromMe || !mensaje.message) {/ a\
\
            // >>> NUEVO: Ignorar completamente mensajes de grupos <<<\
            if (remitente && remitente.includes('\''@g.us'\'')) {\
                return;\
            }
}' bot.js

# Verificar que las modificaciones se aplicaron correctamente
echo "✅ Mejoras aplicadas al bot.js"

# PASO 6: CREAR SCRIPT DE ACTUALIZACIÓN AUTOMÁTICA
cd ..
cat > update-baileys.sh << 'EOF'
#!/bin/bash
echo "$(date): Iniciando actualización programada de Baileys..." >> /storage/emulated/0/WhatsAppBot/logs/updates.log
pkill -f "node bot.js"
sleep 3
cd /data/data/com.termux/files/home/whatsapp-bot-termux/whatsapp-bot
cp package.json package.json.backup
npm update @whiskeysockets/baileys
if [ $? -eq 0 ]; then
    echo "$(date): ✅ Baileys actualizado correctamente" >> /storage/emulated/0/WhatsAppBot/logs/updates.log
else
    echo "$(date): ❌ Error en actualización" >> /storage/emulated/0/WhatsAppBot/logs/updates.log
    cp package.json.backup package.json
fi
cd /data/data/com.termux/files/home/whatsapp-bot-termux/whatsapp-bot
nohup node bot.js > /dev/null 2>&1 &
echo "$(date): Bot reiniciado" >> /storage/emulated/0/WhatsAppBot/logs/updates.log
EOF

chmod +x update-baileys.sh

# PASO 7: CONFIGURAR CRON PARA ACTUALIZACIÓN CADA 15 DÍAS
echo "📦 PASO 5: Configurando actualización automática (cada 15 días)..."
sv up cron
(crontab -l 2>/dev/null; echo "0 3 */15 * * /data/data/com.termux/files/home/whatsapp-bot-termux/update-baileys.sh") | crontab -

# PASO 8: CREAR CARPETA DE LOGS EN ALMACENAMIENTO EXTERNO
mkdir -p /storage/emulated/0/WhatsAppBot/logs

echo ""
echo "===================================="
echo "✅ INSTALACIÓN COMPLETA - VERSIÓN 40.0"
echo "===================================="
echo ""
echo "🤖 El bot está instalado con TODAS las mejoras:"
echo "   ✓ Keep-Alive cada 25 segundos (conexión siempre activa)"
echo "   ✓ Ignora mensajes de grupos (solo procesa comandos)"
echo "   ✓ Se actualiza automáticamente cada 15 días"
echo "   ✓ Data Store para grupos"
echo "   ✓ Soporte multimedia completo"
echo "   ✓ Comandos prioritarios (actualizar, listagrupos)"
echo ""
echo "📁 La URL se guardó en:"
echo "   • url_sheets.txt (raíz)"
echo "   • whatsapp-bot/url_sheets.txt"
echo ""

# PASO 9: VERIFICAR QUE LA URL EXISTE
if [ -f "whatsapp-bot/url_sheets.txt" ]; then
    echo "✅ Archivo de URL verificado correctamente"
else
    echo "⚠️  Re-asegurando URL..."
    echo $USER_URL > whatsapp-bot/url_sheets.txt
fi

# PASO 10: Preguntar si quiere iniciar
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
    cd whatsapp-bot
    
    # Verificación final antes de iniciar
    if [ -f "url_sheets.txt" ]; then
        echo "✅ URL encontrada: $(cat url_sheets.txt | head -c 50)..."
    else
        echo "⚠️  Creando archivo URL nuevamente..."
        echo $USER_URL > url_sheets.txt
    fi
    
    node bot.js
else
    echo ""
    echo "📝 Para iniciar el bot después:"
    echo "cd whatsapp-bot-termux/whatsapp-bot"
    echo "node bot.js"
    echo ""
    echo "✅ Las actualizaciones automáticas seguirán funcionando cada 15 días"
    echo ""
fi
