# 🤖 WhatsApp Bot para Termux - Versión Final

## 📱 Características
- ✅ Conexión con código de emparejamiento (sin QR)
- ✅ Typing automático (simula escritura humana)
- ✅ Link Previews para URLs (Facebook, YouTube, etc.)
- ✅ Verificaciones automáticas CADA 12 HORAS (8am y 8pm)
- ✅ Comando manual "verificar" para envíos inmediatos
- ✅ Logs locales (no satura Google Sheets)
- ✅ Envío a grupos según hora y día programados

## 📋 Requisitos
- Celular Android
- Termux instalado (desde F-Droid)
- Google Sheets con el script incluido

## 🚀 INSTALACIÓN EN UN SOLO PASO

**Abre Termux y copia ESTE ÚNICO COMANDO:**

```bash
pkg install wget -y && wget -O instalar.sh https://raw.githubusercontent.com/antoniochp-mitiendawa/whatsapp-bot-termux/main/instalar.sh && chmod +x instalar.sh && ./instalar.sh
