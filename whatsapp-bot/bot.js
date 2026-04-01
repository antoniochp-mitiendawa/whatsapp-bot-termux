// ============================================
// BOT DE WHATSAPP PARA TERMUX
// Versión: 44.0 - INTERACCIONES + REACCIONES + MENCIONES
// Versión: 45.0 - INMEDIATEZ + INTERACCIONES + REACCIONES + MENCIONES
// + MEJORA 1: Keep-Alive cada 25 segundos
// + MEJORA 2: Ignorar mensajes de grupos (sin mención)
// + MEJORA 3: PROCESAMIENTO INMEDIATO DE MENSAJES
//   - SetImmediate para mensajes interactivos
//   - Optimización de extracción de texto
//   - Priorización de eventos
// + NUEVO: Sistema de SpinTex y SpinEmoji (CORREGIDO)
// + NUEVO: Tabla de correspondencia producto-archivo
// + VERSIÓN 42.0: Modo Ahorro de Batería (SOLO horarios programados con setTimeout)
// + MEJORA: Al actualizar, reprograma todos los envíos
// + MEJORA: 1 cron job a las 6am solo para actualizar agenda
// + VERSIÓN 43.0: Múltiples archivos por producto
// + VERSIÓN 44.0: Interacciones con menciones, respuestas y reacciones
//   - Detecta menciones al bot en grupos (@bot)
//   - Detecta respuestas a mensajes del bot (quotedMessage)
//   - Extrae producto del mensaje original
//   - Clasifica preguntas (respondibles vs no respondibles)
//   - Responde automáticamente a preguntas de precio/info
//   - Alerta al admin con enlace wa.me para preguntas no respondibles
//   - Detecta reacciones a mensajes del bot (👍❤️😮🙏😂)
//   - Responde en el grupo con texto personalizado por reacción
//   - Usa sinónimos para variedad en respuestas
// + VERSIÓN 45.0: Optimización de inmediatez y respuestas a mensajes deslizados
//   - Procesamiento prioritario de mensajes entrantes
//   - Simulación de typing antes de respuestas
//   - Fallback para mensajes citados no encontrados en store
//   - Mejora en detección de menciones en todo tipo de mensajes
//   - Clasificación ampliada de consultas
// ============================================

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, getUrlInfo, Browsers } = require('@whiskeysockets/baileys');
@@ -131,10 +132,13 @@ const CONFIG = {
]
},
palabras_clave_respondibles: {
        precio: ["precio", "cuesta", "valor", "$$", "💰", "💵", "costó", "precio?"],
        info: ["info", "información", "características", "descripción", "qué es", "detalles"],
        generica: ["más", "info", "información", "quiero saber", "dime"]
    }
        precio: ["precio", "cuesta", "valor", "$$", "💰", "💵", "costó", "precio?", "cuánto", "cuanto", "costo", "precio", "vale", "valor?"],
        info: ["info", "información", "características", "descripción", "qué es", "detalles", "descripcion", "caracteristicas", "como es", "que tiene"],
        generica: ["más", "info", "información", "quiero saber", "dime", "mas", "informacion", "saber", "conocer", "interesa", "me interesa"]
    },
    // NUEVA CONFIGURACIÓN PARA INMEDIATEZ
    delay_respuesta_min: 1, // segundos mínimos antes de responder (simular typing)
    delay_respuesta_max: 3  // segundos máximos antes de responder
};

// ============================================
@@ -194,6 +198,9 @@ let imagenesUsadasEnLote = new Set();
let productosCache = [];
let ultimaActualizacionProductos = 0;

// Variable para controlar mensajes en procesamiento (evitar doble respuesta)
const mensajesEnProcesamiento = new Set();

// ============================================
// FUNCIÓN PARA OBTENER METADATOS DE GRUPO CON CACHÉ
// ============================================
@@ -673,7 +680,7 @@ function guardarLogLocal(texto) {

fs.appendFileSync(logFile, linea + '\n');

    if (texto.includes('📩 Mensaje recibido')) {
    if (texto.includes('📩 MENSAJE RECIBIDO')) {
console.log('\x1b[32m%s\x1b[0m', `📩 ${texto}`);
} else if (texto.includes('⚡ PRIORITARIO')) {
console.log('\x1b[33m%s\x1b[0m', `⚡ ${texto}`);
@@ -940,6 +947,7 @@ function buscarArchivosPorProducto(nombreProducto) {
// NUEVA FUNCIÓN: Extraer nombre del producto del texto (CORREGIDA)
// ============================================
function extraerNombreProducto(texto) {
    if (!texto) return null;
// Buscar el ÚLTIMO par de asteriscos en el mensaje (que es donde está el producto)
const matches = [...texto.matchAll(/\*([^*]+)\*/g)];
if (matches.length > 0) {
@@ -1556,7 +1564,7 @@ async function enviarCSVporWhatsApp(sock, remitente, grupos) {
}

// ============================================
// NUEVAS FUNCIONES PARA INTERACCIONES
// NUEVAS FUNCIONES PARA INTERACCIONES (OPTIMIZADAS)
// ============================================

// Función para obtener un texto aleatorio de un array de sinónimos
@@ -1566,34 +1574,60 @@ function obtenerTextoAleatorio(arrayTextos) {
return arrayTextos[indice];
}

// Función para obtener el producto desde un mensaje citado
// Función optimizada para extraer texto de cualquier tipo de mensaje
function extraerTextoDeMensaje(mensaje) {
    if (!mensaje) return '';
    
    // Priorizar los tipos más comunes primero (optimización)
    if (mensaje.conversation) return mensaje.conversation;
    if (mensaje.extendedTextMessage?.text) return mensaje.extendedTextMessage.text;
    if (mensaje.imageMessage?.caption) return mensaje.imageMessage.caption;
    if (mensaje.videoMessage?.caption) return mensaje.videoMessage.caption;
    if (mensaje.documentMessage?.caption) return mensaje.documentMessage.caption;
    if (mensaje.audioMessage?.caption) return mensaje.audioMessage?.caption || '';
    
    return '';
}

// Función optimizada para verificar si el bot es mencionado
function botEsMencionado(mensaje, botId) {
    if (!mensaje || !botId) return false;
    
    // Verificar en extendedTextMessage
    const mentionedJid = mensaje?.extendedTextMessage?.contextInfo?.mentionedJid;
    if (mentionedJid && mentionedJid.includes(botId)) return true;
    
    // Verificar en mensajes con caption
    if (mensaje?.imageMessage?.contextInfo?.mentionedJid?.includes(botId)) return true;
    if (mensaje?.videoMessage?.contextInfo?.mentionedJid?.includes(botId)) return true;
    if (mensaje?.documentMessage?.contextInfo?.mentionedJid?.includes(botId)) return true;
    
    return false;
}

// Función optimizada para obtener producto desde mensaje citado (con fallback)
async function obtenerProductoDesdeMensajeCitado(sock, mensaje) {
try {
        if (!mensaje.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
            return null;
        }
        const contextInfo = mensaje.message?.extendedTextMessage?.contextInfo || 
                           mensaje.message?.imageMessage?.contextInfo ||
                           mensaje.message?.videoMessage?.contextInfo;

        const quotedMsg = mensaje.message.extendedTextMessage.contextInfo.quotedMessage;
        let textoOriginal = '';
        if (!contextInfo?.quotedMessage) return null;

        if (quotedMsg.conversation) {
            textoOriginal = quotedMsg.conversation;
        } else if (quotedMsg.extendedTextMessage?.text) {
            textoOriginal = quotedMsg.extendedTextMessage.text;
        } else if (quotedMsg.imageMessage?.caption) {
            textoOriginal = quotedMsg.imageMessage.caption;
        } else if (quotedMsg.videoMessage?.caption) {
            textoOriginal = quotedMsg.videoMessage.caption;
        }
        const quotedMsg = contextInfo.quotedMessage;
        const textoOriginal = extraerTextoDeMensaje(quotedMsg);
        
        if (!textoOriginal) return null;

return extraerNombreProducto(textoOriginal);
        
} catch (error) {
guardarLogLocal(`   ⚠️ Error obteniendo producto de mensaje citado: ${error.message}`);
return null;
}
}

// Función para clasificar la consulta del usuario
// Función para clasificar la consulta del usuario (ampliada)
function clasificarConsulta(texto) {
const textoLower = texto.toLowerCase();

@@ -1684,7 +1718,7 @@ ${datosAlerta.enlace}
}
}

// Función para procesar reacciones a mensajes
// Función para procesar reacciones a mensajes (optimizada)
async function procesarReaccion(sock, mensaje) {
try {
// Verificar si es una reacción
@@ -1701,29 +1735,27 @@ async function procesarReaccion(sock, mensaje) {
const respuestasReaccion = CONFIG.respuestas_reacciones[emoji];
if (!respuestasReaccion) return false;

        // Obtener el mensaje original al que reaccionaron
        const mensajeOriginal = await store.loadMessage(keyOriginal.remoteJid, keyOriginal.id);
        if (!mensajeOriginal) return false;
        
        // Extraer producto del mensaje original
        // Intentar obtener el mensaje original del store
let textoOriginal = '';
        if (mensajeOriginal.message?.conversation) {
            textoOriginal = mensajeOriginal.message.conversation;
        } else if (mensajeOriginal.message?.extendedTextMessage?.text) {
            textoOriginal = mensajeOriginal.message.extendedTextMessage.text;
        } else if (mensajeOriginal.message?.imageMessage?.caption) {
            textoOriginal = mensajeOriginal.message.imageMessage.caption;
        } else if (mensajeOriginal.message?.videoMessage?.caption) {
            textoOriginal = mensajeOriginal.message.videoMessage.caption;
        try {
            const mensajeOriginal = await store.loadMessage(keyOriginal.remoteJid, keyOriginal.id);
            if (mensajeOriginal) {
                textoOriginal = extraerTextoDeMensaje(mensajeOriginal.message);
            }
        } catch (e) {
            // Si falla, continuamos sin el texto original
}

        const nombreProducto = extraerNombreProducto(textoOriginal);
        if (!nombreProducto) return false;
        const nombreProducto = extraerNombreProducto(textoOriginal) || 'producto';

// Seleccionar respuesta aleatoria
let respuesta = obtenerTextoAleatorio(respuestasReaccion);
respuesta = respuesta.replace('[PRODUCTO]', nombreProducto);

        // Simular typing antes de responder
        const delayTyping = Math.floor(Math.random() * (CONFIG.delay_respuesta_max - CONFIG.delay_respuesta_min + 1) + CONFIG.delay_respuesta_min);
        await simularTyping(sock, keyOriginal.remoteJid, delayTyping);
        
// Enviar respuesta en el mismo grupo
await sock.sendMessage(keyOriginal.remoteJid, { text: respuesta });
guardarLogLocal(`   ✅ Respuesta a reacción ${emoji} para producto: ${nombreProducto}`);
@@ -1796,7 +1828,7 @@ async function procesarComandoPrioritario(sock, cmd, remitente, url_sheets) {
// ============================================
async function iniciarWhatsApp() {
console.log('====================================');
    console.log('🤖 BOT WHATSAPP - VERSIÓN 44.0 (INTERACCIONES + REACCIONES + MENCIONES)');
    console.log('🤖 BOT WHATSAPP - VERSIÓN 45.0 (INMEDIATEZ + INTERACCIONES)');
console.log('====================================\n');
console.log('⏰ Actualización de agenda: 6:00 AM (solo 1 vez al día)');
console.log('✍️  Typing adaptativo activado');
@@ -1823,12 +1855,14 @@ async function iniciarWhatsApp() {
console.log('   - Mide el tiempo real de cada envío');
console.log('   - Ajusta la espera automáticamente');
console.log('   - No acumula retrasos en el día');
    console.log('💬 **NUEVO: SISTEMA DE INTERACCIONES**');
    console.log('💬 **SISTEMA DE INTERACCIONES OPTIMIZADO**');
    console.log('   - ✅ PROCESAMIENTO INMEDIATO de mensajes entrantes');
console.log('   - ✅ Detecta menciones al bot en grupos (@bot)');
console.log('   - ✅ Detecta respuestas a mensajes del bot');
console.log('   - ✅ Responde automáticamente a consultas de precio/info');
console.log('   - ✅ Alerta al admin con enlace wa.me para preguntas no respondibles');
console.log('   - ✅ Detecta reacciones (👍❤️😮🙏😂) y responde en el grupo');
    console.log('   - ✅ Simula typing antes de responder (1-3 segundos)');
console.log('   - ✅ Usa sinónimos para variedad en respuestas\n');

const url_sheets = leerURL();
@@ -1972,74 +2006,128 @@ async function iniciarWhatsApp() {
});

// ============================================
        // EVENTO DE MENSAJES (MODIFICADO CON NUEVAS FUNCIONALIDADES)
        // EVENTO DE MENSAJES (VERSIÓN 45.0 - OPTIMIZADA PARA INMEDIATEZ)
// ============================================
sock.ev.on('messages.upsert', async (m) => {
const mensaje = m.messages[0];

            if (!mensaje.key || mensaje.key.fromMe || !mensaje.message) {
                return;
            }
            // Filtros rápidos (optimizados)
            if (!mensaje.key || mensaje.key.fromMe || !mensaje.message) return;

const remitente = mensaje.key.remoteJid;
const esGrupo = remitente.includes('@g.us');
            const esPrivado = !esGrupo;
            const mensajeId = mensaje.key.id;

            // Evitar procesar el mismo mensaje múltiples veces
            if (mensajesEnProcesamiento.has(mensajeId)) return;
            mensajesEnProcesamiento.add(mensajeId);
            
            // Limpiar el set cada cierto tiempo para evitar crecimiento infinito
            setTimeout(() => mensajesEnProcesamiento.delete(mensajeId), 10000);

// ============================================
            // PROCESAR REACCIONES (para grupos y privado)
            // PRIORIDAD 1: PROCESAR REACCIONES INMEDIATAMENTE
// ============================================
if (mensaje.message?.reactionMessage) {
                await procesarReaccion(sock, mensaje);
                setImmediate(() => procesarReaccion(sock, mensaje));
return;
}

// ============================================
            // PARA GRUPOS: SOLO PROCESAR SI HAY MENCIÓN
            // PARA GRUPOS: VERIFICAR MENCIÓN (rápido)
// ============================================
if (esGrupo) {
                // Verificar si el bot es mencionado
                const mentionedJid = mensaje.message?.extendedTextMessage?.contextInfo?.mentionedJid;
                const botMentioned = mentionedJid && mentionedJid.includes(sock.user.id);
                
                if (!botMentioned) {
                    return; // Ignorar mensajes de grupo sin mención
                if (!botEsMencionado(mensaje.message, sock.user.id)) {
                    mensajesEnProcesamiento.delete(mensajeId);
                    return;
}
}

            // Obtener texto del mensaje
            const texto = mensaje.message.conversation || 
                         mensaje.message.extendedTextMessage?.text || 
                         mensaje.message.imageMessage?.caption ||
                         mensaje.message.videoMessage?.caption || '';
            
            // ============================================
            // EXTRACCIÓN RÁPIDA DE TEXTO
            // ============================================
            const texto = extraerTextoDeMensaje(mensaje.message);
if (!texto || texto.trim() === '') {
                mensajesEnProcesamiento.delete(mensajeId);
return;
}

            // ============================================
            // LOG INMEDIATO (para depuración)
            // ============================================
            console.log('\n═══════════════════════════════════════════════');
            console.log(`📩 MENSAJE RECIBIDO de ${remitente.split('@')[0]}: "${texto.substring(0, 50)}${texto.length > 50 ? '...' : ''}"`);
            console.log('═══════════════════════════════════════════════\n');
            
            guardarLogLocal(`📩 Mensaje de ${remitente.split('@')[0]}: "${texto.substring(0, 100)}"`);

// ============================================
// COMANDOS PRIORITARIOS (solo en privado)
// ============================================
            if (esPrivado) {
            if (!esGrupo) {
const cmd = texto.toLowerCase().trim();

                console.log('\n═══════════════════════════════════════════════');
                console.log(`📩 MENSAJE RECIBIDO de ${remitente.split('@')[0]}: "${cmd}"`);
                console.log('═══════════════════════════════════════════════\n');
                
                guardarLogLocal(`📩 Mensaje de ${remitente.split('@')[0]}: "${cmd}"`);
                
if (cmd === 'actualizar' || cmd === 'update' || cmd === 'listagrupos' || cmd === 'grupos') {
setImmediate(() => {
procesarComandoPrioritario(sock, cmd, remitente, url_sheets);
});
                    mensajesEnProcesamiento.delete(mensajeId);
return;
}

else if (cmd === 'status' || cmd === 'estado') {
                    if (procesandoComandoPrioritario) {
                        guardarLogLocal(`   ⏳ Comando status en espera (prioritario en ejecución)`);
                        setTimeout(async () => {
                            guardarLogLocal(`   Procesando comando: status (diferido)`);
                    setImmediate(async () => {
                        if (procesandoComandoPrioritario) {
                            guardarLogLocal(`   ⏳ Comando status en espera (prioritario en ejecución)`);
                            setTimeout(async () => {
                                guardarLogLocal(`   Procesando comando: status (diferido)`);
                                const agenda = cargarAgendaLocal();
                                const total = agenda.grupos?.length || 0;
                                const pestanas = Object.keys(agenda.pestanas || {}).length;
                                const activos = agenda.grupos?.filter(g => g.activo === 'SI').length || 0;
                                
                                // Obtener horarios programados para mostrar
                                const horarios = new Set();
                                if (agenda.pestanas) {
                                    Object.values(agenda.pestanas).forEach(p => {
                                        if (p.horario) horarios.add(p.horario);
                                    });
                                }
                                
                                let mensaje = `📊 *ESTADO DEL BOT - VERSIÓN 45.0*\n\n` +
                                              `⏰ MODO: setTimeout + Delay inteligente\n` +
                                              `📅 Última actualización: ${agenda.ultima_actualizacion || 'N/A'}\n` +
                                              `📋 Grupos totales: ${total}\n` +
                                              `✅ Grupos activos: ${activos}\n` +
                                              `📌 Pestañas: ${pestanas}\n` +
                                              `⏱️  Horarios programados: ${Array.from(horarios).join(', ') || 'Ninguno'}\n` +
                                              `⏱️  Delay mensajes: ${CONFIG.tiempo_entre_mensajes_min}-${CONFIG.tiempo_entre_mensajes_max} seg (inteligente)\n` +
                                              `📦 Múltiples archivos: ACTIVADO\n` +
                                              `⏱️ Delay entre archivos: ${CONFIG.delay_entre_archivos}s\n` +
                                              `💬 Interacciones: ACTIVADO (inmediatez optimizada)\n` +
                                              `✍️  Typing adaptativo: activado\n` +
                                              `🔗 Link Previews: CON IMAGEN (caché local)\n` +
                                              `📚 Data Store: ACTIVADO (extracción local)\n` +
                                              `🔄 Actualización automática: 6:00 AM\n` +
                                              `🏷️  Nombres de grupos: CACHÉ + store + consulta directa\n` +
                                              `🧹 Limpieza store: automática (3 AM) - ${CONFIG.dias_retencion_store} días\n` +
                                              `📁 Carpeta multimedia: ${CONFIG.carpeta_multimedia}\n` +
                                              `👥  Grupos completos: espera 30 segundos en "listagrupos"\n` +
                                              `⚡  Latencia: INMEDIATEZ OPTIMIZADA\n` +
                                              `⚡⚡ Comandos prioritarios: ACTIVADOS\n` +
                                              `🔄 Consulta masiva: RESTAURADA\n` +
                                              `🗑️  Limpieza automática: activada\n` +
                                              `📦 Tabla producto-archivo: MÚLTIPLES ARCHIVOS\n` +
                                              `🌐 Browser: ${existeSesion ? 'macOS/Desktop' : 'Ubuntu/Chrome'}\n` +
                                              `📤 Comando listagrupos: disponible (con caché)\n` +
                                              `🎲 SpinTex/SpinEmoji: CORREGIDO PARA BAILEYS\n` +
                                              `🔋 AHORRO DE BATERÍA: setTimeout ACTIVADO (0 verificaciones por minuto)`;
                                
                                await sock.sendMessage(remitente, { text: mensaje });
                                mensajesEnProcesamiento.delete(mensajeId);
                            }, 1000);
                        } else {
                            guardarLogLocal(`   Procesando comando: status`);
const agenda = cargarAgendaLocal();
const total = agenda.grupos?.length || 0;
const pestanas = Object.keys(agenda.pestanas || {}).length;
@@ -2053,7 +2141,7 @@ async function iniciarWhatsApp() {
});
}

                            let mensaje = `📊 *ESTADO DEL BOT - VERSIÓN 44.0*\n\n` +
                            let mensaje = `📊 *ESTADO DEL BOT - VERSIÓN 45.0*\n\n` +
`⏰ MODO: setTimeout + Delay inteligente\n` +
`📅 Última actualización: ${agenda.ultima_actualizacion || 'N/A'}\n` +
`📋 Grupos totales: ${total}\n` +
@@ -2063,7 +2151,7 @@ async function iniciarWhatsApp() {
`⏱️  Delay mensajes: ${CONFIG.tiempo_entre_mensajes_min}-${CONFIG.tiempo_entre_mensajes_max} seg (inteligente)\n` +
`📦 Múltiples archivos: ACTIVADO\n` +
`⏱️ Delay entre archivos: ${CONFIG.delay_entre_archivos}s\n` +
                                          `💬 Interacciones: ACTIVADO (menciones, respuestas, reacciones)\n` +
                                          `💬 Interacciones: ACTIVADO (inmediatez optimizada)\n` +
`✍️  Typing adaptativo: activado\n` +
`🔗 Link Previews: CON IMAGEN (caché local)\n` +
`📚 Data Store: ACTIVADO (extracción local)\n` +
@@ -2072,7 +2160,7 @@ async function iniciarWhatsApp() {
`🧹 Limpieza store: automática (3 AM) - ${CONFIG.dias_retencion_store} días\n` +
`📁 Carpeta multimedia: ${CONFIG.carpeta_multimedia}\n` +
`👥  Grupos completos: espera 30 segundos en "listagrupos"\n` +
                                          `⚡  Latencia: CORREGIDA (mensajes inmediatos)\n` +
                                          `⚡  Latencia: INMEDIATEZ OPTIMIZADA\n` +
`⚡⚡ Comandos prioritarios: ACTIVADOS\n` +
`🔄 Consulta masiva: RESTAURADA\n` +
`🗑️  Limpieza automática: activada\n` +
@@ -2083,99 +2171,72 @@ async function iniciarWhatsApp() {
`🔋 AHORRO DE BATERÍA: setTimeout ACTIVADO (0 verificaciones por minuto)`;

await sock.sendMessage(remitente, { text: mensaje });
                        }, 1000);
                    } else {
                        guardarLogLocal(`   Procesando comando: status`);
                        const agenda = cargarAgendaLocal();
                        const total = agenda.grupos?.length || 0;
                        const pestanas = Object.keys(agenda.pestanas || {}).length;
                        const activos = agenda.grupos?.filter(g => g.activo === 'SI').length || 0;
                        
                        // Obtener horarios programados para mostrar
                        const horarios = new Set();
                        if (agenda.pestanas) {
                            Object.values(agenda.pestanas).forEach(p => {
                                if (p.horario) horarios.add(p.horario);
                            });
                            mensajesEnProcesamiento.delete(mensajeId);
}
                        
                        let mensaje = `📊 *ESTADO DEL BOT - VERSIÓN 44.0*\n\n` +
                                      `⏰ MODO: setTimeout + Delay inteligente\n` +
                                      `📅 Última actualización: ${agenda.ultima_actualizacion || 'N/A'}\n` +
                                      `📋 Grupos totales: ${total}\n` +
                                      `✅ Grupos activos: ${activos}\n` +
                                      `📌 Pestañas: ${pestanas}\n` +
                                      `⏱️  Horarios programados: ${Array.from(horarios).join(', ') || 'Ninguno'}\n` +
                                      `⏱️  Delay mensajes: ${CONFIG.tiempo_entre_mensajes_min}-${CONFIG.tiempo_entre_mensajes_max} seg (inteligente)\n` +
                                      `📦 Múltiples archivos: ACTIVADO\n` +
                                      `⏱️ Delay entre archivos: ${CONFIG.delay_entre_archivos}s\n` +
                                      `💬 Interacciones: ACTIVADO (menciones, respuestas, reacciones)\n` +
                                      `✍️  Typing adaptativo: activado\n` +
                                      `🔗 Link Previews: CON IMAGEN (caché local)\n` +
                                      `📚 Data Store: ACTIVADO (extracción local)\n` +
                                      `🔄 Actualización automática: 6:00 AM\n` +
                                      `🏷️  Nombres de grupos: CACHÉ + store + consulta directa\n` +
                                      `🧹 Limpieza store: automática (3 AM) - ${CONFIG.dias_retencion_store} días\n` +
                                      `📁 Carpeta multimedia: ${CONFIG.carpeta_multimedia}\n` +
                                      `👥  Grupos completos: espera 30 segundos en "listagrupos"\n` +
                                      `⚡  Latencia: CORREGIDA (mensajes inmediatos)\n` +
                                      `⚡⚡ Comandos prioritarios: ACTIVADOS\n` +
                                      `🔄 Consulta masiva: RESTAURADA\n` +
                                      `🗑️  Limpieza automática: activada\n` +
                                      `📦 Tabla producto-archivo: MÚLTIPLES ARCHIVOS\n` +
                                      `🌐 Browser: ${existeSesion ? 'macOS/Desktop' : 'Ubuntu/Chrome'}\n` +
                                      `📤 Comando listagrupos: disponible (con caché)\n` +
                                      `🎲 SpinTex/SpinEmoji: CORREGIDO PARA BAILEYS\n` +
                                      `🔋 AHORRO DE BATERÍA: setTimeout ACTIVADO (0 verificaciones por minuto)`;
                        
                        await sock.sendMessage(remitente, { text: mensaje });
                    }
                    });
return;
}
}

// ============================================
// PROCESAR INTERACCIONES (RESPUESTAS A MENSAJES)
// ============================================
            
            // Obtener producto del mensaje citado
            const nombreProducto = await obtenerProductoDesdeMensajeCitado(sock, mensaje);
            if (!nombreProducto) return;
            setImmediate(async () => {
                try {
                    // Obtener producto del mensaje citado
                    const nombreProducto = await obtenerProductoDesdeMensajeCitado(sock, mensaje);
                    if (!nombreProducto) {
                        mensajesEnProcesamiento.delete(mensajeId);
                        return;
                    }

            guardarLogLocal(`   🔍 Producto detectado en mensaje citado: "${nombreProducto}"`);
                    guardarLogLocal(`   🔍 Producto detectado en mensaje citado: "${nombreProducto}"`);

            // Obtener datos completos del producto
            const datosProducto = obtenerDatosProducto(nombreProducto);
            if (!datosProducto) return;
                    // Obtener datos completos del producto
                    const datosProducto = obtenerDatosProducto(nombreProducto);
                    if (!datosProducto) {
                        mensajesEnProcesamiento.delete(mensajeId);
                        return;
                    }

            // Clasificar la consulta del usuario
            const tipoConsulta = clasificarConsulta(texto);
                    // Clasificar la consulta del usuario
                    const tipoConsulta = clasificarConsulta(texto);

            if (tipoConsulta !== 'no_respondible') {
                // Generar respuesta automática
                const respuesta = generarRespuestaAutomatica(tipoConsulta, nombreProducto, datosProducto);
                if (respuesta) {
                    await sock.sendMessage(remitente, { text: respuesta });
                    guardarLogLocal(`   ✅ Respuesta automática enviada (${tipoConsulta})`);
                    if (tipoConsulta !== 'no_respondible') {
                        // Generar respuesta automática
                        const respuesta = generarRespuestaAutomatica(tipoConsulta, nombreProducto, datosProducto);
                        if (respuesta) {
                            // Simular typing antes de responder
                            const delayTyping = Math.floor(Math.random() * (CONFIG.delay_respuesta_max - CONFIG.delay_respuesta_min + 1) + CONFIG.delay_respuesta_min);
                            await simularTyping(sock, remitente, delayTyping);
                            
                            await sock.sendMessage(remitente, { text: respuesta });
                            guardarLogLocal(`   ✅ Respuesta automática enviada (${tipoConsulta})`);
                        }
                    } else {
                        // Enviar alerta al admin
                        const clienteNumero = remitente.split('@')[0];
                        const lugar = esGrupo ? `Grupo` : `Chat privado`;
                        const enlace = generarEnlaceWaMe(remitente, nombreProducto, texto);
                        
                        const datosAlerta = {
                            producto: nombreProducto,
                            clienteNombre: clienteNumero,
                            clienteNumero: clienteNumero,
                            pregunta: texto,
                            lugar: lugar,
                            tiempo: 'ahora mismo',
                            enlace: enlace
                        };
                        
                        await enviarAlertaAdmin(sock, sock.user.id, datosAlerta);
                    }
                } catch (error) {
                    guardarLogLocal(`   ❌ Error procesando interacción: ${error.message}`);
                } finally {
                    mensajesEnProcesamiento.delete(mensajeId);
}
            } else {
                // Enviar alerta al admin
                const clienteNumero = remitente.split('@')[0];
                const lugar = esGrupo ? `Grupo` : `Chat privado`;
                const enlace = generarEnlaceWaMe(remitente, nombreProducto, texto);
                
                const datosAlerta = {
                    producto: nombreProducto,
                    clienteNombre: clienteNumero,
                    clienteNumero: clienteNumero,
                    pregunta: texto,
                    lugar: lugar,
                    tiempo: 'ahora mismo',
                    enlace: enlace
                };
                
                await enviarAlertaAdmin(sock, sock.user.id, datosAlerta);
            }
            });
});

console.log('\n📝 Comandos disponibles en WhatsApp:');
@@ -2190,6 +2251,9 @@ async function iniciarWhatsApp() {
console.log('     gorra.pdf (📄 información de gorra)');
console.log('⏱️ **DELAY INTELIGENTE**');
console.log('   - Se adapta automáticamente al tiempo real de envío');
        console.log('⚡ **INMEDIATEZ OPTIMIZADA**');
        console.log('   - Los mensajes se procesan inmediatamente al llegar');
        console.log('   - Simulación de typing antes de responder (1-3 segundos)');
console.log('💬 **INTERACCIONES ACTIVADAS**');
console.log('   - En grupos: menciona al bot con @ para activar');
console.log('   - Responde automáticamente a consultas de precio/info');
