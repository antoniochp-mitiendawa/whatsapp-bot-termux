// ============================================
// BOT DE WHATSAPP PARA TERMUX
// Versión: 9.0 - Typing y Previews funcionales
// Características:
// - Conexión con código de emparejamiento
// - Typing automático con duración adaptada al delay
// - Link Previews forzadas para URLs
// - Múltiples pestañas GRUPOS*, GRUPOS1*, etc.
// - Cada pestaña tiene su propio horario rector
// - Delays aleatorios entre mensajes (mín/máx desde CONFIG)
// - Descarga completa de agenda
// - Comandos "actualizar" y "status" desde WhatsApp
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
    archivo_agenda: './agenda.json',
    tiempo_entre_mensajes_min: 2,  // valor por defecto (se actualiza desde Google Sheets)
    tiempo_entre_mensajes_max: 5,  // valor por defecto
    tiempo_typing: 3000,
    carpeta_logs: './logs',
    numero_telefono: '',
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
// CONSULTAR TODOS LOS GRUPOS A GOOGLE SHEETS
// ============================================
async function consultarTodosLosGrupos(url) {
    try {
        console.log('🔄 Descargando TODOS los grupos desde Google Sheets...');
        const respuesta = await axios.get(url);
        const data = respuesta.data;
        
        // Actualizar configuración desde Google Sheets
        if (data.config) {
            if (data.config.TIEMPO_ENTRE_MENSAJES_MIN) {
                CONFIG.tiempo_entre_mensajes_min = parseInt(data.config.TIEMPO_ENTRE_MENSAJES_MIN) || 2;
            }
            if (data.config.TIEMPO_ENTRE_MENSAJES_MAX) {
                CONFIG.tiempo_entre_mensajes_max = parseInt(data.config.TIEMPO_ENTRE_MENSAJES_MAX) || 5;
            }
            console.log(`⏱️  Delay configurado: ${CONFIG.tiempo_entre_mensajes_min}-${CONFIG.tiempo_entre_mensajes_max} segundos`);
        }
        
        return data;
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
        const grupos = data.grupos || [];
        
        // Organizar grupos por pestaña y horario rector
        const agenda = {
            ultima_actualizacion: new Date().toISOString(),
            config: {
                min: CONFIG.tiempo_entre_mensajes_min,
                max: CONFIG.tiempo_entre_mensajes_max
            },
            pestanas: {},
            grupos: grupos,
            total: grupos.length
        };
        
        // Agrupar por pestaña
        grupos.forEach(grupo => {
            if (!agenda.pestanas[grupo.pestana]) {
                agenda.pestanas[grupo.pestana] = {
                    horario: grupo.horario_rector,
                    grupos: []
                };
            }
            agenda.pestanas[grupo.pestana].grupos.push(grupo);
        });
        
        fs.writeFileSync(CONFIG.archivo_agenda, JSON.stringify(agenda, null, 2));
        
        // Mostrar resumen de pestañas
        console.log(`✅ Agenda guardada localmente (${grupos.length} grupos en ${Object.keys(agenda.pestanas).length} pestañas)`);
        Object.keys(agenda.pestanas).forEach(pestana => {
            const p = agenda.pestanas[pestana];
            console.log(`   📌 ${pestana}: ${p.grupos.length} grupos - Horario: ${p.horario || 'N/A'}`);
        });
        
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
            return { grupos: [], pestanas: {}, total: 0 };
        }
        const agenda = JSON.parse(fs.readFileSync(CONFIG.archivo_agenda, 'utf8'));
        
        // Actualizar configuración desde agenda
        if (agenda.config) {
            CONFIG.tiempo_entre_mensajes_min = agenda.config.min || 2;
            CONFIG.tiempo_entre_mensajes_max = agenda.config.max || 5;
        }
        
        console.log(`📋 Agenda cargada (${agenda.grupos?.length || 0} grupos)`);
        return agenda;
    } catch (error) {
        console.error('❌ Error cargando agenda:', error.message);
        return { grupos: [], pestanas: {}, total: 0 };
    }
}

// ============================================
// ACTUALIZAR AGENDA
// ============================================
async function actualizarAgenda(sock, url_sheets, origen = 'automático') {
    try {
        guardarLogLocal(`🔄 Actualizando agenda (${origen})...`);
        
        const data = await consultarTodosLosGrupos(url_sheets);
        
        if (!data) {
            guardarLogLocal('⚠️ No se pudo conectar con Google Sheets');
            return false;
        }
        
        if (data.error) {
            guardarLogLocal(`⚠️ Error en Sheets: ${data.error}`);
            return false;
        }
        
        if (guardarAgendaLocal(data)) {
            const total = data.grupos?.length || 0;
            const pestanas = data.pestanas?.length || 0;
            guardarLogLocal(`✅ Agenda actualizada: ${total} grupos en ${pestanas} pestañas`);
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
// FUNCIÓN PARA SIMULAR QUE ESTÁ ESCRIBIENDO (CORREGIDA)
// ============================================
async function simularTyping(sock, id_destino, duracion) {
    try {
        // Iniciar typing
        await sock.sendPresenceUpdate('composing', id_destino);
        guardarLogLocal(`   ✍️ Typing por ${duracion} segundos...`);
        
        // Mantener typing durante casi todo el delay
        await new Promise(resolve => setTimeout(resolve, duracion * 1000));
        
        // Detener typing justo antes de enviar
        await sock.sendPresenceUpdate('paused', id_destino);
        await new Promise(resolve => setTimeout(resolve, 500)); // Pequeña pausa antes de enviar
        
    } catch (error) {
        guardarLogLocal(`   ⚠️ Error en typing: ${error.message}`);
    }
}

// ============================================
// ENVIAR MENSAJE A GRUPO (CON LINK PREVIEW FORZADO)
// ============================================
async function enviarMensaje(sock, id_grupo, mensaje) {
    try {
        if (!id_grupo || !id_grupo.includes('@g.us')) {
            return 'ERROR: ID inválido';
        }
        
        // Extraer URLs del mensaje
        const urls = mensaje.match(/https?:\/\/[^\s]+/g) || [];
        
        // Configurar opciones de link preview
        const opciones = { text: mensaje };
        
        // Si hay URLs, forzar preview
        if (urls.length > 0) {
            opciones.linkPreview = {
                title: '', // Se genera automático
                description: '',
                canonicalUrl: urls[0], // Usar la primera URL encontrada
                matchedText: urls[0]
            };
            guardarLogLocal(`   🔗 Preview para: ${urls[0]}`);
        }
        
        // Enviar mensaje con preview
        await sock.sendMessage(id_grupo, opciones);
        
        return 'ENVIADO';
    } catch (error) {
        return 'ERROR: ' + error.message.substring(0, 50);
    }
}

// ============================================
// OBTENER DELAY ALEATORIO
// ============================================
function obtenerDelayAleatorio() {
    const min = CONFIG.tiempo_entre_mensajes_min || 2;
    const max = CONFIG.tiempo_entre_mensajes_max || 5;
    const delay = Math.floor(Math.random() * (max - min + 1) + min);
    return delay; // Devolver en segundos
}

// ============================================
// VERIFICAR MENSAJES PENDIENTES POR PESTAÑA
// ============================================
async function verificarMensajesLocales(sock) {
    try {
        const agenda = cargarAgendaLocal();
        
        if (!agenda.grupos || agenda.grupos.length === 0) {
            return;
        }

        const ahora = new Date();
        const horaActual = ahora.getHours().toString().padStart(2,'0') + ':' + 
                          ahora.getMinutes().toString().padStart(2,'0');
        const diaSemana = ['D','L','M','MI','J','V','S'][ahora.getDay()];

        // Buscar pestañas cuyo horario rector coincida con la hora actual
        const pestanasAHora = [];
        
        Object.keys(agenda.pestanas || {}).forEach(nombrePestana => {
            const pestana = agenda.pestanas[nombrePestana];
            if (pestana.horario === horaActual) {
                pestanasAHora.push({
                    nombre: nombrePestana,
                    horario: pestana.horario,
                    grupos: pestana.grupos.filter(g => g.activo === 'SI')
                });
            }
        });

        if (pestanasAHora.length === 0) {
            return;
        }

        // Procesar cada pestaña
        for (const pestana of pestanasAHora) {
            guardarLogLocal(`📊 Pestaña "${pestana.nombre}" - Enviando ${pestana.grupos.length} mensajes (horario: ${pestana.horario})`);

            for (const grupo of pestana.grupos) {
                // Verificar días de la semana
                const diasPermitidos = grupo.dias ? grupo.dias.split(',').map(d => d.trim()) : [];
                if (diasPermitidos.length > 0 && !diasPermitidos.includes(diaSemana)) {
                    guardarLogLocal(`   ⏭️  ${grupo.nombre || grupo.id} - no corresponde hoy (días: ${grupo.dias})`);
                    continue;
                }

                guardarLogLocal(`   📤 Enviando a: ${grupo.nombre || grupo.id}`);
                
                // Obtener delay para este mensaje
                const delaySegundos = obtenerDelayAleatorio();
                
                // SIMULAR TYPING durante casi todo el delay
                await simularTyping(sock, grupo.id, delaySegundos * 0.8); // 80% del delay
                
                // Enviar mensaje
                const estado = await enviarMensaje(sock, grupo.id, grupo.mensaje);
                
                // Esperar el resto del delay después del envío
                const restante = delaySegundos * 0.2 * 1000;
                await new Promise(resolve => setTimeout(resolve, restante));
                
                guardarLogLocal(`      Resultado: ${estado}`);
            }
            
            guardarLogLocal(`✅ Pestaña "${pestana.nombre}" completada`);
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
    console.log('🤖 BOT WHATSAPP - MÚLTIPLES PESTAÑAS');
    console.log('====================================\n');
    console.log('⏰ Actualización de agenda: 6:00 AM y 6:00 PM');
    console.log('✍️  Typing adaptativo activado');
    console.log('🔗 Link Previews forzados');
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
                if (agenda.grupos.length === 0) {
                    guardarLogLocal('📥 Primera ejecución - descargando agenda completa...');
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
                
                // Solo responder a mensajes PRIVADOS
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
                    
                    if (cmd === 'status' || cmd === 'estado') {
                        const agenda = cargarAgendaLocal();
                        const total = agenda.grupos?.length || 0;
                        const pestanas = Object.keys(agenda.pestanas || {}).length;
                        const activos = agenda.grupos?.filter(g => g.activo === 'SI').length || 0;
                        
                        let mensaje = `📊 *ESTADO DEL BOT*\n\n` +
                                      `📅 Última actualización: ${agenda.ultima_actualizacion || 'N/A'}\n` +
                                      `📋 Grupos totales: ${total}\n` +
                                      `✅ Grupos activos: ${activos}\n` +
                                      `📌 Pestañas: ${pestanas}\n` +
                                      `⏱️  Delay: ${CONFIG.tiempo_entre_mensajes_min}-${CONFIG.tiempo_entre_mensajes_max} seg\n` +
                                      `✍️  Typing adaptativo: activado\n` +
                                      `🔗 Link Previews: forzados\n` +
                                      `⏰ Próxima actualización: 6am/6pm`;
                        
                        await sock.sendMessage(remitente, { text: mensaje });
                    }
                }
            }
        });

        console.log('\n📝 Comandos disponibles en WhatsApp:');
        console.log('   - "actualizar" - Forzar descarga de agenda');
        console.log('   - "status" - Ver estado del bot');
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
console.log('🚀 SISTEMA DE MENSAJES MULTI-PESTAÑA');
console.log('====================================\n');

iniciarWhatsApp().catch(error => {
    console.log('❌ Error fatal:', error);
});
