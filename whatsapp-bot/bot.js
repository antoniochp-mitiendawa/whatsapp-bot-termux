// ============================================
// BOT DE WHATSAPP PARA TERMUX
// Versión: 45.0 - INMEDIATEZ + INTERACCIONES + REACCIONES + MENCIONES
// Versión: 46.0 - MENCIONES + TEXTOS PROFESIONALES + INMEDIATEZ
// + MEJORA 1: Keep-Alive cada 25 segundos
// + MEJORA 2: Ignorar mensajes de grupos (sin mención)
// + MEJORA 2: Ignorar mensajes de grupos (sin contexto)
// + MEJORA 3: PROCESAMIENTO INMEDIATO DE MENSAJES
//   - SetImmediate para mensajes interactivos
//   - Optimización de extracción de texto
//   - Priorización de eventos
// + MEJORA 4: MENCIONES EN TODAS LAS RESPUESTAS
// + MEJORA 5: TEXTOS PROFESIONALES PARA NEGOCIOS
// + NUEVO: Sistema de SpinTex y SpinEmoji (CORREGIDO)
// + NUEVO: Tabla de correspondencia producto-archivo
// + VERSIÓN 42.0: Modo Ahorro de Batería (SOLO horarios programados con setTimeout)
// + MEJORA: Al actualizar, reprograma todos los envíos
// + MEJORA: 1 cron job a las 6am solo para actualizar agenda
// + VERSIÓN 43.0: Múltiples archivos por producto
// + VERSIÓN 44.0: Interacciones con menciones, respuestas y reacciones
// + VERSIÓN 45.0: Optimización de inmediatez y respuestas a mensajes deslizados
//   - Procesamiento prioritario de mensajes entrantes
//   - Simulación de typing antes de respuestas
//   - Fallback para mensajes citados no encontrados en store
//   - Mejora en detección de menciones en todo tipo de mensajes
//   - Clasificación ampliada de consultas
// + VERSIÓN 44.0: Interacciones con menciones y reacciones
// + VERSIÓN 45.0: Optimización de inmediatez
// + VERSIÓN 46.0: Menciones a usuarios + textos profesionales
//   - Responde a respuestas (sin @) y menciones (con @)
//   - Menciona al usuario en respuestas a reacciones
//   - Menciona al usuario en respuestas a consultas
//   - Textos profesionales y cálidos para negocios
//   - Eliminación de artículos incorrectos
// ============================================

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, getUrlInfo, Browsers } = require('@whiskeysockets/baileys');
@@ -59,84 +57,84 @@ const CONFIG = {
delay_entre_archivos: 3, // segundos entre cada archivo del mismo grupo
textos_por_tipo: {
imagen: '', // El texto principal ya se usa con la primera imagen
        video: '🎬 Te dejo un video de *[PRODUCTO]*',
        audio: '🔊 Escucha más detalles de *[PRODUCTO]*',
        video: '🎬 Te comparto un video de *[PRODUCTO]*',
        audio: '🔊 Escucha más información sobre *[PRODUCTO]*',
documento: '📄 Aquí tienes más información de *[PRODUCTO]*'
},
    // NUEVA CONFIGURACIÓN PARA INTERACCIONES
    // NUEVA CONFIGURACIÓN PARA INTERACCIONES (VERSIÓN 46.0 - TEXTOS PROFESIONALES)
textos_sinonimos: {
        saludos: ["¡Hola! 👋", "¡Qué tal! ✨", "¡Buen día! ☀️", "¡Hola, ¿cómo estás? 😊", "¡Un gusto saludarte! 🤝"],
        agradecimientos: ["¡Gracias! 🙏", "Muchas gracias 😊", "Te lo agradezco ✨", "Gracias totales 🙌", "¡Mil gracias! 🌟"],
        ofertas: ["¿Te interesa? 🤔", "¿Quieres una? 🛍️", "¿Te gustaría adquirirla? 🎁", "¿La quieres para ti? ✨", "¿Te animas? 💫"],
        contacto: ["Estoy a tus órdenes 🤝", "Aquí estoy para ayudarte 👋", "Puedes escribirme cuando quieras 📱", "Para lo que necesites, aquí estoy 💬", "Cuenta conmigo para lo que necesites 🌟"],
        despedidas: ["¡Hasta luego! 👋", "¡Que tengas buen día! ☀️", "¡Nos vemos pronto! ✨", "¡Cuidate mucho! 🙏", "¡Hasta la próxima! 🌟"]
        saludos: ["¡Hola! 👋", "¡Buen día! ☀️", "¡Hola, gracias por contactarnos! 😊", "¡Un gusto saludarte! 🤝", "¡Gracias por comunicarte! ✨"],
        agradecimientos: ["¡Gracias! 🙏", "Te lo agradecemos ✨", "¡Gracias por tu interés! 🌟", "Agradecemos tu mensaje 💫", "¡Gracias por escribirnos!"],
        ofertas: ["¿Te interesa? 🤔", "¿Te gustaría adquirir uno? 🛍️", "¿Quieres obtener más información? 📋", "¿Te gustaría conocer más detalles? ✨", "Estamos a tus órdenes para lo que necesites 🤝"],
        contacto: ["Estamos a tus órdenes 🤝", "Aquí estamos para ayudarte 👋", "Puedes escribirnos cuando quieras 📱", "Para cualquier duda, aquí estamos 💬", "Cuenta con nosotros para lo que necesites 🌟"],
        despedidas: ["¡Hasta luego! 👋", "¡Que tengas buen día! ☀️", "¡Quedamos atentos! ✨", "¡Cuidate mucho! 🙏", "¡Para cualquier cosa, aquí estamos!"]
},
respuestas_reacciones: {
"👍": [
            "👋 ¡Gracias por el like! La *[PRODUCTO]* está disponible. ¿Te interesa?",
            "👍 ¡Qué bueno que te gustó! La *[PRODUCTO]* es excelente. ¿Quieres una?",
            "🙌 Me alegra que te guste *[PRODUCTO]*. Estoy a tus órdenes",
            "✨ ¡Gracias! La *[PRODUCTO]* es de las más vendidas. ¿Te animas?",
            "👏 ¡Aprecio tu like! Para cualquier duda sobre *[PRODUCTO]*, aquí estoy"
            "👋 ¡Gracias por tu interés en *[PRODUCTO]*! Está disponible. ¿Te gustaría adquirir uno?",
            "👍 ¡Gracias por el like! *[PRODUCTO]* es un producto excelente. ¿Quieres más información?",
            "🙌 Agradecemos tu interés en *[PRODUCTO]*. Estamos a tus órdenes",
            "✨ ¡Gracias por tu atención! *[PRODUCTO]* es uno de los más solicitados. ¿Te gustaría conocer más?",
            "👏 Apreciamos tu interés en *[PRODUCTO]*. Para cualquier duda, aquí estamos"
],
"❤️": [
            "❤️ ¡Gracias por el corazón! Me encanta que te guste *[PRODUCTO]*",
            "❤️ ¡Gracias por tu interés en *[PRODUCTO]*! Nos da gusto que te guste",
"💖 ¡Qué bonito! *[PRODUCTO]* es especial. ¿Quieres más información?",
            "💝 ¡Corazón recibido! ¿Te gustaría adquirir *[PRODUCTO]*?",
            "💗 Me alegra mucho que te guste *[PRODUCTO]*. Estoy aquí para ayudarte",
            "💕 ¡Gracias! *[PRODUCTO]* tiene muchos admiradores. ¿Te cuento más?"
            "💝 ¡Gracias por el corazón! ¿Te gustaría adquirir *[PRODUCTO]*?",
            "💗 Agradecemos tu interés en *[PRODUCTO]*. Estamos aquí para ayudarte",
            "💕 ¡Gracias! *[PRODUCTO]* tiene excelentes comentarios. ¿Te gustaría conocer más detalles?"
],
"😮": [
            "😮 ¿Sorprendido? *[PRODUCTO]* es increíble, ¿quieres conocer más?",
            "😲 ¡Vaya, impactante! ¿Te gustaría saber más de *[PRODUCTO]*?",
            "🤯 Increíble, ¿verdad? *[PRODUCTO]* tiene muchos secretos. ¿Te interesa?",
            "😱 ¡Me encanta tu reacción! *[PRODUCTO]* es único. ¿Quieres una?",
            "🌟 Así es, *[PRODUCTO]* es sorprendente. ¿Te animas a probarlo?"
            "😮 ¿Sorprendido con *[PRODUCTO]*? Es realmente increíble, ¿quieres conocer más?",
            "😲 ¡Vaya! *[PRODUCTO]* impacta a primera vista. ¿Te gustaría saber más?",
            "🤯 Increíble, ¿verdad? *[PRODUCTO]* tiene características únicas. ¿Te interesa?",
            "😱 ¡Nos encanta tu reacción! *[PRODUCTO]* es único. ¿Te gustaría adquirirlo?",
            "🌟 Así es, *[PRODUCTO]* es sorprendente. ¿Quieres más información?"
],
"🙏": [
            "🙏 ¡Gracias a ti! Para cualquier duda sobre *[PRODUCTO]*, aquí estoy",
            "🤝 ¡Aprecio tu mensaje! Cuenta conmigo para *[PRODUCTO]*",
            "✨ Gracias por comunicarte. ¿Necesitas algo más de *[PRODUCTO]*?",
            "💫 ¡Un placer! Estoy aquí para lo que necesites sobre *[PRODUCTO]*",
            "🌟 Gracias a ti por tu interés. ¿Te ayudo con algo más?"
            "🙏 ¡Gracias a ti! Para cualquier duda sobre *[PRODUCTO]*, aquí estamos",
            "🤝 Apreciamos tu mensaje. ¿Necesitas información adicional de *[PRODUCTO]*?",
            "✨ Gracias por comunicarte. ¿Te podemos ayudar con algo más de *[PRODUCTO]*?",
            "💫 ¡Un placer! Estamos aquí para lo que necesites sobre *[PRODUCTO]*",
            "🌟 Gracias por tu interés. ¿Te gustaría conocer más de *[PRODUCTO]*?"
],
"😂": [
            "😂 Me alegra que te cause gracia *[PRODUCTO]*. ¿Quieres ver más productos?",
            "😄 ¡Qué risa! ¿Te gustaría conocer otros productos similares?",
            "🤣 Me encanta tu sentido del humor. ¿Te interesa *[PRODUCTO]*?",
            "😆 ¡Buenísimo! Si quieres más info de *[PRODUCTO]*, aquí estoy",
            "🎉 Me alegra sacarte una sonrisa. ¿Te cuento más de *[PRODUCTO]*?"
            "😂 Nos alegra que te cause interés *[PRODUCTO]*. ¿Quieres ver más productos similares?",
            "😄 ¡Qué bien! ¿Te gustaría conocer otros productos de nuestra línea?",
            "🤣 Gracias por tu mensaje. ¿Te interesa *[PRODUCTO]* o algún otro producto?",
            "😆 ¡Buenísimo! Si quieres más información de *[PRODUCTO]*, aquí estamos",
            "🎉 Nos da gusto tu interés. ¿Te contamos más de *[PRODUCTO]*?"
]
},
respuestas_consultas: {
generica: [
            "👕 *[PRODUCTO]* - [DESCRIPCION] - 💵 [PRECIO]",
            "✨ *[PRODUCTO]*: [DESCRIPCION]. Precio: 💵 [PRECIO]",
            "👕 *[PRODUCTO]* - [DESCRIPCION]. Precio: 💵 [PRECIO]",
            "✨ *[PRODUCTO]*: [DESCRIPCION]. Valor: 💵 [PRECIO]",
"📦 *[PRODUCTO]* disponible. [DESCRIPCION] - 💵 [PRECIO]",
            "🎁 *[PRODUCTO]*: [DESCRIPCION]. Solo 💵 [PRECIO]",
            "🌟 *[PRODUCTO]* - [DESCRIPCION] - 💵 [PRECIO]. ¿Te interesa?"
            "🎁 *[PRODUCTO]*: [DESCRIPCION]. Precio: 💵 [PRECIO]",
            "🌟 *[PRODUCTO]* - [DESCRIPCION] - 💵 [PRECIO]. ¿Te gustaría conocer más?"
],
precio: [
            "La *[PRODUCTO]* está a 💵 [PRECIO]. ¿Te interesa?",
            "💰 Precio de *[PRODUCTO]*: 💵 [PRECIO]. ¿Quieres una?",
            "💵 *[PRODUCTO]* cuesta 💵 [PRECIO]. ¿Te animas?",
            "El valor de *[PRODUCTO]* es 💵 [PRECIO]. Escríbeme si quieres",
            "💲 *[PRODUCTO]*: 💵 [PRECIO]. Estoy a tus órdenes"
            "*[PRODUCTO]* tiene un precio de 💵 [PRECIO]. ¿Te gustaría adquirir uno?",
            "💰 Valor de *[PRODUCTO]*: 💵 [PRECIO]. ¿Te interesa?",
            "💵 *[PRODUCTO]*: 💵 [PRECIO]. ¿Quieres más información?",
            "El precio de *[PRODUCTO]* es 💵 [PRECIO]. Estamos a tus órdenes",
            "💲 *[PRODUCTO]*: 💵 [PRECIO]. ¿Te gustaría obtener uno?"
],
descripcion: [
"📝 *[PRODUCTO]*: [DESCRIPCION]. Precio: 💵 [PRECIO]",
"✨ Características de *[PRODUCTO]*: [DESCRIPCION]. Valor: 💵 [PRECIO]",
            "🔍 *[PRODUCTO]*: [DESCRIPCION]. ¿Te gustaría adquirirla?",
            "📋 *[PRODUCTO]*: [DESCRIPCION]. Solo 💵 [PRECIO]",
            "🔍 *[PRODUCTO]*: [DESCRIPCION]. ¿Te gustaría adquirirlo?",
            "📋 *[PRODUCTO]*: [DESCRIPCION]. Precio: 💵 [PRECIO]",
"🎯 *[PRODUCTO]*: [DESCRIPCION]. ¿Quieres más información?"
]
},
palabras_clave_respondibles: {
        precio: ["precio", "cuesta", "valor", "$$", "💰", "💵", "costó", "precio?", "cuánto", "cuanto", "costo", "precio", "vale", "valor?"],
        info: ["info", "información", "características", "descripción", "qué es", "detalles", "descripcion", "caracteristicas", "como es", "que tiene"],
        generica: ["más", "info", "información", "quiero saber", "dime", "mas", "informacion", "saber", "conocer", "interesa", "me interesa"]
        precio: ["precio", "cuesta", "valor", "$$", "💰", "💵", "costó", "precio?", "cuánto", "cuanto", "costo", "vale", "valor?", "precio", "costo"],
        info: ["info", "información", "características", "descripción", "qué es", "detalles", "descripcion", "caracteristicas", "como es", "que tiene", "especificaciones"],
        generica: ["más", "info", "información", "quiero saber", "dime", "mas", "informacion", "saber", "conocer", "interesa", "me interesa", "quisiera saber"]
},
    // NUEVA CONFIGURACIÓN PARA INMEDIATEZ
    // CONFIGURACIÓN PARA INMEDIATEZ
delay_respuesta_min: 1, // segundos mínimos antes de responder (simular typing)
delay_respuesta_max: 3  // segundos máximos antes de responder
};
@@ -1564,7 +1562,7 @@ async function enviarCSVporWhatsApp(sock, remitente, grupos) {
}

// ============================================
// NUEVAS FUNCIONES PARA INTERACCIONES (OPTIMIZADAS)
// NUEVAS FUNCIONES PARA INTERACCIONES (VERSIÓN 46.0 - CON MENCIONES)
// ============================================

// Función para obtener un texto aleatorio de un array de sinónimos
@@ -1589,7 +1587,7 @@ function extraerTextoDeMensaje(mensaje) {
return '';
}

// Función optimizada para verificar si el bot es mencionado
// Función para verificar si el bot es mencionado (optimizada)
function botEsMencionado(mensaje, botId) {
if (!mensaje || !botId) return false;

@@ -1605,6 +1603,22 @@ function botEsMencionado(mensaje, botId) {
return false;
}

// NUEVA FUNCIÓN: Verificar si el mensaje es una respuesta a un mensaje del bot
function esRespuestaABot(mensaje, botId) {
    try {
        const contextInfo = mensaje?.extendedTextMessage?.contextInfo || 
                           mensaje?.imageMessage?.contextInfo ||
                           mensaje?.videoMessage?.contextInfo;
        
        if (!contextInfo?.quotedMessage) return false;
        
        // Verificar si el mensaje citado es del bot
        return contextInfo.participant === botId || contextInfo.quotedParticipant === botId;
    } catch (error) {
        return false;
    }
}

// Función optimizada para obtener producto desde mensaje citado (con fallback)
async function obtenerProductoDesdeMensajeCitado(sock, mensaje) {
try {
@@ -1718,7 +1732,7 @@ ${datosAlerta.enlace}
}
}

// Función para procesar reacciones a mensajes (optimizada)
// Función para procesar reacciones a mensajes (VERSIÓN 46.0 - CON MENCIÓN)
async function procesarReaccion(sock, mensaje) {
try {
// Verificar si es una reacción
@@ -1727,6 +1741,7 @@ async function procesarReaccion(sock, mensaje) {
const reaccion = mensaje.message.reactionMessage;
const emoji = reaccion.text;
const keyOriginal = reaccion.key;
        const usuarioId = mensaje.key.participant || mensaje.key.remoteJid;

// Verificar si la reacción es a un mensaje del bot
if (!keyOriginal?.fromMe) return false;
@@ -1752,13 +1767,19 @@ async function procesarReaccion(sock, mensaje) {
let respuesta = obtenerTextoAleatorio(respuestasReaccion);
respuesta = respuesta.replace('[PRODUCTO]', nombreProducto);

        // Añadir mención al usuario
        const mensajeConMencion = `@${usuarioId.split('@')[0]} ${respuesta}`;
        
// Simular typing antes de responder
const delayTyping = Math.floor(Math.random() * (CONFIG.delay_respuesta_max - CONFIG.delay_respuesta_min + 1) + CONFIG.delay_respuesta_min);
await simularTyping(sock, keyOriginal.remoteJid, delayTyping);

        // Enviar respuesta en el mismo grupo
        await sock.sendMessage(keyOriginal.remoteJid, { text: respuesta });
        guardarLogLocal(`   ✅ Respuesta a reacción ${emoji} para producto: ${nombreProducto}`);
        // Enviar respuesta en el mismo grupo con mención
        await sock.sendMessage(keyOriginal.remoteJid, { 
            text: mensajeConMencion,
            mentions: [usuarioId]
        });
        guardarLogLocal(`   ✅ Respuesta a reacción ${emoji} para producto: ${nombreProducto} (con mención a @${usuarioId.split('@')[0]})`);

return true;
} catch (error) {
@@ -1828,7 +1849,7 @@ async function procesarComandoPrioritario(sock, cmd, remitente, url_sheets) {
// ============================================
async function iniciarWhatsApp() {
console.log('====================================');
    console.log('🤖 BOT WHATSAPP - VERSIÓN 45.0 (INMEDIATEZ + INTERACCIONES)');
    console.log('🤖 BOT WHATSAPP - VERSIÓN 46.0 (MENCIONES + TEXTOS PROFESIONALES)');
console.log('====================================\n');
console.log('⏰ Actualización de agenda: 6:00 AM (solo 1 vez al día)');
console.log('✍️  Typing adaptativo activado');
@@ -1855,13 +1876,12 @@ async function iniciarWhatsApp() {
console.log('   - Mide el tiempo real de cada envío');
console.log('   - Ajusta la espera automáticamente');
console.log('   - No acumula retrasos en el día');
    console.log('💬 **SISTEMA DE INTERACCIONES OPTIMIZADO**');
    console.log('   - ✅ PROCESAMIENTO INMEDIATO de mensajes entrantes');
    console.log('   - ✅ Detecta menciones al bot en grupos (@bot)');
    console.log('   - ✅ Detecta respuestas a mensajes del bot');
    console.log('   - ✅ Responde automáticamente a consultas de precio/info');
    console.log('   - ✅ Alerta al admin con enlace wa.me para preguntas no respondibles');
    console.log('   - ✅ Detecta reacciones (👍❤️😮🙏😂) y responde en el grupo');
    console.log('💬 **SISTEMA DE INTERACCIONES VERSIÓN 46.0**');
    console.log('   - ✅ Responde a RESPUESTAS (sin @) y MENCIONES (con @)');
    console.log('   - ✅ MENCIONA al usuario en respuestas a reacciones');
    console.log('   - ✅ MENCIONA al usuario en respuestas a consultas');
    console.log('   - ✅ TEXTOS PROFESIONALES para negocios');
    console.log('   - ✅ Sin artículos incorrectos (usa solo *[PRODUCTO]*)');
console.log('   - ✅ Simula typing antes de responder (1-3 segundos)');
console.log('   - ✅ Usa sinónimos para variedad en respuestas\n');

@@ -2006,7 +2026,7 @@ async function iniciarWhatsApp() {
});

// ============================================
        // EVENTO DE MENSAJES (VERSIÓN 45.0 - OPTIMIZADA PARA INMEDIATEZ)
        // EVENTO DE MENSAJES (VERSIÓN 46.0 - CON DETECCIÓN DE RESPUESTAS SIN @)
// ============================================
sock.ev.on('messages.upsert', async (m) => {
const mensaje = m.messages[0];
@@ -2034,10 +2054,14 @@ async function iniciarWhatsApp() {
}

// ============================================
            // PARA GRUPOS: VERIFICAR MENCIÓN (rápido)
            // PARA GRUPOS: VERIFICAR SI DEBEMOS PROCESAR
// ============================================
if (esGrupo) {
                if (!botEsMencionado(mensaje.message, sock.user.id)) {
                const esMencion = botEsMencionado(mensaje.message, sock.user.id);
                const esRespuesta = esRespuestaABot(mensaje, sock.user.id);
                
                // Solo procesamos si es mención O es respuesta a un mensaje del bot
                if (!esMencion && !esRespuesta) {
mensajesEnProcesamiento.delete(mensajeId);
return;
}
@@ -2094,7 +2118,7 @@ async function iniciarWhatsApp() {
});
}

                                let mensaje = `📊 *ESTADO DEL BOT - VERSIÓN 45.0*\n\n` +
                                let mensaje = `📊 *ESTADO DEL BOT - VERSIÓN 46.0*\n\n` +
`⏰ MODO: setTimeout + Delay inteligente\n` +
`📅 Última actualización: ${agenda.ultima_actualizacion || 'N/A'}\n` +
`📋 Grupos totales: ${total}\n` +
@@ -2104,7 +2128,7 @@ async function iniciarWhatsApp() {
`⏱️  Delay mensajes: ${CONFIG.tiempo_entre_mensajes_min}-${CONFIG.tiempo_entre_mensajes_max} seg (inteligente)\n` +
`📦 Múltiples archivos: ACTIVADO\n` +
`⏱️ Delay entre archivos: ${CONFIG.delay_entre_archivos}s\n` +
                                              `💬 Interacciones: ACTIVADO (inmediatez optimizada)\n` +
                                              `💬 Interacciones: VERSIÓN 46.0 (menciones en respuestas + textos profesionales)\n` +
`✍️  Typing adaptativo: activado\n` +
`🔗 Link Previews: CON IMAGEN (caché local)\n` +
`📚 Data Store: ACTIVADO (extracción local)\n` +
@@ -2141,7 +2165,7 @@ async function iniciarWhatsApp() {
});
}

                            let mensaje = `📊 *ESTADO DEL BOT - VERSIÓN 45.0*\n\n` +
                            let mensaje = `📊 *ESTADO DEL BOT - VERSIÓN 46.0*\n\n` +
`⏰ MODO: setTimeout + Delay inteligente\n` +
`📅 Última actualización: ${agenda.ultima_actualizacion || 'N/A'}\n` +
`📋 Grupos totales: ${total}\n` +
@@ -2151,7 +2175,7 @@ async function iniciarWhatsApp() {
`⏱️  Delay mensajes: ${CONFIG.tiempo_entre_mensajes_min}-${CONFIG.tiempo_entre_mensajes_max} seg (inteligente)\n` +
`📦 Múltiples archivos: ACTIVADO\n` +
`⏱️ Delay entre archivos: ${CONFIG.delay_entre_archivos}s\n` +
                                          `💬 Interacciones: ACTIVADO (inmediatez optimizada)\n` +
                                          `💬 Interacciones: VERSIÓN 46.0 (menciones en respuestas + textos profesionales)\n` +
`✍️  Typing adaptativo: activado\n` +
`🔗 Link Previews: CON IMAGEN (caché local)\n` +
`📚 Data Store: ACTIVADO (extracción local)\n` +
@@ -2179,7 +2203,7 @@ async function iniciarWhatsApp() {
}

// ============================================
            // PROCESAR INTERACCIONES (RESPUESTAS A MENSAJES)
            // PROCESAR INTERACCIONES (RESPUESTAS A MENSAJES) - VERSIÓN 46.0 CON MENCIÓN
// ============================================
setImmediate(async () => {
try {
@@ -2201,17 +2225,24 @@ async function iniciarWhatsApp() {

// Clasificar la consulta del usuario
const tipoConsulta = clasificarConsulta(texto);
                    const usuarioId = mensaje.key.participant || remitente;

if (tipoConsulta !== 'no_respondible') {
// Generar respuesta automática
const respuesta = generarRespuestaAutomatica(tipoConsulta, nombreProducto, datosProducto);
if (respuesta) {
                            // Añadir mención al usuario
                            const mensajeConMencion = `@${usuarioId.split('@')[0]} ${respuesta}`;
                            
// Simular typing antes de responder
const delayTyping = Math.floor(Math.random() * (CONFIG.delay_respuesta_max - CONFIG.delay_respuesta_min + 1) + CONFIG.delay_respuesta_min);
await simularTyping(sock, remitente, delayTyping);

                            await sock.sendMessage(remitente, { text: respuesta });
                            guardarLogLocal(`   ✅ Respuesta automática enviada (${tipoConsulta})`);
                            await sock.sendMessage(remitente, { 
                                text: mensajeConMencion,
                                mentions: [usuarioId]
                            });
                            guardarLogLocal(`   ✅ Respuesta automática enviada (${tipoConsulta}) con mención a @${usuarioId.split('@')[0]}`);
}
} else {
// Enviar alerta al admin
@@ -2254,11 +2285,11 @@ async function iniciarWhatsApp() {
console.log('⚡ **INMEDIATEZ OPTIMIZADA**');
console.log('   - Los mensajes se procesan inmediatamente al llegar');
console.log('   - Simulación de typing antes de responder (1-3 segundos)');
        console.log('💬 **INTERACCIONES ACTIVADAS**');
        console.log('   - En grupos: menciona al bot con @ para activar');
        console.log('   - Responde automáticamente a consultas de precio/info');
        console.log('   - Las preguntas no respondibles alertan al admin');
        console.log('   - Reacciona con 👍❤️😮🙏😂 y el bot responderá\n');
        console.log('💬 **INTERACCIONES VERSIÓN 46.0**');
        console.log('   - Responde a RESPUESTAS (sin @) y MENCIONES (con @)');
        console.log('   - MENCIONA al usuario en todas las respuestas');
        console.log('   - TEXTOS PROFESIONALES para negocios');
        console.log('   - Reacciona con 👍❤️😮🙏😂 y el bot responderá mencionándote\n');

} catch (error) {
guardarLogLocal(`❌ ERROR FATAL: ${error.message}`);
