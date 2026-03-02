// ============================================
// BOT DE WHATSAPP PARA TERMUX
// Versión: 6.0 - Con agenda local
// Características:
// - Conexión con código de emparejamiento
// - Typing automático
// - Link Previews activados
// - Agenda local (grupos, mensajes, horas)
// - Consulta a Google Sheets SOLO al inicio y cada 12h
// - Comando desde WhatsApp para actualizar
// - Logs solo locales
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
    archivo_agenda: './agenda.json',        // Archivo local con toda la programación
    tiempo_entre_mensajes: 5000,
    tiempo_typing: 3000,
    carpeta_logs: './logs',
    numero_telefono: '',
    // Horarios de actualización de agenda (consultas a Google Sheets)
    horarios_actualizacion: ['06:00', '18:00']  // 6am y 6pm
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
// CONSULTAR TODA LA PROGRAMACIÓN A GOOGLE SHEETS
// ============================================
async function consultarProgramacionCompleta(url) {
    try {
        console.log('🔄 Consultando programación completa a Google Sheets...');
        const respuesta = await axios.get(url);
        return respuesta.data;
    } catch (error) {
        console.error('❌ Error al consultar Google Sheets:', error.message);
        return null;
    }
}

// ============================================
// GUARDAR AGENDA LOCAL
// ============================================
function guardarAgendaLocal(data) {
    try {
        // Si no hay pendientes, agenda vacía
        const agenda = {
            ultima_actualizacion: new Date().toISOString(),
            mensajes: data.pendientes || []
        };
        fs.writeFileSync(CONFIG.archivo_agenda, JSON.stringify(agenda, null, 2));
        console.log(`✅ Agenda guardada localmente (${agenda.mensajes.length} mensajes)`);
        return true;
    } catch (error) {
        console.error('❌ Error guardando agenda:', error.message);
        return false;
    }
}

// ============================================
// CARGAR AGENDA LOCAL
// ============================================
function cargarAgendaLocal() {
    try {
        if (!fs.existsSync(CONFIG.archivo_agenda)) {
            console.log('📁 No hay agenda local (primera vez)');
            return { mensajes: [] };
        }
        const agenda = JSON.parse(fs.readFileSync(CONFIG.archivo_agenda, 'utf8'));
        console.log(`📋 Agenda cargada (${agenda.mensajes.length} mensajes)`);
        return agenda;
    } catch (error) {
        console.error('❌ Error cargando agenda:', error.message);
        return { mensajes: [] };
    }
}

// ============================================
// ACTUALIZAR AGENDA DESDE GOOGLE SHEETS
// ============================================
async function actualizarAgenda(sock, url_sheets, origen = 'automático') {
    try {
        guardarLogLocal(`🔄 Actualizando agenda (${origen})...`);
        
        const data = await consultarProgramacionCompleta(url_sheets);
        
        if (!data) {
            guardarLogLocal('⚠️ No se pudo conectar con Google Sheets');
            return false;
        }
        
        if (guardarAgendaLocal(data)) {
            guardarLogLocal(`✅ Agenda actualizada: ${data.pendientes?.length || 0} mensajes`);
            return true;
        }
        return false;
    } catch (error) {
        guardarLogLocal(`❌ Error actualizando agenda: ${error.message}`);
        return false;
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
    console.log(`📝 ${texto}`);
}

// ============================================
// SIMULAR TYPING
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
// ENVIAR MENSAJE A GRUPO
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
        return 'ERROR: ' + error.message.substring(0, 50);
    }
}

// ============================================
// VERIFICAR MENSAJES PENDIENTES (DESDE AGENDA LOCAL)
// ============================================
async function verificarMensajesLocales(sock) {
    try {
        const agenda = cargarAgendaLocal();
        
        if (!agenda.mensajes || agenda.mensajes.length === 0) {
            return;
        }

        const ahora = new Date();
        const horaActual = ahora.getHours().toString().padStart(2,'0') + ':' + 
                          ahora.getMinutes().toString().padStart(2,'0');
        const diaSemana = ['D','L','M','MI','J','V','S'][ahora.getDay()];

        // Buscar mensajes que coincidan con hora actual
        const mensajesAHora = agenda.mensajes.filter(msg => {
            return msg.hora === horaActual;
        });

        if (mensajesAHora.length === 0) {
            return;
        }

        guardarLogLocal(`📊 Enviando ${mensajesAHora.length} mensajes programados para las ${horaActual}`);

        for (const msg of mensajesAHora) {
            guardarLogLocal(`📤 Enviando a: ${msg.nombre || msg.id}`);
            const estado = await enviarMensaje(sock, msg.id, msg.mensaje);
            guardarLogLocal(`   Resultado: ${estado}`);
            await new Promise(resolve => setTimeout(resolve, CONFIG.tiempo_entre_mensajes));
        }

    } catch (error) {
        guardarLogLocal(`❌ ERROR: ${error.message}`);
    }
}

// ============================================
// INICIAR CONEXIÓN WHATSAPP
// ============================================
async function iniciarWhatsApp() {
    console.log('====================================');
    console.log('🤖 BOT WHATSAPP - VERSIÓN CON AGENDA LOCAL');
    console.log('====================================\n');
    console.log('⏰ Actualización de agenda: 6:00 AM y 6:00 PM');
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
                
                // PRIMERA VEZ: Actualizar agenda inmediatamente
                const agenda = cargarAgendaLocal();
                if (agenda.mensajes.length === 0) {
                    guardarLogLocal('📥 Primera ejecución - cargando agenda...');
                    await actualizarAgenda(sock, url_sheets, 'primera vez');
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
        // ACTUALIZACIÓN PROGRAMADA DE AGENDA (2 VECES AL DÍA)
        // ============================================
        CONFIG.horarios_actualizacion.forEach(hora => {
            const [horas, minutos] = hora.split(':');
            const expresionCron = `${minutos} ${horas} * * *`;
            
            cron.schedule(expresionCron, async () => {
                guardarLogLocal(`⏰ Actualización programada de agenda (${hora})`);
                await actualizarAgenda(sock, url_sheets, 'programado');
            });
        });

        // ============================================
        // VERIFICACIÓN DE MENSAJES CADA MINUTO (desde agenda local)
        // ============================================
        cron.schedule('* * * * *', async () => {
            await verificarMensajesLocales(sock);
        });

        // ============================================
        // COMANDOS DESDE WHATSAPP
        // ============================================
        sock.ev.on('messages.upsert', async (m) => {
            const mensaje = m.messages[0];
            if (mensaje.key && !mensaje.key.fromMe && mensaje.message) {
                const remitente = mensaje.key.remoteJid;
                const texto = mensaje.message.conversation || 
                             mensaje.message.extendedTextMessage?.text || '';
                
                // Solo responder a mensajes PRIVADOS (no de grupos)
                if (remitente && !remitente.includes('@g.us') && texto) {
                    const cmd = texto.toLowerCase().trim();
                    
                    if (cmd === 'actualizar' || cmd === 'update') {
                        guardarLogLocal(`📩 Comando remoto de ${remitente.split('@')[0]}: actualizar`);
                        const resultado = await actualizarAgenda(sock, url_sheets, 'remoto');
                        if (resultado) {
                            await sock.sendMessage(remitente, { text: '✅ Agenda actualizada correctamente' });
                        } else {
                            await sock.sendMessage(remitente, { text: '❌ Error al actualizar agenda' });
                        }
                    }
                }
            }
        });

        console.log('\n📝 Comandos disponibles:');
        console.log('   - En WhatsApp, escribe "actualizar" al bot');
        console.log('   - El bot actualizará su agenda inmediatamente');
        console.log('   - Presiona CTRL+C para salir\n');

    } catch (error) {
        guardarLogLocal(`❌ ERROR FATAL: ${error.message}`);
        setTimeout(() => iniciarWhatsApp(), 30000);
    }
}

// ============================================
// MANEJAR CIERRE
// ============================================
process.on('SIGINT', () => {
    console.log('\n\n👋 Cerrando bot...');
    guardarLogLocal('BOT CERRADO MANUALMENTE');
    process.exit(0);
});

// ============================================
// INICIAR
// ============================================
console.log('====================================');
console.log('🚀 SISTEMA DE MENSAJES CON AGENDA LOCAL');
console.log('====================================\n');

iniciarWhatsApp().catch(error => {
    console.log('❌ Error fatal:', error);
});
