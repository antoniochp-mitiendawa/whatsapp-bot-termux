// ============================================
// BOT DE WHATSAPP PARA TERMUX
// Versión: 48.0 - CORRECCIÓN PRECIO + RESPUESTAS NEGOCIO + SINÓNIMOS
// Versión: 46.1 - FILTRO DE ESTADOS + MENCIONES + TEXTOS PROFESIONALES
// + MEJORA 1: Keep-Alive cada 25 segundos
// + MEJORA 2: Ignorar mensajes de grupos (sin contexto)
// + MEJORA 3: PROCESAMIENTO INMEDIATO DE MENSAJES
// + MEJORA 4: MENCIONES EN TODAS LAS RESPUESTAS
// + MEJORA 5: TEXTOS PROFESIONALES PARA NEGOCIOS
// + MEJORA 6: FILTRO DE ESTADOS (status@broadcast)
// + CORRECCIÓN 7: PRECIO EN RESPUESTAS AUTOMÁTICAS (AHORA SÍ SE MUESTRA)
// + CORRECCIÓN 8: MENCIONES EN GRUPOS (AHORA SÍ FUNCIONAN)
// + NUEVO 9: CONFIGURACIÓN DE NEGOCIO DESDE GOOGLE SHEETS
// + NUEVO 10: ATENCIÓN EN PRIVADO SIN NECESIDAD DE MENCIÓN
// + NUEVO 11: RESPUESTAS CON FORMATO ELEGANTE (ENCABEZADO + DATOS NEGOCIO)
// + CORRECCIÓN 12: PRECIO AHORA SE MUESTRA CORRECTAMENTE (FIX UNDEFINED)
// + NUEVO 13: RESPUESTAS PARA DOMICILIO, HORARIO, TELÉFONO, ETC.
// + NUEVO 14: SINÓNIMOS AMPLIADOS PARA CONSULTAS DEL NEGOCIO
// + MEJORA 6: FILTRO DE ESTADOS (status@broadcast) - NUEVO
// + NUEVO: Sistema de SpinTex y SpinEmoji (CORREGIDO)
// + NUEVO: Tabla de correspondencia producto-archivo
// + VERSIÓN 42.0: Modo Ahorro de Batería (SOLO horarios programados con setTimeout)
// + VERSIÓN 43.0: Múltiples archivos por producto
// + VERSIÓN 44.0: Interacciones con menciones y reacciones
// + VERSIÓN 45.0: Optimización de inmediatez
// + VERSIÓN 46.0: Menciones a usuarios + textos profesionales
// + VERSIÓN 46.1: Filtro de estados para evitar procesar status@broadcast
// ============================================

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, getUrlInfo, Browsers } = require('@whiskeysockets/baileys');
@@ -58,7 +58,7 @@ const CONFIG = {
audio: '🔊 Escucha más información sobre *[PRODUCTO]*',
documento: '📄 Aquí tienes más información de *[PRODUCTO]*'
},
    // CONFIGURACIÓN PARA INTERACCIONES (VERSIÓN 48.0 - SINÓNIMOS AMPLIADOS)
    // NUEVA CONFIGURACIÓN PARA INTERACCIONES (VERSIÓN 46.0 - TEXTOS PROFESIONALES)
textos_sinonimos: {
saludos: ["¡Hola! 👋", "¡Buen día! ☀️", "¡Hola, gracias por contactarnos! 😊", "¡Un gusto saludarte! 🤝", "¡Gracias por comunicarte! ✨"],
agradecimientos: ["¡Gracias! 🙏", "Te lo agradecemos ✨", "¡Gracias por tu interés! 🌟", "Agradecemos tu mensaje 💫", "¡Gracias por escribirnos!"],
@@ -131,24 +131,15 @@ const CONFIG = {
info: ["info", "información", "características", "descripción", "qué es", "detalles", "descripcion", "caracteristicas", "como es", "que tiene", "especificaciones"],
generica: ["más", "info", "información", "quiero saber", "dime", "mas", "informacion", "saber", "conocer", "interesa", "me interesa", "quisiera saber"]
},
    // NUEVA CONFIGURACIÓN PARA CONSULTAS DE NEGOCIO (VERSIÓN 48.0)
    palabras_clave_negocio: {
        horario: ["horario", "atienden", "abren", "cierran", "hora", "horarios", "atencion", "atención", "a qué hora", "cuándo abren", "cuándo cierran", "días de atención"],
        domicilio: ["domicilio", "ubicación", "ubicacion", "dirección", "direccion", "dónde están", "donde estan", "en dónde", "donde quedan", "como llegar", "cómo llegar", "mapa"],
        telefono: ["teléfono", "telefono", "whatsapp", "contacto", "número", "numero", "celular", "llamar", "comunicarme", "hablar"],
        email: ["email", "correo", "mail", "electrónico", "electronico", "e-mail"],
        web: ["web", "sitio", "página", "pagina", "website", "internet", "online"]
    },
// CONFIGURACIÓN PARA INMEDIATEZ
delay_respuesta_min: 1, // segundos mínimos antes de responder (simular typing)
delay_respuesta_max: 3  // segundos máximos antes de responder
};

// ============================================
// VARIABLES GLOBALES
// VARIABLES GLOBALES PARA TIMERS
// ============================================
let timersEnvios = []; // Array para guardar todos los setTimeout activos
let configNegocio = {}; // Configuración del negocio desde Sheets

// Crear carpetas necesarias
if (!fs.existsSync(CONFIG.carpeta_logs)) {
@@ -628,7 +619,7 @@ function recargarAgenda() {
}

// ============================================
// ACTUALIZAR AGENDA (VERSIÓN 48.0 - CON CONFIG NEGOCIO)
// ACTUALIZAR AGENDA
// ============================================
async function actualizarAgenda(sock, url_sheets, origen = 'automático') {
try {
@@ -646,14 +637,6 @@ async function actualizarAgenda(sock, url_sheets, origen = 'automático') {
return false;
}

        // NUEVO: Guardar configuración del negocio
        if (data.negocio) {
            configNegocio = data.negocio;
            guardarLogLocal(`🏢 Configuración de negocio cargada: ${configNegocio.RAZON_SOCIAL || 'Sin nombre'}`);
            // Log para depuración
            guardarLogLocal(`📋 Datos de negocio: ${JSON.stringify(configNegocio)}`);
        }
        
if (guardarAgendaLocal(data)) {
recargarAgenda();
const total = data.grupos?.length || 0;
@@ -665,10 +648,6 @@ async function actualizarAgenda(sock, url_sheets, origen = 'automático') {
productosCache = data.productos;
ultimaActualizacionProductos = Date.now();
guardarLogLocal(`📦 Caché de productos actualizado desde Sheets: ${productosCache.length} productos`);
                // Log para depuración de precios
                productosCache.forEach(p => {
                    guardarLogLocal(`   📦 Producto: ${p.producto}, Precio: ${p.precio}`);
                });
}

// Si hay un socket activo, reprogramar todos los envíos
@@ -1580,7 +1559,7 @@ async function enviarCSVporWhatsApp(sock, remitente, grupos) {
}

// ============================================
// NUEVAS FUNCIONES PARA INTERACCIONES (VERSIÓN 48.0 - CORREGIDAS)
// NUEVAS FUNCIONES PARA INTERACCIONES (VERSIÓN 46.0 - CON MENCIONES)
// ============================================

// Función para obtener un texto aleatorio de un array de sinónimos
@@ -1609,27 +1588,14 @@ function extraerTextoDeMensaje(mensaje) {
function botEsMencionado(mensaje, botId) {
if (!mensaje || !botId) return false;

    // Normalizar IDs (quitar sufijos como :xx)
    const botIdNormalizado = botId.split(':')[0];
    
// Verificar en extendedTextMessage
const mentionedJid = mensaje?.extendedTextMessage?.contextInfo?.mentionedJid;
    if (mentionedJid) {
        for (const jid of mentionedJid) {
            if (jid.split(':')[0] === botIdNormalizado) return true;
        }
    }
    if (mentionedJid && mentionedJid.includes(botId)) return true;

// Verificar en mensajes con caption
    const captionMentioned = mensaje?.imageMessage?.contextInfo?.mentionedJid ||
                            mensaje?.videoMessage?.contextInfo?.mentionedJid ||
                            mensaje?.documentMessage?.contextInfo?.mentionedJid;
    
    if (captionMentioned) {
        for (const jid of captionMentioned) {
            if (jid.split(':')[0] === botIdNormalizado) return true;
        }
    }
    if (mensaje?.imageMessage?.contextInfo?.mentionedJid?.includes(botId)) return true;
    if (mensaje?.videoMessage?.contextInfo?.mentionedJid?.includes(botId)) return true;
    if (mensaje?.documentMessage?.contextInfo?.mentionedJid?.includes(botId)) return true;

return false;
}
@@ -1643,76 +1609,14 @@ function esRespuestaABot(mensaje, botId) {

if (!contextInfo?.quotedMessage) return false;

        const botIdNormalizado = botId.split(':')[0];
        const participant = contextInfo.participant ? contextInfo.participant.split(':')[0] : null;
        const quotedParticipant = contextInfo.quotedParticipant ? contextInfo.quotedParticipant.split(':')[0] : null;
        
// Verificar si el mensaje citado es del bot
        return participant === botIdNormalizado || quotedParticipant === botIdNormalizado;
        return contextInfo.participant === botId || contextInfo.quotedParticipant === botId;
} catch (error) {
return false;
}
}

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

// NUEVA FUNCIÓN: Clasificar consultas de negocio (VERSIÓN 48.0)
function clasificarConsultaNegocio(texto) {
    const textoLower = texto.toLowerCase();
    
    // Horario
    for (const palabra of CONFIG.palabras_clave_negocio.horario) {
        if (textoLower.includes(palabra)) {
            return 'horario';
        }
    }
    
    // Domicilio / Ubicación
    for (const palabra of CONFIG.palabras_clave_negocio.domicilio) {
        if (textoLower.includes(palabra)) {
            return 'domicilio';
        }
    }
    
    // Teléfono
    for (const palabra of CONFIG.palabras_clave_negocio.telefono) {
        if (textoLower.includes(palabra)) {
            return 'telefono';
        }
    }
    
    // Email
    for (const palabra of CONFIG.palabras_clave_negocio.email) {
        if (textoLower.includes(palabra)) {
            return 'email';
        }
    }
    
    // Web
    for (const palabra of CONFIG.palabras_clave_negocio.web) {
        if (textoLower.includes(palabra)) {
            return 'web';
        }
    }
    
    return null;
}

// Función optimizada para obtener producto desde mensaje citado
// Función optimizada para obtener producto desde mensaje citado (con fallback)
async function obtenerProductoDesdeMensajeCitado(sock, mensaje) {
try {
const contextInfo = mensaje.message?.extendedTextMessage?.contextInfo || 
@@ -1773,7 +1677,7 @@ function obtenerDatosProducto(nombreProducto) {
return producto;
}

// FUNCIÓN CORREGIDA: Generar respuesta automática (AHORA CON PRECIO)
// Función para generar respuesta automática según tipo de consulta
function generarRespuestaAutomatica(tipoConsulta, nombreProducto, datosProducto) {
if (!nombreProducto || !datosProducto) return null;

@@ -1783,59 +1687,10 @@ function generarRespuestaAutomatica(tipoConsulta, nombreProducto, datosProducto)
// Seleccionar una respuesta aleatoria
let respuesta = obtenerTextoAleatorio(opcionesRespuesta);

    // CORRECCIÓN: Asegurar que el precio tenga formato correcto y no sea undefined
    let precioFormateado = datosProducto.precio || '';
    if (precioFormateado) {
        // Si el precio es un número, convertirlo a string
        if (typeof precioFormateado === 'number') {
            precioFormateado = precioFormateado.toString();
        }
        // Añadir símbolo $ si no tiene ningún símbolo de moneda
        if (!precioFormateado.includes('$') && !precioFormateado.includes('€') && !precioFormateado.includes('£') && !precioFormateado.includes('USD')) {
            precioFormateado = '$' + precioFormateado;
        }
    } else {
        precioFormateado = '[PRECIO NO DISPONIBLE]'; // Fallback visible
    }
    
    // Log para depuración
    guardarLogLocal(`   💰 Precio formateado: "${precioFormateado}"`);
    
// Reemplazar placeholders
respuesta = respuesta.replace('[PRODUCTO]', nombreProducto);
respuesta = respuesta.replace('[DESCRIPCION]', datosProducto.descripcion || '');
    respuesta = respuesta.replace('[PRECIO]', precioFormateado);
    
    return respuesta;
}

// NUEVA FUNCIÓN: Generar respuesta para consultas de negocio (VERSIÓN 48.0)
function generarRespuestaNegocio(tipoConsulta) {
    if (!configNegocio || Object.keys(configNegocio).length === 0) {
        return "Información de contacto no disponible. Por favor, intenta más tarde.";
    }
    
    let respuesta = '';
    
    switch(tipoConsulta) {
        case 'horario':
            respuesta = `🕒 *Nuestro horario de atención:*\n${configNegocio.HORARIO_ATENCION || 'No especificado'}`;
            break;
        case 'domicilio':
            respuesta = `📍 *Nuestra ubicación:*\n${configNegocio.UBICACION || 'No especificada'}`;
            break;
        case 'telefono':
            respuesta = `📞 *Teléfono de contacto:*\n${configNegocio.TELEFONO_CONTACTO || 'No especificado'}\n\n📱 *WhatsApp:*\nwa.me/${(configNegocio.TELEFONO_CONTACTO || '').replace(/[^0-9]/g, '')}`;
            break;
        case 'email':
            respuesta = `📧 *Correo electrónico:*\n${configNegocio.EMAIL_CONTACTO || 'No especificado'}`;
            break;
        case 'web':
            respuesta = `🌐 *Sitio web:*\n${configNegocio.SITIO_WEB || 'No especificado'}`;
            break;
        default:
            respuesta = `🏢 *${configNegocio.RAZON_SOCIAL || 'Nuestro negocio'}*\n\n${configNegocio.MENSAJE_BIENVENIDA || 'Gracias por contactarnos'}`;
    }
    respuesta = respuesta.replace('[PRECIO]', datosProducto.precio || '');

return respuesta;
}
@@ -1874,7 +1729,7 @@ ${datosAlerta.enlace}
}
}

// Función para procesar reacciones a mensajes (VERSIÓN 48.0 - CON MENCIÓN CORREGIDA)
// Función para procesar reacciones a mensajes (VERSIÓN 46.0 - CON MENCIÓN)
async function procesarReaccion(sock, mensaje) {
try {
// Verificar si es una reacción
@@ -1991,7 +1846,7 @@ async function procesarComandoPrioritario(sock, cmd, remitente, url_sheets) {
// ============================================
async function iniciarWhatsApp() {
console.log('====================================');
    console.log('🤖 BOT WHATSAPP - VERSIÓN 48.0 (PRECIO CORREGIDO + RESPUESTAS NEGOCIO)');
    console.log('🤖 BOT WHATSAPP - VERSIÓN 46.1 (FILTRO DE ESTADOS + MENCIONES)');
console.log('====================================\n');
console.log('⏰ Actualización de agenda: 6:00 AM (solo 1 vez al día)');
console.log('✍️  Typing adaptativo activado');
@@ -2020,14 +1875,12 @@ async function iniciarWhatsApp() {
console.log('   - No acumula retrasos en el día');
console.log('🚫 **FILTRO DE ESTADOS ACTIVADO**');
console.log('   - Ignora mensajes de status@broadcast');
    console.log('💰 **PRECIO CORREGIDO**');
    console.log('   - Ahora se muestra correctamente en todas las respuestas');
    console.log('🏢 **RESPUESTAS DE NEGOCIO ACTIVADAS**');
    console.log('   - ✅ Horario: "horario", "atienden", "a qué hora"');
    console.log('   - ✅ Domicilio: "domicilio", "ubicación", "dónde están"');
    console.log('   - ✅ Teléfono: "teléfono", "contacto", "whatsapp"');
    console.log('   - ✅ Email: "email", "correo", "mail"');
    console.log('   - ✅ Web: "web", "sitio", "página"\n');
    console.log('   - Evita procesar estados como si fueran mensajes normales');
    console.log('💬 **SISTEMA DE INTERACCIONES VERSIÓN 46.1**');
    console.log('   - ✅ Responde a RESPUESTAS (sin @) y MENCIONES (con @)');
    console.log('   - ✅ MENCIONA al usuario en todas las respuestas');
    console.log('   - ✅ TEXTOS PROFESIONALES para negocios');
    console.log('   - ✅ Reacciona con 👍❤️😮🙏😂 y el bot responderá mencionándote\n');

const url_sheets = leerURL();
if (!url_sheets) {
@@ -2170,7 +2023,7 @@ async function iniciarWhatsApp() {
});

// ============================================
        // EVENTO DE MENSAJES (VERSIÓN 48.0 - CON RESPUESTAS DE NEGOCIO)
        // EVENTO DE MENSAJES (VERSIÓN 46.1 - CON FILTRO DE ESTADOS)
// ============================================
sock.ev.on('messages.upsert', async (m) => {
const mensaje = m.messages[0];
@@ -2181,15 +2034,14 @@ async function iniciarWhatsApp() {
const remitente = mensaje.key.remoteJid;

// ============================================
            // FILTRO: Ignorar estados (status@broadcast)
            // NUEVO FILTRO: Ignorar estados (status@broadcast)
// ============================================
if (remitente === 'status@broadcast') {
return; // Ignorar completamente los estados
}

const esGrupo = remitente.includes('@g.us');
const mensajeId = mensaje.key.id;
            const usuarioId = mensaje.key.participant || remitente;

// Evitar procesar el mismo mensaje múltiples veces
if (mensajesEnProcesamiento.has(mensajeId)) return;
@@ -2207,27 +2059,17 @@ async function iniciarWhatsApp() {
}

// ============================================
            // PARA GRUPOS: VERIFICAR SI DEBEMOS PROCESAR (VERSIÓN CORREGIDA)
            // PARA GRUPOS: VERIFICAR SI DEBEMOS PROCESAR
// ============================================
            let debeProcesar = false;
            
if (esGrupo) {
const esMencion = botEsMencionado(mensaje.message, sock.user.id);
const esRespuesta = esRespuestaABot(mensaje, sock.user.id);

                // CORRECCIÓN: Log para depuración
                if (esMencion || esRespuesta) {
                    debeProcesar = true;
                    guardarLogLocal(`   👥 Mensaje en grupo procesado (mención: ${esMencion}, respuesta: ${esRespuesta})`);
                // Solo procesamos si es mención O es respuesta a un mensaje del bot
                if (!esMencion && !esRespuesta) {
                    mensajesEnProcesamiento.delete(mensajeId);
                    return;
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
@@ -2281,7 +2123,7 @@ async function iniciarWhatsApp() {
});
}

                                let mensaje = `📊 *ESTADO DEL BOT - VERSIÓN 48.0*\n\n` +
                                let mensaje = `📊 *ESTADO DEL BOT - VERSIÓN 46.1*\n\n` +
`⏰ MODO: setTimeout + Delay inteligente\n` +
`📅 Última actualización: ${agenda.ultima_actualizacion || 'N/A'}\n` +
`📋 Grupos totales: ${total}\n` +
@@ -2291,7 +2133,7 @@ async function iniciarWhatsApp() {
`⏱️  Delay mensajes: ${CONFIG.tiempo_entre_mensajes_min}-${CONFIG.tiempo_entre_mensajes_max} seg (inteligente)\n` +
`📦 Múltiples archivos: ACTIVADO\n` +
`⏱️ Delay entre archivos: ${CONFIG.delay_entre_archivos}s\n` +
                                              `💬 Interacciones: VERSIÓN 48.0 (PRECIO CORREGIDO + NEGOCIO)\n` +
                                              `💬 Interacciones: VERSIÓN 46.1 (filtro de estados + menciones)\n` +
`✍️  Typing adaptativo: activado\n` +
`🔗 Link Previews: CON IMAGEN (caché local)\n` +
`📚 Data Store: ACTIVADO (extracción local)\n` +
@@ -2309,9 +2151,7 @@ async function iniciarWhatsApp() {
`📤 Comando listagrupos: disponible (con caché)\n` +
`🎲 SpinTex/SpinEmoji: CORREGIDO PARA BAILEYS\n` +
`🔋 AHORRO DE BATERÍA: setTimeout ACTIVADO (0 verificaciones por minuto)\n` +
                                              `🚫 FILTRO DE ESTADOS: ACTIVADO (ignorando status@broadcast)\n` +
                                              `💰 PRECIO: CORREGIDO (ya no sale vacío)\n` +
                                              `🏢 RESPUESTAS NEGOCIO: Horario, Domicilio, Teléfono, Email, Web`;
                                              `🚫 FILTRO DE ESTADOS: ACTIVADO (ignorando status@broadcast)`;

await sock.sendMessage(remitente, { text: mensaje });
mensajesEnProcesamiento.delete(mensajeId);
@@ -2331,7 +2171,7 @@ async function iniciarWhatsApp() {
});
}

                            let mensaje = `📊 *ESTADO DEL BOT - VERSIÓN 48.0*\n\n` +
                            let mensaje = `📊 *ESTADO DEL BOT - VERSIÓN 46.1*\n\n` +
`⏰ MODO: setTimeout + Delay inteligente\n` +
`📅 Última actualización: ${agenda.ultima_actualizacion || 'N/A'}\n` +
`📋 Grupos totales: ${total}\n` +
@@ -2341,7 +2181,7 @@ async function iniciarWhatsApp() {
`⏱️  Delay mensajes: ${CONFIG.tiempo_entre_mensajes_min}-${CONFIG.tiempo_entre_mensajes_max} seg (inteligente)\n` +
`📦 Múltiples archivos: ACTIVADO\n` +
`⏱️ Delay entre archivos: ${CONFIG.delay_entre_archivos}s\n` +
                                          `💬 Interacciones: VERSIÓN 48.0 (PRECIO CORREGIDO + NEGOCIO)\n` +
                                          `💬 Interacciones: VERSIÓN 46.1 (filtro de estados + menciones)\n` +
`✍️  Typing adaptativo: activado\n` +
`🔗 Link Previews: CON IMAGEN (caché local)\n` +
`📚 Data Store: ACTIVADO (extracción local)\n` +
@@ -2359,9 +2199,7 @@ async function iniciarWhatsApp() {
`📤 Comando listagrupos: disponible (con caché)\n` +
`🎲 SpinTex/SpinEmoji: CORREGIDO PARA BAILEYS\n` +
`🔋 AHORRO DE BATERÍA: setTimeout ACTIVADO (0 verificaciones por minuto)\n` +
                                          `🚫 FILTRO DE ESTADOS: ACTIVADO (ignorando status@broadcast)\n` +
                                          `💰 PRECIO: CORREGIDO (ya no sale vacío)\n` +
                                          `🏢 RESPUESTAS NEGOCIO: Horario, Domicilio, Teléfono, Email, Web`;
                                          `🚫 FILTRO DE ESTADOS: ACTIVADO (ignorando status@broadcast)`;

await sock.sendMessage(remitente, { text: mensaje });
mensajesEnProcesamiento.delete(mensajeId);
@@ -2372,45 +2210,19 @@ async function iniciarWhatsApp() {
}

// ============================================
            // PROCESAR INTERACCIONES (VERSIÓN 48.0 - CON RESPUESTAS DE NEGOCIO)
            // PROCESAR INTERACCIONES (RESPUESTAS A MENSAJES) - VERSIÓN 46.1 CON MENCIÓN
// ============================================
setImmediate(async () => {
try {
                    // NUEVO: Verificar si es consulta de negocio
                    const tipoNegocio = clasificarConsultaNegocio(texto);
                    if (tipoNegocio) {
                        const respuestaNegocio = generarRespuestaNegocio(tipoNegocio);
                        const mensajeConMencion = `@${usuarioId.split('@')[0]} ${respuestaNegocio}`;
                        
                        // Simular typing antes de responder
                        const delayTyping = Math.floor(Math.random() * (CONFIG.delay_respuesta_max - CONFIG.delay_respuesta_min + 1) + CONFIG.delay_respuesta_min);
                        await simularTyping(sock, remitente, delayTyping);
                        
                        await sock.sendMessage(remitente, { 
                            text: mensajeConMencion,
                            mentions: [usuarioId]
                        });
                        guardarLogLocal(`   ✅ Respuesta de negocio enviada (${tipoNegocio}) con mención a @${usuarioId.split('@')[0]}`);
                        mensajesEnProcesamiento.delete(mensajeId);
                        return;
                    }
                    
                    // PASO 1: Intentar obtener producto del mensaje citado
                    let nombreProducto = await obtenerProductoDesdeMensajeCitado(sock, mensaje);
                    
                    // PASO 2: Si no hay mensaje citado, buscar producto en el texto (para privado)
                    if (!nombreProducto && !esGrupo) {
                        nombreProducto = buscarProductoEnTexto(texto);
                        if (nombreProducto) {
                            guardarLogLocal(`   🔍 Producto detectado en texto (sin cita): "${nombreProducto}"`);
                        }
                    }
                    
                    // Obtener producto del mensaje citado
                    const nombreProducto = await obtenerProductoDesdeMensajeCitado(sock, mensaje);
if (!nombreProducto) {
mensajesEnProcesamiento.delete(mensajeId);
return;
}

                    guardarLogLocal(`   🔍 Producto detectado en mensaje citado: "${nombreProducto}"`);

// Obtener datos completos del producto
const datosProducto = obtenerDatosProducto(nombreProducto);
if (!datosProducto) {
@@ -2420,9 +2232,10 @@ async function iniciarWhatsApp() {

// Clasificar la consulta del usuario
const tipoConsulta = clasificarConsulta(texto);
                    const usuarioId = mensaje.key.participant || remitente;

if (tipoConsulta !== 'no_respondible') {
                        // Generar respuesta automática (CORREGIDA - con precio)
                        // Generar respuesta automática
const respuesta = generarRespuestaAutomatica(tipoConsulta, nombreProducto, datosProducto);
if (respuesta) {
// Añadir mención al usuario
@@ -2436,7 +2249,7 @@ async function iniciarWhatsApp() {
text: mensajeConMencion,
mentions: [usuarioId]
});
                            guardarLogLocal(`   ✅ Respuesta automática enviada (${tipoConsulta}) con mención a @${usuarioId.split('@')[0]} - Precio: ${datosProducto.precio}`);
                            guardarLogLocal(`   ✅ Respuesta automática enviada (${tipoConsulta}) con mención a @${usuarioId.split('@')[0]}`);
}
} else {
// Enviar alerta al admin
@@ -2481,14 +2294,12 @@ async function iniciarWhatsApp() {
console.log('   - Simulación de typing antes de responder (1-3 segundos)');
console.log('🚫 **FILTRO DE ESTADOS ACTIVADO**');
console.log('   - Ignora mensajes de status@broadcast');
        console.log('💰 **PRECIO CORREGIDO**');
        console.log('   - Ahora se muestra correctamente en todas las respuestas');
        console.log('🏢 **RESPUESTAS DE NEGOCIO ACTIVADAS**');
        console.log('   - ✅ Horario: "horario", "atienden", "a qué hora"');
        console.log('   - ✅ Domicilio: "domicilio", "ubicación", "dónde están"');
        console.log('   - ✅ Teléfono: "teléfono", "contacto", "whatsapp"');
        console.log('   - ✅ Email: "email", "correo", "mail"');
        console.log('   - ✅ Web: "web", "sitio", "página"\n');
        console.log('   - Evita procesar estados como si fueran mensajes normales');
        console.log('💬 **INTERACCIONES VERSIÓN 46.1**');
        console.log('   - Responde a RESPUESTAS (sin @) y MENCIONES (con @)');
        console.log('   - MENCIONA al usuario en todas las respuestas');
        console.log('   - TEXTOS PROFESIONALES para negocios');
        console.log('   - Reacciona con 👍❤️😮🙏😂 y el bot responderá mencionándote\n');

} catch (error) {
guardarLogLocal(`❌ ERROR FATAL: ${error.message}`);
