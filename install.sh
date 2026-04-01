echo "INSTALADOR WHATSAPP BOT PARA TERMUX"
echo "===================================="
echo ""
echo "ANTES DE CONTINUAR:"
echo "1. Abre Google Sheets"
echo "2. Ve al menú 'Control WhatsApp'"
echo "3. Haz clic en 'Obtener URL de Webhook'"
echo "4. Copia la URL que aparece"
echo ""
echo "===================================="
echo ""

# Pedir la URL de Google Sheets
echo "Pega la URL de Google Sheets que obtuviste en el paso anterio:"
echo "✏️  Pega la URL de Google Sheets y presiona ENTER:"
read URL_SHEETS

# Guardar la URL en un archivo
echo $URL_SHEETS > url_sheets.txt

echo ""
echo "✅ URL guardada"
echo "✅ URL guardada correctamente"
echo "La URL está en el archivo: url_sheets.txt"
echo ""
echo "En unos minutos podrás usar el bot"
echo ""
echo "PRÓXIMO PASO: Ejecuta el comando que te daré"
echo "===================================="
echo "SIGUIENTE PASO:"
echo "Ejecuta este comando:"
echo "bash setup.sh"
echo "===================================="
