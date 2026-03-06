// ============================================
// BOT DE WHATSAPP PARA TERMUX
// Versión: 39.0 - CONSULTA MASIVA RESTAURADA
// + MEJORA 1: Keep-Alive cada 25 segundos
// + MEJORA 2: Ignorar mensajes de grupos
// ============================================

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, getUrlInfo, Browsers } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cron = require('node-cron');
const readline = require('readline');
const pino = require('pino');
const { getLinkPreview } = require('link-preview-js');
const crypto = require('crypto');
// ============================================
// LIBRERÍA PARA DATA STORE
// ============================================
const { makeInMemoryStore } = require('@rodrigogs/baileys-store');

// ============================================
// FUNCIÓN AUXILIAR: PROCESADOR DE SPINTAX {A|B|C}
// ============================================
function procesarSpintax(texto) {
    if (!texto) return "";
    return texto.replace(/{([^{}]+)}/g, (match, opciones) => {
        const opcionesArray = opciones.split('|');
        return opcionesArray[Math.floor(Math.random() * opcionesArray.length)];
    });
}

// ============================================
// CONFIGURACIÓN
// ============================================
const CONFIG = {
    carpeta_sesion: './sesion_whatsapp',
    archivo_url: '../url_sheets.txt',
    archivo_agenda: './agenda.json',
    archivo_store: './baileys_store.json',
    tiempo_entre_mensajes_min: 1,
    tiempo_entre_mensajes_max: 5,
    tiempo_typing: 3000,
    carpeta_logs: './logs',
    carpeta_cache: './cache',
    numero_telefono: '',
    horarios_actualizacion: ['06:00', '18:00'],
    dias_retencion_store: 30,
    carpeta_multimedia: '/storage/emulated/0/WhatsAppBot',
    tiempo_espera_grupos: 30000
};

// Crear carpetas necesarias
if (!fs.existsSync(CONFIG.carpeta_logs)) fs.mkdirSync(CONFIG.carpeta_logs, { recursive: true });
if (!fs.existsSync(CONFIG.carpeta_cache)) fs.mkdirSync(CONFIG.carpeta_cache, { recursive: true });

// ============================================
// DATA STORE PARA PERSISTENCIA
// ============================================
const store = makeInMemoryStore({ 
    logger: pino({ level: 'silent' }) 
});

// Cargar store si existe
if (fs.existsSync(CONFIG.archivo_store)) {
    store.readFromFile(CONFIG.archivo_store);
}

// Guardar cada 10 segundos
setInterval(() => {
    store.writeToFile(CONFIG.archivo_store);
}, 10000);

function guardarLogLocal(mensaje) {
    const ahora = new Date();
    const timestamp = ahora.toLocaleString();
    const logMsg = `[${timestamp}] ${mensaje}\n`;
    console.log(logMsg.trim());
    const fechaFile = ahora.toISOString().split('T')[0];
    fs.appendFileSync(path.join(CONFIG.carpeta_logs, `log_${fechaFile}.txt`), logMsg);
}

function limpiarCacheImagenes() {
    if (fs.existsSync(CONFIG.carpeta_cache)) {
        const archivos = fs.readdirSync(CONFIG.carpeta_cache);
        for (const archivo of archivos) {
            fs.unlinkSync(path.join(CONFIG.carpeta_cache, archivo));
        }
        guardarLogLocal('🗑️  Caché de imágenes limpiada.');
    }
}

function buscarArchivoMultimedia(texto) {
    if (!texto) return null;
    const match = texto.match(/\[(.*?\.(jpg|jpeg|png|mp4|pdf|webp))\]/i);
    if (match) {
        const nombreArchivo = match[1];
        const rutaCompleta = path.join(CONFIG.carpeta_multimedia, nombreArchivo);
        if (fs.existsSync(rutaCompleta)) {
            return {
                ruta: rutaCompleta,
                nombre: nombreArchivo,
                tipo: nombreArchivo.toLowerCase().endsWith('.mp4') ? 'video' : 
                      nombreArchivo.toLowerCase().endsWith('.pdf') ? 'document' : 'image',
                tagOriginal: match[0]
            };
        }
    }
    return null;
}

async function simularTyping(sock, jid, segundos) {
    await sock.sendPresenceUpdate('composing', jid);
    await new Promise(resolve => setTimeout(resolve, segundos * 1000));
    await sock.sendPresenceUpdate('paused', jid);
}

async function enviarArchivoMultimedia(sock, id_grupo, info, textoOriginal) {
    const textoSinTag = textoOriginal.replace(info.tagOriginal, '').trim();
    const mediaContenido = fs.readFileSync(info.ruta);
    
    if (info.tipo === 'image') {
        await sock.sendMessage(id_grupo, { image: mediaContenido, caption: textoSinTag });
    } else if (info.tipo === 'video') {
        await sock.sendMessage(id_grupo, { video: mediaContenido, caption: textoSinTag });
    } else if (info.tipo === 'document') {
        await sock.sendMessage(id_grupo, { document: mediaContenido, fileName: info.nombre, caption: textoSinTag });
    }
}

async function enviarMensajeProgramado(sock, grupo) {
    try {
        const id_grupo = grupo.id_grupo;
        
        // --- PROCESAMIENTO DE SPINTAX SOBRE EL MENSAJE ORIGINAL ---
        const mensajeFinal = procesarSpintax(grupo.mensaje || "");
        
        guardarLogLocal(`📤 Preparando envío a: ${grupo.nombre} (${id_grupo})`);
        
        // Simular escritura (3 segundos)
        await simularTyping(sock, id_grupo, 3);
        
        // Verificar si el mensaje procesado tiene etiquetas multimedia
        const archivoInfo = buscarArchivoMultimedia(mensajeFinal);
        
        if (archivoInfo) {
            await enviarArchivoMultimedia(sock, id_grupo, archivoInfo, mensajeFinal);
        } else {
            await sock.sendMessage(id_grupo, { text: mensajeFinal });
        }
        
        guardarLogLocal(`✅ Mensaje enviado a: ${grupo.nombre}`);
        return true;
    } catch (error) {
        guardarLogLocal(`❌ Error en envío a ${grupo.nombre}: ${error.message}`);
        return false;
    }
}

async function sincronizarYProgramar(sock) {
    try {
        const url_file = path.join(__dirname, CONFIG.archivo_url);
        if (!fs.existsSync(url_file)) {
            console.log('❌ No existe url_sheets.txt');
            return;
        }

        const url = fs.readFileSync(url_file, 'utf8').trim();
        guardarLogLocal('🔄 Sincronizando con Google Sheets...');
        
        const response = await axios.get(url);
        const { config, grupos } = response.data;

        if (config.ACTIVAR_BOT !== 'SI') {
            guardarLogLocal('🛑 El bot está desactivado en la CONFIG de la hoja.');
            return;
        }

        guardarLogLocal(`📊 ${grupos.length} grupos activos encontrados.`);

        // Limpiar tareas anteriores
        cron.getTasks().forEach(task => task.stop());
        guardarLogLocal('🗑️  Tareas anteriores limpiadas.');

        // Programar nuevos envíos
        grupos.forEach(grupo => {
            const [hora, minuto] = grupo.horario_rector.split(':');
            const diasMap = { 'L': 1, 'M': 2, 'MI': 3, 'J': 4, 'V': 5, 'S': 6, 'D': 0 };
            const diasCron = grupo.dias.split(',').map(d => diasMap[d.trim().toUpperCase()]).join(',');

            cron.schedule(`${minuto} ${hora} * * ${diasCron}`, async () => {
                // Calcular tiempo aleatorio basado en la configuración de la hoja
                const min = parseInt(config.TIEMPO_ENTRE_MENSAJES.split('-')[0]) || 1;
                const max = parseInt(config.TIEMPO_ENTRE_MENSAJES.split('-')[1]) || 30;
                const waitTime = Math.floor(Math.random() * (max - min + 1) + min) * 60 * 1000;
                
                guardarLogLocal(`⏳ Espera aleatoria para ${grupo.nombre}: ${waitTime/1000}s`);
                await new Promise(r => setTimeout(r, waitTime));
                
                await enviarMensajeProgramado(sock, grupo);
            }, {
                scheduled: true,
                timezone: "America/Mexico_City"
            });
        });

        guardarLogLocal('📅 Todas las tareas programadas con éxito.');

    } catch (error) {
        guardarLogLocal(`❌ Error en sincronización: ${error.message}`);
    }
}

async function enviarListaGruposASheets(sock) {
    try {
        const url_file = path.join(__dirname, CONFIG.archivo_url);
        if (!fs.existsSync(url_file)) return;
        const url = fs.readFileSync(url_file, 'utf8').trim();

        guardarLogLocal('🔍 Obteniendo lista completa de grupos...');
        
        const chats = await sock.groupFetchAllParticipating();
        const grupos = Object.values(chats).map(g => ({
            id: g.id,
            nombre: g.subject
        }));

        await axios.post(url, { grupos });
        guardarLogLocal(`✅ ${grupos.length} grupos enviados a la hoja.`);
    } catch (error) {
        guardarLogLocal(`❌ Error al enviar grupos: ${error.message}`);
    }
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

async function iniciarWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState(CONFIG.carpeta_sesion);
    const { version } = await fetchLatestBaileysVersion();

    try {
        const sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }),
            browser: Browsers.macOS('Desktop'),
            generateHighQualityLinkPreview: true,
            syncFullHistory: false,
            markOnlineOnConnect: true
        });

        // --- LÓGICA DE PAIRING CODE (CÓDIGO DE EMPAREJAMIENTO) ---
        if (!sock.authState.creds.registered) {
            console.log('--- INICIANDO VINCULACIÓN POR CÓDIGO ---');
            const phoneNumber = await question('📱 Introduce tu número de teléfono (ej. 52199...): ');
            const code = await sock.requestPairingCode(phoneNumber.trim());
            console.log(`\n🔗 TU CÓDIGO DE VINCULACIÓN: \x1b[32m${code}\x1b[0m\n`);
        }

        store.bind(sock.ev);

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
                console.log('🔴 Conexión cerrada. ¿Reconectando?:', shouldReconnect);
                if (shouldReconnect) {
                    setTimeout(() => iniciarWhatsApp(), 5000);
                } else {
                    console.log('❌ Sesión cerrada permanentemente.');
                }
            } else if (connection === 'open') {
                console.log('🟢 Bot Conectado y Listo.');
                guardarLogLocal('--- BOT INICIADO Y CONECTADO ---');
                
                sincronizarYProgramar(sock);
                
                // Keep-alive cada 25 segundos
                setInterval(async () => {
                    await sock.sendPresenceUpdate('available');
                }, 25000);
            }
        });

        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            if (type !== 'notify') return;
            const msg = messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const remitente = msg.key.remoteJid;
            const esGrupo = remitente.endsWith('@g.us');
            const textoMensaje = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase().trim();

            if (!esGrupo) {
                // COMANDO ACTUALIZAR
                if (textoMensaje === 'actualizar') {
                    await sock.sendMessage(remitente, { text: '🔄 Sincronizando grupos y tareas... por favor espera.' });
                    await sincronizarYProgramar(sock);
                    await sock.sendMessage(remitente, { text: '✅ Sincronización completada.' });
                }
                
                // COMANDO LISTAGRUPOS
                if (textoMensaje === 'listagrupos') {
                    await sock.sendMessage(remitente, { text: '🔍 Enviando lista de grupos a Google Sheets...' });
                    await enviarListaGruposASheets(sock);
                    await sock.sendMessage(remitente, { text: '✅ Lista actualizada en la pestaña LISTA_GRUPOS.' });
                }

                // COMANDO STATUS
                if (textoMensaje === 'status') {
                    const stats = fs.statSync(CONFIG.archivo_store);
                    const existeSesion = fs.existsSync(CONFIG.carpeta_sesion);
                    const mensaje = `🤖 *ESTADO DEL BOT*\n\n` +
                                  `✅ Conexión: Activa\n` +
                                  `📁 Carpeta Sesión: ${existeSesion ? 'OK' : 'ERROR'}\n` +
                                  `📊 Base de datos: ${(stats.size / 1024).toFixed(2)} KB\n` +
                                  `🗑️  Limpieza automática: activada\n` +
                                  `🌐 Browser: ${existeSesion ? 'macOS/Desktop' : 'Ubuntu/Chrome'}\n` +
                                  `📤 Comando listagrupos: disponible (con caché)\n` +
                                  `⏰ Próxima actualización: 6am/6pm`;
                    
                    await sock.sendMessage(remitente, { text: mensaje });
                }
            }
        });

        console.log('\n📝 Comandos disponibles en WhatsApp:');
        console.log('   - "actualizar" - ⚡ PRIORITARIO (se ejecuta inmediatamente)');
        console.log('   - "listagrupos" - ⚡ PRIORITARIO (se ejecuta inmediatamente)');
        console.log('   - "status" - Ver estado del bot');
        console.log('   - Presiona CTRL+C para salir\n');

    } catch (error) {
        guardarLogLocal(`❌ ERROR FATAL: ${error.message}`);
        setTimeout(() => iniciarWhatsApp(), 30000);
    }
}

process.on('SIGINT', () => {
    console.log('\n\n👋 Cerrando bot...');
    guardarLogLocal('BOT CERRADO MANUALMENTE');
    limpiarCacheImagenes();
    store.writeToFile(CONFIG.archivo_store);
    process.exit(0);
});

console.log('====================================');
console.log('🚀 SISTEMA DE MENSAJES MULTI-GRUPO');
console.log('====================================');

iniciarWhatsApp();

// Tareas de mantenimiento (Actualización programada cada 12 horas)
cron.schedule('0 6,18 * * *', () => {
    guardarLogLocal('⏰ Ejecutando actualización programada...');
});
