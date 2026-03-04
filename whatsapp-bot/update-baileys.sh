#!/bin/bash

echo "$(date): Iniciando actualización programada de Baileys..." >> /storage/emulated/0/WhatsAppBot/logs/updates.log

# 1. Detener el bot si está corriendo
pkill -f "node bot.js"
sleep 3

# 2. Ir a la carpeta del bot
cd /data/data/com.termux/files/home/whatsapp-bot-termux/whatsapp-bot

# 3. Respaldar package.json
cp package.json package.json.backup

# 4. Actualizar Baileys (solo parches, no versiones mayores)
npm update @whiskeysockets/baileys

# 5. Verificar actualización
if [ $? -eq 0 ]; then
    echo "$(date): ✅ Baileys actualizado correctamente" >> /storage/emulated/0/WhatsAppBot/logs/updates.log
else
    echo "$(date): ❌ Error en actualización" >> /storage/emulated/0/WhatsAppBot/logs/updates.log
    cp package.json.backup package.json
fi

# 6. Re-iniciar el bot
cd /data/data/com.termux/files/home/whatsapp-bot-termux/whatsapp-bot
nohup node bot.js > /dev/null 2>&1 &

echo "$(date): Bot reiniciado después de actualización" >> /storage/emulated/0/WhatsAppBot/logs/updates.log
