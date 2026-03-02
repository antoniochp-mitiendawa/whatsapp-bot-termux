#!/bin/bash

echo "===================================="
echo "INSTALADOR WHATSAPP BOT PARA TERMUX"
echo "===================================="
echo ""

# Pedir la URL de Google Sheets
echo "Pega la URL de Google Sheets que obtuviste en el paso anterio:"
read URL_SHEETS

# Guardar la URL en un archivo
echo $URL_SHEETS > url_sheets.txt

echo ""
echo "✅ URL guardada"
echo ""
echo "En unos minutos podrás usar el bot"
echo ""
echo "PRÓXIMO PASO: Ejecuta el comando que te daré"
