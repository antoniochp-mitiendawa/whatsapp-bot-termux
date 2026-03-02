// ============================================
// BOT DE WHATSAPP PARA TERMUX
// Versión: 13.1 - Corregido para Baileys v6.7.19
// Características:
// - Conexión con código de emparejamiento
// - Typing adaptativo (80% del delay)
// - Link Previews con getUrlInfo() y delay post-procesamiento
// - Alta calidad de previsualización
// - Múltiples pestañas GRUPOS*
// - Cada pestaña tiene su propio horario rector
// - Delays aleatorios con formato "min-max" desde CONFIG
// - Descarga completa de agenda
// - Comandos "actualizar", "status" y "listagrupos" desde WhatsApp
// - Cache de grupos para mejor rendimiento
// - Logs solo locales
// ============================================

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, getUrlInfo } = require('@whiskeysockets/baileys');
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
    tiempo_entre_mensajes_min: 1,
    tiempo_entre_mensajes_max: 5,
    tiempo_typing: 3000,
    carpeta_logs: './logs',
    numero_telefono: '',
    horarios_actualizacion: ['06:00', '18:00']
};

// Crear carpetas necesarias
if (!fs.existsSync(CONFIG.carpeta_logs)) {
    fs.mkdirSync(CONFIG.carpeta_logs);
}
if (!fs.existsSync(CONFIG.carpeta_sesion)) {
    fs.mkdirSync(CONFIG.carpeta_sesion);
}

// Cache simple para grupos (recomendado por documentación Baileys)
const groupCache = new Map();

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
        
        if (data.config) {
            const delayStr = data.config.TIEMPO_ENTRE_MENSAJES;
            if (delayStr && typeof delayStr === 'string' && delayStr.includes('-')) {
                const partes = delayStr.split('-').map(p => parseInt(p.trim()));
                if (partes.length === 2 && !isNaN(partes[0]) && !isNaN(partes[1])) {
                    CONFIG.tiempo_entre_mensajes_min = partes[0];
                    CONFIG.tiempo_entre_mensajes_max = partes[1];
                    console.log(`⏱️  Delay configurado: ${CONFIG.tiempo_entre_mensajes_min}-${CONFIG.tiempo_entre_mensajes_max} segundos (formato min-max)`);
                } else {
                    console.log(`⚠️  Formato de delay inválido: ${delayStr}, usando valores por defecto`);
                }
            } else if (delayStr && !isNaN(parseInt(delayStr))) {
                const valor = parseInt(delayStr);
                CONFIG.tiempo_entre_mensajes_min = 1;
                CONFIG.tiempo_entre_mensajes_max = valor;
                console.log(`⏱️  Delay configurado: ${CONFIG.tiempo_entre_mensajes_min}-${CONFIG.tiempo_entre_mensajes_max} segundos (convertido desde valor único)`);
            }
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
        
        if (agenda.config) {
            CONFIG.tiempo_entre_mensajes_min = agenda.config.min || 1;
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
// FUNCIÓN PARA SIMULAR QUE ESTÁ ESCRIBIENDO
// ============================================
async function simularTyping(sock, id_destino, duracion) {
    try {
        await sock.sendPresenceUpdate('composing', id_destino);
        guardarLogLocal(`   ✍️ Typing por ${duracion} segundos...`);
        
        await new Promise(resolve => setTimeout(resolve, duracion * 1000));
        
        await sock.sendPresenceUpdate('paused', id_destino);
        await new Promise(resolve => setTimeout(resolve, 500));
        
    } catch (error) {
        guardarLogLocal(`   ⚠️ Error en typing: ${error.message}`);
    }
}

// ============================================
// FUNCIÓN PARA GENERAR LINK PREVIEW
// ============================================
async function generarLinkPreview(url) {
    try {
        const linkPreview = await getUrlInfo(url, {
            thumbnailWidth: 1200,
            fetchOpts: {
                timeout: 8000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            },
            followRedirects: true
        });
        return linkPreview;
    } catch (error) {
        guardarLogLocal(`   ⚠️ Error generando preview: ${error.message}`);
        return null;
    }
}

// ============================================
// ENVIAR MENSAJE A GRUPO
// ============================================
async function enviarMensaje(sock, id_grupo, mensaje) {
    try {
        if (!id_grupo || !id_grupo.includes('@g.us')) {
            return 'ERROR: ID inválido';
        }
        
        const urls = mensaje.match(/(?:https?:\/\/|wa\.me\/)[^\s]+/g) || [];
        
        const opciones = { text: mensaje };
        
        if (urls.length > 0) {
            guardarLogLocal(`   🔗 Generando preview para: ${urls[0]}`);
            
            const linkPreview = await generarLinkPreview(urls[0]);
            
            if (linkPreview) {
                opciones.linkPreview = linkPreview;
                guardarLogLocal(`   ✅ Preview generado: ${linkPreview.title || 'Sin título'}`);
                guardarLogLocal(`   ⏱️  Esperando 1.5s para optimizar preview en Android...`);
                await new Promise(resolve => setTimeout(resolve, 1500));
            } else {
                opciones.linkPreview = {
                    matchedText: urls[0]
                };
            }
        }
        
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
    const min = CONFIG.tiempo_entre_mensajes_min || 1;
    const max = CONFIG.tiempo_entre_mensajes_max || 5;
    const delay = Math.floor(Math.random() * (max - min + 1) + min);
    return delay;
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

        for (const pestana of pestanasAHora) {
            guardarLogLocal(`📊 Pestaña "${pestana.nombre}" - Enviando ${pestana.grupos.length} mensajes (horario: ${pestana.horario})`);

            for (const grupo of pestana.grupos) {
                const diasPermitidos = grupo.dias ? grupo.dias.split(',').map(d => d.trim()) : [];
                if (diasPermitidos.length > 0 && !diasPermitidos.includes(diaSemana)) {
                    guardarLogLocal(`   ⏭️  ${grupo.nombre || grupo.id} - no corresponde hoy (días: ${grupo.dias})`);
                    continue;
                }

                guardarLogLocal(`   📤 Enviando a: ${grupo.nombre || grupo.id}`);
                
                const delaySegundos = obtenerDelayAleatorio();
                
                await simularTyping(sock, grupo.id, delaySegundos * 0.8);
                
                const estado = await enviarMensaje(sock, grupo.id, grupo.mensaje);
                
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
// FUNCIÓN CORREGIDA PARA BAILEYS v6.7.19
// ============================================
async function obtenerGruposWhatsApp(sock) {
    try {
        guardarLogLocal('🔍 Obteniendo grupos de WhatsApp...');
        
        if (!sock || !sock.user) {
            guardarLogLocal('❌ Socket no conectado');
            return [];
        }
        
        guardarLogLocal('   Consultando grupos con API v6.7.19...');
        
        const gruposDict = await sock.groupFetchAllParticipatingGroups();
        
        if (!gruposDict || typeof gruposDict !== 'object') {
            guardarLogLocal('⚠️ No se obtuvieron grupos o formato inesperado');
            return [];
        }
        
        const listaGrupos = [];
        
        for (const [groupId, groupInfo] of Object.entries(gruposDict)) {
            listaGrupos.push({
                id: groupId,
                nombre: groupInfo.subject || 'Sin nombre'
            });
            
            if (typeof groupCache !== 'undefined' && groupCache) {
                groupCache.set(groupId, groupInfo);
            }
        }
        
        guardarLogLocal(`✅ ${listaGrupos.length} grupos encontrados correctamente`);
        return listaGrupos;
        
    } catch (error) {
        guardarLogLocal(`❌ Error obteniendo grupos: ${error.message}`);
        
        try {
            guardarLogLocal('   Intentando método alternativo con groupMetadata...');
            
            const groups = await sock.groupMetadata('');
            
            if (groups && Array.isArray(groups) && groups.length > 0) {
                const listaGrupos = groups.map(g => ({
                    id: g.id,
                    nombre: g.subject || 'Sin nombre'
                }));
                guardarLogLocal(`✅ ${listaGrupos.length} grupos encontrados (método alternativo)`);
                return listaGrupos;
            }
        } catch (altError) {
            guardarLogLocal(`   ❌ Método alternativo falló: ${altError.message}`);
        }
        
        return [];
    }
}

// ============================================
// FUNCIÓN PARA ENVIAR GRUPOS A GOOGLE SHEETS
// ============================================
async function enviarGruposASheets(url_sheets, grupos) {
    try {
        guardarLogLocal('📤 Enviando grupos a Google Sheets...');
        
        const respuesta = await axios.post(url_sheets, {
            grupos: grupos
        });
        
        if (respuesta.data && respuesta.data.success) {
            guardarLogLocal(`✅ ${respuesta.data.mensaje}`);
            return true;
        } else {
            guardarLogLocal(`⚠️ Respuesta de Sheets: ${JSON.stringify(respuesta.data)}`);
            return false;
        }
    } catch (error) {
        guardarLogLocal(`❌ Error enviando a Sheets: ${error.message}`);
        return false;
    }
}

// ============================================
// FUNCIÓN PARA GENERAR Y ENVIAR CSV
// ============================================
async function enviarCSVporWhatsApp(sock, remitente, grupos) {
    try {
        let csvContent = 'ID_GRUPO,NOMBRE_GRUPO\n';
        grupos.forEach(g => {
            const nombreEscapado = g.nombre.includes(',') ? `"${g.nombre}"` : g.nombre;
            csvContent += `${g.id},${nombreEscapado}\n`;
        });
        
        const csvPath = path.join(CONFIG.carpeta_logs, 'grupos_exportados.csv');
        fs.writeFileSync(csvPath, csvContent);
        
        await sock.sendMessage(remitente, {
            document: fs.readFileSync(csvPath),
            fileName: 'grupos_exportados.csv',
            mimetype: 'text/csv',
            caption: '📎 Archivo con la lista de grupos'
        });
        
        guardarLogLocal('✅ CSV enviado por WhatsApp');
        return true;
    } catch (error) {
        guardarLogLocal(`❌ Error enviando CSV: ${error.message}`);
        return false;
    }
}

// ============================================
// INICIAR CONEXIÓN WHATSAPP
// ============================================
async function iniciarWhatsApp() {
    console.log('====================================');
    console.log('🤖 BOT WHATSAPP - VERSIÓN 13.1 (GRUPOS CORREGIDOS)');
    console.log('====================================\n');
    console.log('⏰ Actualización de agenda: 6:00 AM y 6:00 PM');
    console.log('✍️  Typing adaptativo activado');
    console.log('🔗 Link Previews optimizados para Android');
    console.log('📝 Logs locales (carpeta logs/)\n');
    console.log('🆕 Comando: "listagrupos" - Exporta todos los grupos a CSV + Sheets\n');

    const url_sheets = leerURL();
    if (!url_sheets) {
        console.log('❌ No hay URL');
        return;
    }

    try {
        const { version, isLatest } = await fetchLatestBaileysVersion();
        console.log(`📦 Baileys versión: ${version.join('.')} ${isLatest ? '(última)' : ''}`);
        
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
            shouldSyncHistoryMessage: () => false,
            generateHighQualityLinkPreview: true,
            cachedGroupMetadata: async (jid) => groupCache.get(jid)
        });

        sock.ev.on('groups.update', async (updates) => {
            for (const update of updates) {
                try {
                    const metadata = await sock.groupMetadata(update.id);
                    groupCache.set(update.id, metadata);
                } catch (e) {}
            }
        });

        sock.ev.on('group-participants.update', async (update) => {
            try {
                const metadata = await sock.groupMetadata(update.id);
                groupCache.set(update.id, metadata);
            } catch (e) {}
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

        CONFIG.horarios_actualizacion.forEach(hora => {
            const [horas, minutos] = hora.split(':');
            const expresionCron = `${minutos} ${horas} * * *`;
            
            cron.schedule(expresionCron, async () => {
                guardarLogLocal(`⏰ Actualización programada de agenda (${hora})`);
                await actualizarAgenda(sock, url_sheets, 'programado');
            });
        });

        cron.schedule('* * * * *', async () => {
            await verificarMensajesLocales(sock);
        });

        sock.ev.on('messages.upsert', async (m) => {
            const mensaje = m.messages[0];
            if (mensaje.key && !mensaje.key.fromMe && mensaje.message) {
                const remitente = mensaje.key.remoteJid;
                const texto = mensaje.message.conversation || 
                             mensaje.message.extendedTextMessage?.text || '';
                
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
                                      `🔗 Link Previews: OPTIMIZADOS\n` +
                                      `📤 Comando listagrupos: disponible\n` +
                                      `⏰ Próxima actualización: 6am/6pm`;
                        
                        await sock.sendMessage(remitente, { text: mensaje });
                    }
                    
                    if (cmd === 'listagrupos' || cmd === 'grupos') {
                        guardarLogLocal(`📩 Comando remoto de ${remitente.split('@')[0]}: listagrupos`);
                        
                        await sock.sendMessage(remitente, { text: '🔄 Procesando lista de grupos...' });
                        
                        const grupos = await obtenerGruposWhatsApp(sock);
                        
                        if (grupos.length === 0) {
                            await sock.sendMessage(remitente, { text: '❌ No se encontraron grupos. Verifica que el bot esté en al menos un grupo.' });
                            return;
                        }
                        
                        const sheetsResult = await enviarGruposASheets(url_sheets, grupos);
                        
                        const csvResult = await enviarCSVporWhatsApp(sock, remitente, grupos);
                        
                        let confirmacion = '✅ *PROCESO COMPLETADO*\n\n';
                        confirmacion += `📊 Total de grupos: ${grupos.length}\n`;
                        confirmacion += sheetsResult ? '✅ Guardado en Google Sheets (LISTA_GRUPOS)\n' : '❌ Error en Google Sheets\n';
                        confirmacion += csvResult ? '✅ CSV enviado por WhatsApp\n' : '❌ Error enviando CSV\n';
                        
                        await sock.sendMessage(remitente, { text: confirmacion });
                    }
                }
            }
        });

        console.log('\n📝 Comandos disponibles en WhatsApp:');
        console.log('   - "actualizar" - Forzar descarga de agenda');
        console.log('   - "status" - Ver estado del bot');
        console.log('   - "listagrupos" - Exportar grupos a CSV + Sheets');
        console.log('   - Presiona CTRL+C para salir\n');

    } catch (error) {
        guardarLogLocal(`❌ ERROR FATAL: ${error.message}`);
        setTimeout(() => iniciarWhatsApp(), 30000);
    }
}

process.on('SIGINT', () => {
    console.log('\n\n👋 Cerrando bot...');
    guardarLogLocal('BOT CERRADO MANUALMENTE');
    process.exit(0);
});

console.log('====================================');
console.log('🚀 SISTEMA DE MENSAJES MULTI-PESTAÑA');
console.log('====================================\n');

iniciarWhatsApp().catch(error => {
    console.log('❌ Error fatal:', error);
});
