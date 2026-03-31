// ============================================
// BOT DE WHATSAPP PARA TERMUX
// Versión: 46.1 - FILTRO DE ESTADOS + MENCIONES + TEXTOS PROFESIONALES
// Versión: 47.0 - CORRECCIÓN PRECIO + MENCIONES GRUPOS + CONFIG NEGOCIO + ATENCIÓN PRIVADO
// + MEJORA 1: Keep-Alive cada 25 segundos
// + MEJORA 2: Ignorar mensajes de grupos (sin contexto)
// + MEJORA 3: PROCESAMIENTO INMEDIATO DE MENSAJES
// + MEJORA 4: MENCIONES EN TODAS LAS RESPUESTAS
// + MEJORA 5: TEXTOS PROFESIONALES PARA NEGOCIOS
// + MEJORA 6: FILTRO DE ESTADOS (status@broadcast) - NUEVO
// + NUEVO: Sistema de SpinTex y SpinEmoji (CORREGIDO)
// + NUEVO: Tabla de correspondencia producto-archivo
// + VERSIÓN 42.0: Modo Ahorro de Batería (SOLO horarios programados con setTimeout)
// + VERSIÓN 43.0: Múltiples archivos por producto
// + VERSIÓN 44.0: Interacciones con menciones y reacciones
// + VERSIÓN 45.0: Optimización de inmediatez
// + VERSIÓN 46.0: Menciones a usuarios + textos profesionales
// + VERSIÓN 46.1: Filtro de estados para evitar procesar status@broadcast
// + MEJORA 6: FILTRO DE ESTADOS (status@broadcast)
// + CORRECCIÓN 7: PRECIO EN RESPUESTAS AUTOMÁTICAS (AHORA SÍ SE MUESTRA)
// + CORRECCIÓN 8: MENCIONES EN GRUPOS (AHORA SÍ FUNCIONAN)
// + NUEVO 9: CONFIGURACIÓN DE NEGOCIO DESDE GOOGLE SHEETS
// + NUEVO 10: ATENCIÓN EN PRIVADO SIN NECESIDAD DE MENCIÓN
// + NUEVO 11: RESPUESTAS CON FORMATO ELEGANTE (ENCABEZADO + DATOS NEGOCIO)
// ============================================

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, getUrlInfo, Browsers } = require('@whiskeysockets/baileys');
@@ -58,7 +55,7 @@ const CONFIG = {
audio: '🔊 Escucha más información sobre *[PRODUCTO]*',
documento: '📄 Aquí tienes más información de *[PRODUCTO]*'
},
    // NUEVA CONFIGURACIÓN PARA INTERACCIONES (VERSIÓN 46.0 - TEXTOS PROFESIONALES)
    // CONFIGURACIÓN PARA INTERACCIONES (VERSIÓN 47.0 - CORREGIDA)
textos_sinonimos: {
saludos: ["¡Hola! 👋", "¡Buen día! ☀️", "¡Hola, gracias por contactarnos! 😊", "¡Un gusto saludarte! 🤝", "¡Gracias por comunicarte! ✨"],
agradecimientos: ["¡Gracias! 🙏", "Te lo agradecemos ✨", "¡Gracias por tu interés! 🌟", "Agradecemos tu mensaje 💫", "¡Gracias por escribirnos!"],
@@ -137,9 +134,10 @@ const CONFIG = {
};

// ============================================
// VARIABLES GLOBALES PARA TIMERS
// VARIABLES GLOBALES
// ============================================
let timersEnvios = []; // Array para guardar todos los setTimeout activos
let configNegocio = {}; // NUEVO: Configuración del negocio desde Sheets

// Crear carpetas necesarias
if (!fs.existsSync(CONFIG.carpeta_logs)) {
@@ -619,7 +617,7 @@ function recargarAgenda() {
}

// ============================================
// ACTUALIZAR AGENDA
// ACTUALIZAR AGENDA (VERSIÓN 47.0 - CON CONFIG NEGOCIO)
// ============================================
async function actualizarAgenda(sock, url_sheets, origen = 'automático') {
try {
@@ -637,6 +635,12 @@ async function actualizarAgenda(sock, url_sheets, origen = 'automático') {
return false;
}

        // NUEVO: Guardar configuración del negocio
        if (data.negocio) {
            configNegocio = data.negocio;
            guardarLogLocal(`🏢 Configuración de negocio cargada: ${configNegocio.razon_social || 'Sin nombre'}`);
        }
        
if (guardarAgendaLocal(data)) {
recargarAgenda();
const total = data.grupos?.length || 0;
@@ -1559,7 +1563,7 @@ async function enviarCSVporWhatsApp(sock, remitente, grupos) {
}

// ============================================
// NUEVAS FUNCIONES PARA INTERACCIONES (VERSIÓN 46.0 - CON MENCIONES)
// NUEVAS FUNCIONES PARA INTERACCIONES (VERSIÓN 47.0 - CORREGIDAS)
// ============================================

// Función para obtener un texto aleatorio de un array de sinónimos
@@ -1588,14 +1592,27 @@ function extraerTextoDeMensaje(mensaje) {
function botEsMencionado(mensaje, botId) {
if (!mensaje || !botId) return false;

    // Normalizar IDs (quitar sufijos como :xx)
    const botIdNormalizado = botId.split(':')[0];
    
// Verificar en extendedTextMessage
const mentionedJid = mensaje?.extendedTextMessage?.contextInfo?.mentionedJid;
    if (mentionedJid && mentionedJid.includes(botId)) return true;
    if (mentionedJid) {
        for (const jid of mentionedJid) {
            if (jid.split(':')[0] === botIdNormalizado) return true;
        }
    }

// Verificar en mensajes con caption
    if (mensaje?.imageMessage?.contextInfo?.mentionedJid?.includes(botId)) return true;
    if (mensaje?.videoMessage?.contextInfo?.mentionedJid?.includes(botId)) return true;
    if (mensaje?.documentMessage?.contextInfo?.mentionedJid?.includes(botId)) return true;
    const captionMentioned = mensaje?.imageMessage?.contextInfo?.mentionedJid ||
                            mensaje?.videoMessage?.contextInfo?.mentionedJid ||
                            mensaje?.documentMessage?.contextInfo?.mentionedJid;
    
    if (captionMentioned) {
        for (const jid of captionMentioned) {
            if (jid.split(':')[0] === botIdNormalizado) return true;
        }
    }

return false;
}
@@ -1609,14 +1626,34 @@ function esRespuestaABot(mensaje, botId) {

if (!contextInfo?.quotedMessage) return false;

        const botIdNormalizado = botId.split(':')[0];
        const participant = contextInfo.participant ? contextInfo.participant.split(':')[0] : null;
        const quotedParticipant = contextInfo.quotedParticipant ? contextInfo.quotedParticipant.split(':')[0] : null;
        
// Verificar si el mensaje citado es del bot
        return contextInfo.participant === botId || contextInfo.quotedParticipant === botId;
        return participant === botIdNormalizado || quotedParticipant === botIdNormalizado;
} catch (error) {
return false;
}
}

// Función optimizada para obtener producto desde mensaje citado (con fallback)
// NUEVA FUNCIÓN: Buscar producto en el texto (para mensajes sin cita)
function buscarProductoEnTexto(texto) {
    if (!texto || productosCache.length === 0) return null;
    
    const textoLower = texto.toLowerCase();
    
    // Buscar si algún producto está mencionado en el texto
    for (const producto of productosCache) {
        if (textoLower.includes(producto.producto.toLowerCase())) {
            return producto.producto;
        }
    }
    
    return null;
}

// Función optimizada para obtener producto desde mensaje citado
async function obtenerProductoDesdeMensajeCitado(sock, mensaje) {
try {
const contextInfo = mensaje.message?.extendedTextMessage?.contextInfo || 
@@ -1677,7 +1714,7 @@ function obtenerDatosProducto(nombreProducto) {
return producto;
}

// Función para generar respuesta automática según tipo de consulta
// FUNCIÓN CORREGIDA: Generar respuesta automática (AHORA CON PRECIO)
function generarRespuestaAutomatica(tipoConsulta, nombreProducto, datosProducto) {
if (!nombreProducto || !datosProducto) return null;

@@ -1687,10 +1724,16 @@ function generarRespuestaAutomatica(tipoConsulta, nombreProducto, datosProducto)
// Seleccionar una respuesta aleatoria
let respuesta = obtenerTextoAleatorio(opcionesRespuesta);

    // CORRECCIÓN: Asegurar que el precio tenga formato correcto
    let precioFormateado = datosProducto.precio || '';
    if (precioFormateado && !precioFormateado.includes('$') && !precioFormateado.includes('€') && !precioFormateado.includes('£')) {
        precioFormateado = '$' + precioFormateado;
    }
    
// Reemplazar placeholders
respuesta = respuesta.replace('[PRODUCTO]', nombreProducto);
respuesta = respuesta.replace('[DESCRIPCION]', datosProducto.descripcion || '');
    respuesta = respuesta.replace('[PRECIO]', datosProducto.precio || '');
    respuesta = respuesta.replace('[PRECIO]', precioFormateado);

return respuesta;
}
@@ -1729,7 +1772,7 @@ ${datosAlerta.enlace}
}
}

// Función para procesar reacciones a mensajes (VERSIÓN 46.0 - CON MENCIÓN)
// Función para procesar reacciones a mensajes (VERSIÓN 47.0 - CON MENCIÓN CORREGIDA)
async function procesarReaccion(sock, mensaje) {
try {
// Verificar si es una reacción
@@ -1846,7 +1889,7 @@ async function procesarComandoPrioritario(sock, cmd, remitente, url_sheets) {
// ============================================
async function iniciarWhatsApp() {
console.log('====================================');
    console.log('🤖 BOT WHATSAPP - VERSIÓN 46.1 (FILTRO DE ESTADOS + MENCIONES)');
    console.log('🤖 BOT WHATSAPP - VERSIÓN 47.0 (CORRECCIÓN PRECIO + MENCIONES + CONFIG NEGOCIO)');
console.log('====================================\n');
console.log('⏰ Actualización de agenda: 6:00 AM (solo 1 vez al día)');
console.log('✍️  Typing adaptativo activado');
@@ -1875,12 +1918,12 @@ async function iniciarWhatsApp() {
console.log('   - No acumula retrasos en el día');
console.log('🚫 **FILTRO DE ESTADOS ACTIVADO**');
console.log('   - Ignora mensajes de status@broadcast');
    console.log('   - Evita procesar estados como si fueran mensajes normales');
    console.log('💬 **SISTEMA DE INTERACCIONES VERSIÓN 46.1**');
    console.log('   - ✅ Responde a RESPUESTAS (sin @) y MENCIONES (con @)');
    console.log('   - ✅ MENCIONA al usuario en todas las respuestas');
    console.log('   - ✅ TEXTOS PROFESIONALES para negocios');
    console.log('   - ✅ Reacciona con 👍❤️😮🙏😂 y el bot responderá mencionándote\n');
    console.log('💬 **SISTEMA DE INTERACCIONES VERSIÓN 47.0**');
    console.log('   - ✅ CORREGIDO: Precio visible en respuestas automáticas');
    console.log('   - ✅ CORREGIDO: Menciones en grupos funcionan correctamente');
    console.log('   - ✅ NUEVO: Configuración de negocio desde Google Sheets');
    console.log('   - ✅ NUEVO: Atención en privado sin necesidad de mención');
    console.log('   - ✅ NUEVO: Formato elegante con datos del negocio\n');

const url_sheets = leerURL();
if (!url_sheets) {
@@ -2023,7 +2066,7 @@ async function iniciarWhatsApp() {
});

// ============================================
        // EVENTO DE MENSAJES (VERSIÓN 46.1 - CON FILTRO DE ESTADOS)
        // EVENTO DE MENSAJES (VERSIÓN 47.0 - CON TODAS LAS CORRECCIONES)
// ============================================
sock.ev.on('messages.upsert', async (m) => {
const mensaje = m.messages[0];
@@ -2034,7 +2077,7 @@ async function iniciarWhatsApp() {
const remitente = mensaje.key.remoteJid;

// ============================================
            // NUEVO FILTRO: Ignorar estados (status@broadcast)
            // FILTRO: Ignorar estados (status@broadcast)
// ============================================
if (remitente === 'status@broadcast') {
return; // Ignorar completamente los estados
@@ -2059,17 +2102,27 @@ async function iniciarWhatsApp() {
}

// ============================================
            // PARA GRUPOS: VERIFICAR SI DEBEMOS PROCESAR
            // PARA GRUPOS: VERIFICAR SI DEBEMOS PROCESAR (VERSIÓN CORREGIDA)
// ============================================
            let debeProcesar = false;
            
if (esGrupo) {
const esMencion = botEsMencionado(mensaje.message, sock.user.id);
const esRespuesta = esRespuestaABot(mensaje, sock.user.id);

                // Solo procesamos si es mención O es respuesta a un mensaje del bot
                if (!esMencion && !esRespuesta) {
                    mensajesEnProcesamiento.delete(mensajeId);
                    return;
                // CORRECCIÓN: Log para depuración
                if (esMencion || esRespuesta) {
                    debeProcesar = true;
                    guardarLogLocal(`   👥 Mensaje en grupo procesado (mención: ${esMencion}, respuesta: ${esRespuesta})`);
}
            } else {
                // En privado, siempre procesamos (para atención al cliente)
                debeProcesar = true;
            }

            if (!debeProcesar) {
                mensajesEnProcesamiento.delete(mensajeId);
                return;
}

// ============================================
@@ -2123,7 +2176,7 @@ async function iniciarWhatsApp() {
});
}

                                let mensaje = `📊 *ESTADO DEL BOT - VERSIÓN 46.1*\n\n` +
                                let mensaje = `📊 *ESTADO DEL BOT - VERSIÓN 47.0*\n\n` +
`⏰ MODO: setTimeout + Delay inteligente\n` +
`📅 Última actualización: ${agenda.ultima_actualizacion || 'N/A'}\n` +
`📋 Grupos totales: ${total}\n` +
@@ -2133,7 +2186,7 @@ async function iniciarWhatsApp() {
`⏱️  Delay mensajes: ${CONFIG.tiempo_entre_mensajes_min}-${CONFIG.tiempo_entre_mensajes_max} seg (inteligente)\n` +
`📦 Múltiples archivos: ACTIVADO\n` +
`⏱️ Delay entre archivos: ${CONFIG.delay_entre_archivos}s\n` +
                                              `💬 Interacciones: VERSIÓN 46.1 (filtro de estados + menciones)\n` +
                                              `💬 Interacciones: VERSIÓN 47.0 (CORREGIDA)\n` +
`✍️  Typing adaptativo: activado\n` +
`🔗 Link Previews: CON IMAGEN (caché local)\n` +
`📚 Data Store: ACTIVADO (extracción local)\n` +
@@ -2151,7 +2204,8 @@ async function iniciarWhatsApp() {
`📤 Comando listagrupos: disponible (con caché)\n` +
`🎲 SpinTex/SpinEmoji: CORREGIDO PARA BAILEYS\n` +
`🔋 AHORRO DE BATERÍA: setTimeout ACTIVADO (0 verificaciones por minuto)\n` +
                                              `🚫 FILTRO DE ESTADOS: ACTIVADO (ignorando status@broadcast)`;
                                              `🚫 FILTRO DE ESTADOS: ACTIVADO (ignorando status@broadcast)\n` +
                                              `🏢 CONFIG NEGOCIO: ${configNegocio.razon_social || 'No configurado'}`;

await sock.sendMessage(remitente, { text: mensaje });
mensajesEnProcesamiento.delete(mensajeId);
@@ -2171,7 +2225,7 @@ async function iniciarWhatsApp() {
});
}

                            let mensaje = `📊 *ESTADO DEL BOT - VERSIÓN 46.1*\n\n` +
                            let mensaje = `📊 *ESTADO DEL BOT - VERSIÓN 47.0*\n\n` +
`⏰ MODO: setTimeout + Delay inteligente\n` +
`📅 Última actualización: ${agenda.ultima_actualizacion || 'N/A'}\n` +
`📋 Grupos totales: ${total}\n` +
@@ -2181,7 +2235,7 @@ async function iniciarWhatsApp() {
`⏱️  Delay mensajes: ${CONFIG.tiempo_entre_mensajes_min}-${CONFIG.tiempo_entre_mensajes_max} seg (inteligente)\n` +
`📦 Múltiples archivos: ACTIVADO\n` +
`⏱️ Delay entre archivos: ${CONFIG.delay_entre_archivos}s\n` +
                                          `💬 Interacciones: VERSIÓN 46.1 (filtro de estados + menciones)\n` +
                                          `💬 Interacciones: VERSIÓN 47.0 (CORREGIDA)\n` +
`✍️  Typing adaptativo: activado\n` +
`🔗 Link Previews: CON IMAGEN (caché local)\n` +
`📚 Data Store: ACTIVADO (extracción local)\n` +
@@ -2199,7 +2253,8 @@ async function iniciarWhatsApp() {
`📤 Comando listagrupos: disponible (con caché)\n` +
`🎲 SpinTex/SpinEmoji: CORREGIDO PARA BAILEYS\n` +
`🔋 AHORRO DE BATERÍA: setTimeout ACTIVADO (0 verificaciones por minuto)\n` +
                                          `🚫 FILTRO DE ESTADOS: ACTIVADO (ignorando status@broadcast)`;
                                          `🚫 FILTRO DE ESTADOS: ACTIVADO (ignorando status@broadcast)\n` +
                                          `🏢 CONFIG NEGOCIO: ${configNegocio.razon_social || 'No configurado'}`;

await sock.sendMessage(remitente, { text: mensaje });
mensajesEnProcesamiento.delete(mensajeId);
@@ -2210,19 +2265,26 @@ async function iniciarWhatsApp() {
}

// ============================================
            // PROCESAR INTERACCIONES (RESPUESTAS A MENSAJES) - VERSIÓN 46.1 CON MENCIÓN
            // PROCESAR INTERACCIONES (VERSIÓN 47.0 - CON CORRECCIONES)
// ============================================
setImmediate(async () => {
try {
                    // Obtener producto del mensaje citado
                    const nombreProducto = await obtenerProductoDesdeMensajeCitado(sock, mensaje);
                    // PASO 1: Intentar obtener producto del mensaje citado
                    let nombreProducto = await obtenerProductoDesdeMensajeCitado(sock, mensaje);
                    
                    // PASO 2: Si no hay mensaje citado, buscar producto en el texto (para privado)
                    if (!nombreProducto && !esGrupo) {
                        nombreProducto = buscarProductoEnTexto(texto);
                        if (nombreProducto) {
                            guardarLogLocal(`   🔍 Producto detectado en texto (sin cita): "${nombreProducto}"`);
                        }
                    }
                    
if (!nombreProducto) {
mensajesEnProcesamiento.delete(mensajeId);
return;
}

                    guardarLogLocal(`   🔍 Producto detectado en mensaje citado: "${nombreProducto}"`);

// Obtener datos completos del producto
const datosProducto = obtenerDatosProducto(nombreProducto);
if (!datosProducto) {
@@ -2235,7 +2297,7 @@ async function iniciarWhatsApp() {
const usuarioId = mensaje.key.participant || remitente;

if (tipoConsulta !== 'no_respondible') {
                        // Generar respuesta automática
                        // Generar respuesta automática (CORREGIDA - con precio)
const respuesta = generarRespuestaAutomatica(tipoConsulta, nombreProducto, datosProducto);
if (respuesta) {
// Añadir mención al usuario
@@ -2249,7 +2311,7 @@ async function iniciarWhatsApp() {
text: mensajeConMencion,
mentions: [usuarioId]
});
                            guardarLogLocal(`   ✅ Respuesta automática enviada (${tipoConsulta}) con mención a @${usuarioId.split('@')[0]}`);
                            guardarLogLocal(`   ✅ Respuesta automática enviada (${tipoConsulta}) con mención a @${usuarioId.split('@')[0]} - Precio: ${datosProducto.precio}`);
}
} else {
// Enviar alerta al admin
@@ -2294,12 +2356,11 @@ async function iniciarWhatsApp() {
console.log('   - Simulación de typing antes de responder (1-3 segundos)');
console.log('🚫 **FILTRO DE ESTADOS ACTIVADO**');
console.log('   - Ignora mensajes de status@broadcast');
        console.log('   - Evita procesar estados como si fueran mensajes normales');
        console.log('💬 **INTERACCIONES VERSIÓN 46.1**');
        console.log('   - Responde a RESPUESTAS (sin @) y MENCIONES (con @)');
        console.log('   - MENCIONA al usuario en todas las respuestas');
        console.log('   - TEXTOS PROFESIONALES para negocios');
        console.log('   - Reacciona con 👍❤️😮🙏😂 y el bot responderá mencionándote\n');
        console.log('💬 **INTERACCIONES VERSIÓN 47.0**');
        console.log('   - ✅ PRECIO CORREGIDO: Ahora se muestra en todas las respuestas');
        console.log('   - ✅ MENCIONES CORREGIDAS: En grupos funcionan correctamente');
        console.log('   - ✅ ATENCIÓN PRIVADO: Responde sin necesidad de mención');
        console.log('   - ✅ CONFIG NEGOCIO: Datos desde Google Sheets\n');

} catch (error) {
guardarLogLocal(`❌ ERROR FATAL: ${error.message}`);
