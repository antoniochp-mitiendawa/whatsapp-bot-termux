// ============================================
// BOT DE WHATSAPP PARA TERMUX
// Versión: 2.7 (con typing incluido)
// ============================================

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cron = require('node-cron');
const readline = require('readline');
const pino = require('pino');

// ============================================
// CONFIGURACIÓN
// ============================================
const CONFIG = {
    carpeta_sesion: './sesion_whatsapp',
    archivo_url: '../url_sheets.txt',
    tiempo_entre_mensajes: 5000,
    tiempo_typing: 3000,
    carpeta_logs: './logs',
    numero_telefono: ''
};

// Crear carpetas necesarias
if (!fs.existsSync(CONFIG.carpeta_logs)) {
    fs.mkdirSync(CONFIG.carpeta_logs);
}
if (!fs.existsSync(CONFIG.carpeta_sesion)) {
    fs.mkdirSync(CONFIG.carpeta_sesion);
}

// ============================================
// LEER URL DE GOOGLE SHEETS
// ============================================
function leerURL() {
    try {
        let urlPath = CONFIG.archivo_url;
        if (!fs.existsSync(urlPath)) {
            urlPath = './url_sheets.txt';
        }
        const url = fs.readFileSync(urlPath, 'utf8').trim();
        console.log('✅ URL de Google Sheets cargada');
        return url;
    } catch (error) {
        console.error('❌ No se pudo leer la URL:', error.message);
        return null;
    }
}

// ============================================
// PEDIR NÚMERO DE TELÉFONO
// ============================================
function pedirNumeroSilencioso() {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        rl.question('📱 Introduce tu número (sin +): ', (numero) => {
            rl.close();
            resolve(numero.trim());
        });
    });
}

// ============================================
// CONSULTAR MENSAJES PENDIENTES
// ============================================
async function consultarMensajesPendientes(url) {
    try {
        const respuesta = await axios.get(url);
        return respuesta.data;
    } catch (error) {
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
    } catch (error) {}
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
// FUNCIÓN PARA SIMULAR QUE ESTÁ ESCRIBIENDO
// ============================================
async function simularTyping(sock, id_destino) {
    try {
        await sock.sendPresenceUpdate('composing', id_destino);
        const tiempoTyping = Math.floor(Math.random() * 2000) + 2000;
        await new Promise(resolve => setTimeout(resolve, tiempoTyping));
        await sock.sendPresenceUpdate('paused', id_destino);
        await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {}
}

// ============================================
// ENVIAR MENSAJE A GRUPO (CON TYPING)
// ============================================
async function enviarMensaje(sock, id_grupo, mensaje) {
    try {
        if (!id_grupo || !id_grupo.includes('@g.us')) {
            return 'ERROR: ID inválido';
        }
        
        await simularTyping(sock, id_grupo);
        await sock.sendMessage(id_grupo, { text: mensaje });
        return 'ENVIADO';
    } catch (error) {
        return 'ERROR';
    }
}

// ============================================
// PROCESAR MENSAJES PENDIENTES
// ============================================
async function procesarMensajes(sock, url) {
    try {
        const data = await consultarMensajesPendientes(url);
        
        if (!data || !data.pendientes || data.pendientes.length === 0) {
            return;
        }

        for (const grupo of data.pendientes) {
            const estado = await enviarMensaje(sock, grupo.id, grupo.mensaje);
            await registrarEnvio(url, grupo.id, grupo.mensaje, estado);
            guardarLogLocal(`${grupo.id} - ${estado}`);
            await new Promise(resolve => setTimeout(resolve, CONFIG.tiempo_entre_mensajes));
        }
        
    } catch (error) {
        guardarLogLocal(`ERROR: ${error.message}`);
    }
}

// ============================================
// INICIAR CONEXIÓN WHATSAPP
// ============================================
async function iniciarWhatsApp() {
    console.log('====================================');
    console.log('🤖 INICIANDO BOT');
    console.log('====================================\n');

    const url_sheets = leerURL();
    if (!url_sheets) {
        console.log('❌ No hay URL');
        return;
    }

    try {
        const { version } = await fetchLatestBaileysVersion();
        
        const logger = pino({ level: 'silent' });
        const { state, saveCreds } = await useMultiFileAuthState(CONFIG.carpeta_sesion);

        const sock = makeWASocket({
            version,
            auth: state,
            logger: logger,
            printQRInTerminal: false,
            browser: ["Ubuntu", "Chrome", "20.0.04"],
            syncFullHistory: false,
            markOnlineOnConnect: true,
            defaultQueryTimeoutMs: 60000,
            shouldSyncHistoryMessage: () => false
        });

        if (!sock.authState.creds.registered) {
            console.log('📱 PRIMERA CONFIGURACIÓN\n');
            const numero = await pedirNumeroSilencioso();
            console.log(`\n🔄 Solicitando código...`);
            
            setTimeout(async () => {
                try {
                    const codigo = await sock.requestPairingCode(numero);
                    console.log('\n====================================');
                    console.log('🔐 CÓDIGO:', codigo);
                    console.log('====================================');
                    console.log('1. Abre WhatsApp');
                    console.log('2. 3 puntos → Dispositivos vinculados');
                    console.log('3. Vincular con número');
                    console.log('4. Ingresa el código\n');
                } catch (error) {
                    console.log('❌ Error al generar código');
                }
            }, 2000);
        }

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === 'open') {
                console.log('\n✅ CONECTADO A WHATSAPP\n');
                guardarLogLocal('CONEXIÓN EXITOSA');
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error instanceof Boom ? lastDisconnect.error.output.statusCode : 500;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                
                if (shouldReconnect) {
                    setTimeout(() => iniciarWhatsApp(), 5000);
                }
            }
        });

        sock.ev.on('creds.update', saveCreds);

        cron.schedule('0 * * * * *', async () => {
            await procesarMensajes(sock, url_sheets);
        });

        console.log('⏰ Bot listo (verifica cada minuto)');
        console.log('✍️  Typing activado (simula escritura)\n');

    } catch (error) {
        guardarLogLocal(`ERROR: ${error.message}`);
        setTimeout(() => iniciarWhatsApp(), 10000);
    }
}

console.log('====================================');
console.log('🚀 SISTEMA DE MENSAJES CON TYPING');
console.log('====================================\n');

iniciarWhatsApp().catch(error => {
    console.log('❌ Error');
});
