// ============================================
// BOT DE WHATSAPP PARA TERMUX
// Versión: 1.0
// ============================================

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cron = require('node-cron');

// ============================================
// CONFIGURACIÓN
// ============================================
const CONFIG = {
    carpeta_sesion: './sesion_whatsapp',
    archivo_url: '../url_sheets.txt',  // La URL que guardamos al instalar
    tiempo_entre_mensajes: 5000,  // 5 segundos
    carpeta_logs: './logs'
};

// Crear carpeta de logs si no existe
if (!fs.existsSync(CONFIG.carpeta_logs)) {
    fs.mkdirSync(CONFIG.carpeta_logs);
}

// ============================================
// LEER URL DE GOOGLE SHEETS
// ============================================
function leerURL() {
    try {
        const url = fs.readFileSync(CONFIG.archivo_url, 'utf8').trim();
        console.log('✅ URL de Google Sheets cargada');
        return url;
    } catch (error) {
        console.error('❌ No se pudo leer la URL:', error.message);
        console.log('📝 Asegúrate de que el archivo url_sheets.txt existe');
        return null;
    }
}

// ============================================
// CONSULTAR MENSAJES PENDIENTES
// ============================================
async function consultarMensajesPendientes(url) {
    try {
        console.log('🔄 Consultando mensajes pendientes...');
        const respuesta = await axios.get(url);
        return respuesta.data;
    } catch (error) {
        console.error('❌ Error al consultar Google Sheets:', error.message);
        return null;
    }
}

// ============================================
// REGISTRAR ENVÍO EN LOGS
// ============================================
async function registrarEnvio(url, id_grupo, mensaje, estado) {
    try {
        await axios.post(url, {
            accion: 'registrar_envio',
            id_grupo: id_grupo,
            mensaje: mensaje,
            estado: estado
        });
    } catch (error) {
        console.log('⚠️ No se pudo registrar en logs:', error.message);
    }
}

// ============================================
// GUARDAR LOG LOCAL
// ============================================
function guardarLogLocal(texto) {
    const fecha = new Date().toISOString().split('T')[0];
    const logFile = path.join(CONFIG.carpeta_logs, `${fecha}.log`);
    const hora = new Date().toLocaleTimeString();
    fs.appendFileSync(logFile, `[${hora}] ${texto}\n`);
}

// ============================================
// ENVIAR MENSAJE A GRUPO
// ============================================
async function enviarMensaje(sock, id_grupo, mensaje) {
    try {
        console.log(`📤 Enviando a: ${id_grupo}`);
        await sock.sendMessage(id_grupo, { text: mensaje });
        console.log('✅ Enviado correctamente');
        return 'ENVIADO';
    } catch (error) {
        console.error('❌ Error al enviar:', error.message);
        return 'ERROR: ' + error.message.substring(0, 50);
    }
}

// ============================================
// PROCESAR MENSAJES PENDIENTES
// ============================================
async function procesarMensajes(sock, url) {
    try {
        // Consultar mensajes pendientes
        const data = await consultarMensajesPendientes(url);
        
        if (!data || !data.pendientes || data.pendientes.length === 0) {
            console.log('⏳ No hay mensajes pendientes en este momento');
            return;
        }

        console.log(`📊 Se encontraron ${data.pendientes.length} mensajes para enviar`);

        // Enviar cada mensaje
        for (const grupo of data.pendientes) {
            console.log('-----------------------------------');
            console.log(`👥 Grupo: ${grupo.nombre || 'Sin nombre'}`);
            
            const estado = await enviarMensaje(sock, grupo.id, grupo.mensaje);
            
            // Registrar en Google Sheets
            await registrarEnvio(url, grupo.id, grupo.mensaje, estado);
            
            // Guardar en log local
            guardarLogLocal(`${grupo.id} - ${estado}`);
            
            // Esperar entre mensajes
            await new Promise(resolve => setTimeout(resolve, CONFIG.tiempo_entre_mensajes));
        }
        
        console.log('-----------------------------------');
        console.log('✅ Proceso completado');
        
    } catch (error) {
        console.error('❌ Error en procesarMensajes:', error.message);
        guardarLogLocal(`ERROR GENERAL: ${error.message}`);
    }
}

// ============================================
// INICIAR CONEXIÓN WHATSAPP
// ============================================
async function iniciarWhatsApp() {
    console.log('====================================');
    console.log('🤖 INICIANDO BOT DE WHATSAPP');
    console.log('====================================');

    // Leer URL de Google Sheets
    const url_sheets = leerURL();
    if (!url_sheets) {
        console.log('❌ No se puede continuar sin la URL');
        return;
    }

    // Cargar o crear sesión
    const { state, saveCreds } = await useMultiFileAuthState(CONFIG.carpeta_sesion);

    // Crear conexión
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        browser: ['WhatsApp Bot', 'Termux', '1.0.0']
    });

    // Manejar QR
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('\n📱 ESCANEA ESTE CÓDIGO QR CON WHATSAPP:');
            qrcode.generate(qr, { small: true });
            console.log('\n(El código se actualiza cada 20 segundos)\n');
        }

        if (connection === 'open') {
            console.log('====================================');
            console.log('✅ CONECTADO A WHATSAPP');
            console.log('====================================');
            console.log('📱 El bot está listo para enviar mensajes');
            console.log('⏰ Esperando mensajes programados...\n');
            
            guardarLogLocal('CONEXIÓN EXITOSA');
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('❌ Conexión cerrada. Reconectando:', shouldReconnect);
            
            if (shouldReconnect) {
                iniciarWhatsApp();
            } else {
                console.log('🚫 Sesión cerrada. Borra la carpeta sesion_whatsapp y vuelve a escanear');
            }
        }
    });

    // Guardar credenciales
    sock.ev.on('creds.update', saveCreds);

    // Mensajes recibidos (para debug)
    sock.ev.on('messages.upsert', async (m) => {
        const mensaje = m.messages[0];
        if (!mensaje.key.fromMe && mensaje.message) {
            console.log(`📩 Mensaje de: ${mensaje.key.remoteJid}`);
        }
    });

    // PROGRAMAR TAREAS
    // ============================================
    // Ejecutar cada minuto para verificar mensajes
    cron.schedule('* * * * *', async () => {
        console.log(`\n🕐 Verificando: ${new Date().toLocaleTimeString()}`);
        await procesarMensajes(sock, url_sheets);
    });

    // También ejecutar una vez al inicio
    setTimeout(() => {
        procesarMensajes(sock, url_sheets);
    }, 5000);
}

// ============================================
// INICIAR EL BOT
// ============================================
console.log('🚀 Iniciando sistema...');
iniciarWhatsApp().catch(error => {
    console.error('❌ Error fatal:', error);
    guardarLogLocal(`ERROR FATAL: ${error.message}`);
});
