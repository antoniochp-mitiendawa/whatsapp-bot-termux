// ============================================
// BOT DE WHATSAPP PARA TERMUX
// Versión: 47.0 - CONFIG NEGOCIO + RESPUESTAS + SINÓNIMOS
// BASE: VERSIÓN 46.1 (ESTABLE) + NUEVAS FUNCIONALIDADES
// ============================================
// ADICIONES (SIN MODIFICAR ESTRUCTURA EXISTENTE):
// - Variable global configNegocio
// - Lectura de data.negocio en actualizarAgenda()
// - Funciones: clasificarConsultaNegocio(), generarRespuestaNegocio()
// - Nuevas palabras clave en CONFIG.palabras_clave_negocio
// - Flujo de negocio en evento messages.upsert (ANTES de producto)
// - CORREGIDO: productosCache mantiene estructura original {producto, archivo}
// Versión: 46.1 - FILTRO DE ESTADOS + MENCIONES + TEXTOS PROFESIONALES
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
// ============================================

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, getUrlInfo, Browsers } = require('@whiskeysockets/baileys');
@@ -53,7 +58,7 @@
audio: '🔊 Escucha más información sobre *[PRODUCTO]*',
documento: '📄 Aquí tienes más información de *[PRODUCTO]*'
},
    // CONFIGURACIÓN PARA INTERACCIONES (VERSIÓN 46.0 - TEXTOS PROFESIONALES)
    // NUEVA CONFIGURACIÓN PARA INTERACCIONES (VERSIÓN 46.0 - TEXTOS PROFESIONALES)
textos_sinonimos: {
saludos: ["¡Hola! 👋", "¡Buen día! ☀️", "¡Hola, gracias por contactarnos! 😊", "¡Un gusto saludarte! 🤝", "¡Gracias por comunicarte! ✨"],
agradecimientos: ["¡Gracias! 🙏", "Te lo agradecemos ✨", "¡Gracias por tu interés! 🌟", "Agradecemos tu mensaje 💫", "¡Gracias por escribirnos!"],
@@ -126,14 +131,6 @@
info: ["info", "información", "características", "descripción", "qué es", "detalles", "descripcion", "caracteristicas", "como es", "que tiene", "especificaciones"],
generica: ["más", "info", "información", "quiero saber", "dime", "mas", "informacion", "saber", "conocer", "interesa", "me interesa", "quisiera saber"]
},
    // NUEVA CONFIGURACIÓN PARA CONSULTAS DE NEGOCIO (VERSIÓN 47.0)
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
@@ -144,9 +141,6 @@
// ============================================
let timersEnvios = []; // Array para guardar todos los setTimeout activos

// NUEVA VARIABLE GLOBAL PARA CONFIGURACIÓN DE NEGOCIO
let configNegocio = {};

// Crear carpetas necesarias
if (!fs.existsSync(CONFIG.carpeta_logs)) {
fs.mkdirSync(CONFIG.carpeta_logs);
@@ -625,7 +619,7 @@
}

// ============================================
// ACTUALIZAR AGENDA (VERSIÓN 47.0 - CON LECTURA DE NEGOCIO)
// ACTUALIZAR AGENDA
// ============================================
async function actualizarAgenda(sock, url_sheets, origen = 'automático') {
try {
@@ -643,12 +637,6 @@
return false;
}

        // NUEVO: Guardar configuración del negocio
        if (data.negocio) {
            configNegocio = data.negocio;
            guardarLogLocal(`🏢 Configuración de negocio cargada: ${configNegocio.RAZON_SOCIAL || 'Sin nombre'}`);
        }
        
if (guardarAgendaLocal(data)) {
recargarAgenda();
const total = data.grupos?.length || 0;
@@ -1571,7 +1559,7 @@
}

// ============================================
// NUEVAS FUNCIONES PARA INTERACCIONES (VERSIÓN 47.0 - CON NEGOCIO)
// NUEVAS FUNCIONES PARA INTERACCIONES (VERSIÓN 46.0 - CON MENCIONES)
// ============================================

// Función para obtener un texto aleatorio de un array de sinónimos
@@ -1600,27 +1588,14 @@
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
@@ -1634,76 +1609,14 @@

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

// NUEVA FUNCIÓN: Clasificar consultas de negocio (VERSIÓN 47.0)
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
@@ -1782,37 +1695,6 @@
return respuesta;
}

// NUEVA FUNCIÓN: Generar respuesta para consultas de negocio (VERSIÓN 47.0)
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
    
    return respuesta;
}

// Función para generar enlace wa.me para alerta al admin
function generarEnlaceWaMe(numeroCliente, nombreProducto, preguntaCliente) {
const numeroLimpio = numeroCliente.split('@')[0].replace(/[^0-9]/g, '');
@@ -1964,7 +1846,7 @@
// ============================================
async function iniciarWhatsApp() {
console.log('====================================');
    console.log('🤖 BOT WHATSAPP - VERSIÓN 47.0 (CONFIG NEGOCIO + RESPUESTAS)');
    console.log('🤖 BOT WHATSAPP - VERSIÓN 46.1 (FILTRO DE ESTADOS + MENCIONES)');
console.log('====================================\n');
console.log('⏰ Actualización de agenda: 6:00 AM (solo 1 vez al día)');
console.log('✍️  Typing adaptativo activado');
@@ -1993,13 +1875,12 @@
console.log('   - No acumula retrasos en el día');
console.log('🚫 **FILTRO DE ESTADOS ACTIVADO**');
console.log('   - Ignora mensajes de status@broadcast');
    console.log('🏢 **NUEVO: RESPUESTAS DE NEGOCIO**');
    console.log('   - ✅ Horario: "horario", "atienden", "a qué hora"');
    console.log('   - ✅ Domicilio: "domicilio", "ubicación", "dónde están"');
    console.log('   - ✅ Teléfono: "teléfono", "contacto", "whatsapp"');
    console.log('   - ✅ Email: "email", "correo", "mail"');
    console.log('   - ✅ Web: "web", "sitio", "página"');
    console.log('   - Los datos se cargan desde Google Sheets (hoja CONFIG)\n');
    console.log('   - Evita procesar estados como si fueran mensajes normales');
    console.log('💬 **SISTEMA DE INTERACCIONES VERSIÓN 46.1**');
    console.log('   - ✅ Responde a RESPUESTAS (sin @) y MENCIONES (con @)');
    console.log('   - ✅ MENCIONA al usuario en todas las respuestas');
    console.log('   - ✅ TEXTOS PROFESIONALES para negocios');
    console.log('   - ✅ Reacciona con 👍❤️😮🙏😂 y el bot responderá mencionándote\n');

const url_sheets = leerURL();
if (!url_sheets) {
@@ -2142,7 +2023,7 @@
});

// ============================================
        // EVENTO DE MENSAJES (VERSIÓN 47.0 - CON RESPUESTAS DE NEGOCIO)
        // EVENTO DE MENSAJES (VERSIÓN 46.1 - CON FILTRO DE ESTADOS)
// ============================================
sock.ev.on('messages.upsert', async (m) => {
const mensaje = m.messages[0];
@@ -2153,15 +2034,14 @@
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
@@ -2181,23 +2061,15 @@
// ============================================
// PARA GRUPOS: VERIFICAR SI DEBEMOS PROCESAR
// ============================================
            let debeProcesar = false;
            
if (esGrupo) {
const esMencion = botEsMencionado(mensaje.message, sock.user.id);
const esRespuesta = esRespuestaABot(mensaje, sock.user.id);

                if (esMencion || esRespuesta) {
                    debeProcesar = true;
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
@@ -2251,7 +2123,7 @@
});
}

                                let mensaje = `📊 *ESTADO DEL BOT - VERSIÓN 47.0*\n\n` +
                                let mensaje = `📊 *ESTADO DEL BOT - VERSIÓN 46.1*\n\n` +
`⏰ MODO: setTimeout + Delay inteligente\n` +
`📅 Última actualización: ${agenda.ultima_actualizacion || 'N/A'}\n` +
`📋 Grupos totales: ${total}\n` +
@@ -2261,7 +2133,7 @@
`⏱️  Delay mensajes: ${CONFIG.tiempo_entre_mensajes_min}-${CONFIG.tiempo_entre_mensajes_max} seg (inteligente)\n` +
`📦 Múltiples archivos: ACTIVADO\n` +
`⏱️ Delay entre archivos: ${CONFIG.delay_entre_archivos}s\n` +
                                              `💬 Interacciones: VERSIÓN 47.0 (CONFIG NEGOCIO)\n` +
                                              `💬 Interacciones: VERSIÓN 46.1 (filtro de estados + menciones)\n` +
`✍️  Typing adaptativo: activado\n` +
`🔗 Link Previews: CON IMAGEN (caché local)\n` +
`📚 Data Store: ACTIVADO (extracción local)\n` +
@@ -2279,8 +2151,7 @@
`📤 Comando listagrupos: disponible (con caché)\n` +
`🎲 SpinTex/SpinEmoji: CORREGIDO PARA BAILEYS\n` +
`🔋 AHORRO DE BATERÍA: setTimeout ACTIVADO (0 verificaciones por minuto)\n` +
                                              `🚫 FILTRO DE ESTADOS: ACTIVADO (ignorando status@broadcast)\n` +
                                              `🏢 CONFIG NEGOCIO: ${configNegocio.RAZON_SOCIAL || 'No configurado'}`;
                                              `🚫 FILTRO DE ESTADOS: ACTIVADO (ignorando status@broadcast)`;

await sock.sendMessage(remitente, { text: mensaje });
mensajesEnProcesamiento.delete(mensajeId);
@@ -2300,7 +2171,7 @@
});
}

                            let mensaje = `📊 *ESTADO DEL BOT - VERSIÓN 47.0*\n\n` +
                            let mensaje = `📊 *ESTADO DEL BOT - VERSIÓN 46.1*\n\n` +
`⏰ MODO: setTimeout + Delay inteligente\n` +
`📅 Última actualización: ${agenda.ultima_actualizacion || 'N/A'}\n` +
`📋 Grupos totales: ${total}\n` +
@@ -2310,7 +2181,7 @@
`⏱️  Delay mensajes: ${CONFIG.tiempo_entre_mensajes_min}-${CONFIG.tiempo_entre_mensajes_max} seg (inteligente)\n` +
`📦 Múltiples archivos: ACTIVADO\n` +
`⏱️ Delay entre archivos: ${CONFIG.delay_entre_archivos}s\n` +
                                          `💬 Interacciones: VERSIÓN 47.0 (CONFIG NEGOCIO)\n` +
                                          `💬 Interacciones: VERSIÓN 46.1 (filtro de estados + menciones)\n` +
`✍️  Typing adaptativo: activado\n` +
`🔗 Link Previews: CON IMAGEN (caché local)\n` +
`📚 Data Store: ACTIVADO (extracción local)\n` +
@@ -2328,8 +2199,7 @@
`📤 Comando listagrupos: disponible (con caché)\n` +
`🎲 SpinTex/SpinEmoji: CORREGIDO PARA BAILEYS\n` +
`🔋 AHORRO DE BATERÍA: setTimeout ACTIVADO (0 verificaciones por minuto)\n` +
                                          `🚫 FILTRO DE ESTADOS: ACTIVADO (ignorando status@broadcast)\n` +
                                          `🏢 CONFIG NEGOCIO: ${configNegocio.RAZON_SOCIAL || 'No configurado'}`;
                                          `🚫 FILTRO DE ESTADOS: ACTIVADO (ignorando status@broadcast)`;

await sock.sendMessage(remitente, { text: mensaje });
mensajesEnProcesamiento.delete(mensajeId);
@@ -2340,28 +2210,7 @@
}

// ============================================
            // NUEVO: VERIFICAR SI ES CONSULTA DE NEGOCIO
            // ============================================
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

            // ============================================
            // PROCESAR INTERACCIONES (RESPUESTAS A MENSAJES)
            // PROCESAR INTERACCIONES (RESPUESTAS A MENSAJES) - VERSIÓN 46.1 CON MENCIÓN
// ============================================
setImmediate(async () => {
try {
@@ -2383,6 +2232,7 @@

// Clasificar la consulta del usuario
const tipoConsulta = clasificarConsulta(texto);
                    const usuarioId = mensaje.key.participant || remitente;

if (tipoConsulta !== 'no_respondible') {
// Generar respuesta automática
@@ -2444,39 +2294,38 @@
console.log('   - Simulación de typing antes de responder (1-3 segundos)');
console.log('🚫 **FILTRO DE ESTADOS ACTIVADO**');
console.log('   - Ignora mensajes de status@broadcast');
        console.log('🏢 **RESPUESTAS DE NEGOCIO ACTIVADAS**');
        console.log('   - ✅ Horario: "horario", "atienden", "a qué hora"');
        console.log('   - ✅ Domicilio: "domicilio", "ubicación", "dónde están"');
        console.log('   - ✅ Teléfono: "teléfono", "contacto", "whatsapp"');
        console.log('   - ✅ Email: "email", "correo", "mail"');
        console.log('   - ✅ Web: "web", "sitio", "página"');
        console.log('   - Los datos se cargan desde Google Sheets (hoja CONFIG)\n');
        console.log('   - Evita procesar estados como si fueran mensajes normales');
        console.log('💬 **INTERACCIONES VERSIÓN 46.1**');
        console.log('   - Responde a RESPUESTAS (sin @) y MENCIONES (con @)');
        console.log('   - MENCIONA al usuario en todas las respuestas');
        console.log('   - TEXTOS PROFESIONALES para negocios');
        console.log('   - Reacciona con 👍❤️😮🙏😂 y el bot responderá mencionándote\n');

} catch (error) {
guardarLogLocal(`❌ ERROR FATAL: ${error.message}`);
setTimeout(() => iniciarWhatsApp(), 30000);
}
}

process.on('SIGINT', () => {
console.log('\n\n👋 Cerrando bot...');
guardarLogLocal('BOT CERRADO MANUALMENTE');

// Cancelar todos los timers antes de salir
if (timersEnvios.length > 0) {
guardarLogLocal(`🔄 Cancelando ${timersEnvios.length} timers activos...`);
timersEnvios.forEach(timer => clearTimeout(timer));
}

limpiarCacheImagenes();
store.writeToFile(CONFIG.archivo_store);
process.exit(0);
});

console.log('====================================');
console.log('🚀 SISTEMA DE MENSAJES MULTI-PESTAÑA');
console.log('====================================\n');

iniciarWhatsApp().catch(error => {
console.log('❌ Error fatal:', error);
});
