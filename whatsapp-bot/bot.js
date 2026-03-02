// ============================================
// BOT DE WHATSAPP PARA TERMUX
// Versión: 5.0 - FINAL
// Características:
// - Conexión con código de emparejamiento
// - Typing automático (simula escritura)
// - Link Previews activados
// - Verificaciones cada 12 horas (8am y 8pm)
// - Logs solo locales (no en Google Sheets)
// - Comando manual "verificar"
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
    tiempo_entre_mensajes: 5000,      // 5 segundos entre mensajes
    tiempo_typing: 3000,               // 3 segundos de typing
    carpeta_logs: './logs',
    numero_telefono: '',
    // Horarios de verificación automática (12 horas)
    horarios: ['08:00', '20:00']        // 8am y 8pm
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
// GUARDAR LOG LOCAL (SOLO LOCAL, NO EN SHEETS)
// ============================================
function guardarLogLocal(texto) {
    const fecha = new Date().toISOString().split('T')[0];
    const logFile = path.join(CONFIG.carpeta_logs, `${fecha}.log`);
    const hora = new Date().toLocaleTimeString();
    fs.appendFileSync(logFile, `[${hora}] ${texto}\n`);
    console.log(`📝 ${texto}`); // Mostrar en pantalla también
}

// ============================================
// FUNCIÓN PARA SIMULAR QUE ESTÁ ESCRIBIENDO
// ============================================
async function simularTyping(sock, id_destino) {
    try {
        await sock.sendPresenceUpdate('composing', id_destino);
        const tiempoTyping = Math.floor(Math.random() * 2000) + 2000; // 2-4 segundos
        await new Promise(resolve => setTimeout(resolve, tiempoTyping));
        await sock.sendPresenceUpdate('paused', id_destino);
        await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {}
}

// ============================================
// ENVIAR MENSAJE A GRUPO (CON TYPING Y LINK PREVIEW)
// ============================================
async function enviarMensaje(sock, id_grupo, mensaje) {
    try {
        if (!id_grupo || !id_grupo.includes('@g.us')) {
            return 'ERROR: ID inválido';
        }
        
        // Simular que está escribiendo
        await simularTyping(sock, id_grupo);
        
        // Enviar mensaje CON link preview automático
        await sock.sendMessage(id_grupo, { 
            text: mensaje,
            // Link preview activado por defecto en Baileys
        });
        
        return 'ENVIADO';
    } catch (error) {
        return 'ERROR: ' + error.message.substring(0, 50);
    }
}

// ============================================
// PROCESAR MENSAJES PENDIENTES
// ============================================
async function procesarMensajes(sock, url, origen = 'automático') {
    try {
        guardarLogLocal(`🔍 Verificando mensajes (${origen})...`);
        
        const data = await consultarMensajesPendientes(url);
        
        if (!data) {
            guardarLogLocal('⚠️ No se pudo conectar con Google Sheets');
            return;
        }
        
        if (!data.pendientes || data.pendientes.length === 0) {
            guardarLogLocal('⏳ No hay mensajes pendientes');
            return;
        }

        guardarLogLocal(`📊 Se encontraron ${data.pendientes.length} mensajes`);

        for (const grupo of data.pendientes) {
            guardarLogLocal(`📤 Enviando a: ${grupo.nombre || grupo.id}`);
            
            const estado = await enviarMensaje(sock, grupo.id, grupo.mensaje);
            
            guardarLogLocal(`   Resultado: ${estado}`);
            
            // Esperar entre mensajes
            await new Promise(resolve => setTimeout(resolve, CONFIG.tiempo_entre_mensajes));
        }
        
        guardarLogLocal('✅ Proceso completado');
        
    } catch (error) {
        guardarLogLocal(`❌ ERROR: ${error.message}`);
    }
}

// ============================================
// VERIFICAR SI ES HORA DE EJECUTAR (12 HORAS)
// ============================================
function esHoraDeEjecutar() {
    const ahora = new Date();
    const horaActual = ahora.getHours().toString().padStart(2,'0') + ':' + 
                      ahora.getMinutes().toString().padStart(2,'0');
    
    return CONFIG.horarios.includes(horaActual);
}

// ============================================
// INICIAR CONEXIÓN WHATSAPP
// ============================================
async function iniciarWhatsApp() {
    console.log('====================================');
    console.log('🤖 BOT WHATSAPP - VERSIÓN FINAL');
    console.log('====================================\n');
    console.log('⏰ Horarios automáticos: 8:00 AM y 8:00 PM');
    console.log('✍️  Typing activado');
    console.log('🔗 Link Previews activados');
    console.log('📝 Logs locales (carpeta logs/)\n');

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

        // CÓDIGO DE EMPAREJAMIENTO
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

        // Eventos de conexión
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === 'open') {
                console.log('\n✅ CONECTADO A WHATSAPP\n');
                guardarLogLocal('CONEXIÓN EXITOSA');
                
                // Verificar si es hora de ejecutar al conectar
                if (esHoraDeEjecutar()) {
                    await procesarMensajes(sock, url_sheets, 'automático');
                }
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error instanceof Boom ? lastDisconnect.error.output.statusCode : 500;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                
                if (shouldReconnect) {
                    guardarLogLocal('🔄 Reconectando...');
                    setTimeout(() => iniciarWhatsApp(), 5000);
                } else {
                    guardarLogLocal('🚫 Sesión cerrada. Borra carpeta sesion_whatsapp');
                }
            }
        });

        sock.ev.on('creds.update', saveCreds);

        // ============================================
        // VERIFICACIÓN AUTOMÁTICA CADA 12 HORAS
        // ============================================
        // Programar verificaciones en horarios específicos
        CONFIG.horarios.forEach(hora => {
            const [horas, minutos] = hora.split(':');
            // Cron: minutos horas * * *
            const expresionCron = `${minutos} ${horas} * * *`;
            
            cron.schedule(expresionCron, async () => {
                guardarLogLocal(`⏰ Verificación programada (${hora})`);
                await procesarMensajes(sock, url_sheets, 'automático');
            });
        });

        // ============================================
        // VERIFICACIÓN MANUAL (escribe "verificar")
        // ============================================
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl.on('line', async (input) => {
            if (input.toLowerCase() === 'verificar') {
                await procesarMensajes(sock, url_sheets, 'manual');
            }
        });

        console.log('\n📝 Comandos disponibles:');
        console.log('   - Escribe "verificar" para revisar AHORA');
        console.log('   - Presiona CTRL+C para salir\n');

    } catch (error) {
        guardarLogLocal(`❌ ERROR FATAL: ${error.message}`);
        setTimeout(() => iniciarWhatsApp(), 30000);
    }
}

// ============================================
// MANEJAR CIERRE DEL PROGRAMA
// ============================================
process.on('SIGINT', () => {
    console.log('\n\n👋 Cerrando bot...');
    guardarLogLocal('BOT CERRADO MANUALMENTE');
    process.exit(0);
});

// ============================================
// INICIAR EL BOT
// ============================================
console.log('====================================');
console.log('🚀 SISTEMA DE MENSAJES WHATSAPP');
console.log('====================================\n');

iniciarWhatsApp().catch(error => {
    console.log('❌ Error fatal:', error);
});
