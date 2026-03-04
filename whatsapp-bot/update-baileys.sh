#!/bin/bash
echo "$(date): Iniciando actualización programada de Baileys..." >> /storage/emulated/0/WhatsAppBot/logs/updates.log
pkill -f "node bot.js"
sleep 3
cd /data/data/com.termux/files/home/whatsapp-bot-termux/whatsapp-bot
npm update @whiskeysockets/baileys
cd /data/data/com.termux/files/home/whatsapp-bot-termux/whatsapp-bot
nohup node bot.js > /dev/null 2>&1 &
echo "$(date): Bot reiniciado" >> /storage/emulated/0/WhatsAppBot/logs/updates.log
