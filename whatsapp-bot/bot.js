// ============================================
// BOT DE WHATSAPP PARA TERMUX
// Versión: 43.0 - SPINTEX LIMPIO + TABLA DE ARCHIVOS + MÚLTIPLES ARCHIVOS
// Versión: 44.0 - INTERACCIONES + REACCIONES + MENCIONES
// + MEJORA 1: Keep-Alive cada 25 segundos
// + MEJORA 2: Ignorar mensajes de grupos
// + MEJORA 2: Ignorar mensajes de grupos (sin mención)
// + NUEVO: Sistema de SpinTex y SpinEmoji (CORREGIDO)
// + NUEVO: Tabla de correspondencia producto-archivo
// + VERSIÓN 42.0: Modo Ahorro de Batería (SOLO horarios programados con setTimeout)
// + MEJORA: Al actualizar, reprograma todos los envíos
// + MEJORA: 1 cron job a las 6am solo para actualizar agenda
// + VERSIÓN 43.0: Múltiples archivos por producto
//   - Busca TODOS los archivos que coincidan con el nombre del producto
//   - Los ordena: imágenes primero, luego videos, luego audios, luego documentos
//   - El texto del mensaje SOLO va con la PRIMERA imagen
//   - Los archivos siguientes llevan textos personalizados por tipo
//   - Delay inteligente entre grupos que considera el tiempo real de envío
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
// ============================================

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, getUrlInfo, Browsers } = require('@whiskeysockets/baileys');
@@ -49,13 +54,86 @@ const CONFIG = {
dias_retencion_store: 30,
carpeta_multimedia: '/storage/emulated/0/WhatsAppBot',
tiempo_espera_grupos: 30000,
    // NUEVA CONFIGURACIÓN PARA MÚLTIPLES ARCHIVOS
    // CONFIGURACIÓN PARA MÚLTIPLES ARCHIVOS
delay_entre_archivos: 3, // segundos entre cada archivo del mismo grupo
textos_por_tipo: {
imagen: '', // El texto principal ya se usa con la primera imagen
video: '🎬 Te dejo un video de *[PRODUCTO]*',
audio: '🔊 Escucha más detalles de *[PRODUCTO]*',
documento: '📄 Aquí tienes más información de *[PRODUCTO]*'
    },
    // NUEVA CONFIGURACIÓN PARA INTERACCIONES
    textos_sinonimos: {
        saludos: ["¡Hola! 👋", "¡Qué tal! ✨", "¡Buen día! ☀️", "¡Hola, ¿cómo estás? 😊", "¡Un gusto saludarte! 🤝"],
        agradecimientos: ["¡Gracias! 🙏", "Muchas gracias 😊", "Te lo agradezco ✨", "Gracias totales 🙌", "¡Mil gracias! 🌟"],
        ofertas: ["¿Te interesa? 🤔", "¿Quieres una? 🛍️", "¿Te gustaría adquirirla? 🎁", "¿La quieres para ti? ✨", "¿Te animas? 💫"],
        contacto: ["Estoy a tus órdenes 🤝", "Aquí estoy para ayudarte 👋", "Puedes escribirme cuando quieras 📱", "Para lo que necesites, aquí estoy 💬", "Cuenta conmigo para lo que necesites 🌟"],
        despedidas: ["¡Hasta luego! 👋", "¡Que tengas buen día! ☀️", "¡Nos vemos pronto! ✨", "¡Cuidate mucho! 🙏", "¡Hasta la próxima! 🌟"]
    },
    respuestas_reacciones: {
        "👍": [
            "👋 ¡Gracias por el like! La *[PRODUCTO]* está disponible. ¿Te interesa?",
            "👍 ¡Qué bueno que te gustó! La *[PRODUCTO]* es excelente. ¿Quieres una?",
            "🙌 Me alegra que te guste *[PRODUCTO]*. Estoy a tus órdenes",
            "✨ ¡Gracias! La *[PRODUCTO]* es de las más vendidas. ¿Te animas?",
            "👏 ¡Aprecio tu like! Para cualquier duda sobre *[PRODUCTO]*, aquí estoy"
        ],
        "❤️": [
            "❤️ ¡Gracias por el corazón! Me encanta que te guste *[PRODUCTO]*",
            "💖 ¡Qué bonito! *[PRODUCTO]* es especial. ¿Quieres más información?",
            "💝 ¡Corazón recibido! ¿Te gustaría adquirir *[PRODUCTO]*?",
            "💗 Me alegra mucho que te guste *[PRODUCTO]*. Estoy aquí para ayudarte",
            "💕 ¡Gracias! *[PRODUCTO]* tiene muchos admiradores. ¿Te cuento más?"
        ],
        "😮": [
            "😮 ¿Sorprendido? *[PRODUCTO]* es increíble, ¿quieres conocer más?",
            "😲 ¡Vaya, impactante! ¿Te gustaría saber más de *[PRODUCTO]*?",
            "🤯 Increíble, ¿verdad? *[PRODUCTO]* tiene muchos secretos. ¿Te interesa?",
            "😱 ¡Me encanta tu reacción! *[PRODUCTO]* es único. ¿Quieres una?",
            "🌟 Así es, *[PRODUCTO]* es sorprendente. ¿Te animas a probarlo?"
        ],
        "🙏": [
            "🙏 ¡Gracias a ti! Para cualquier duda sobre *[PRODUCTO]*, aquí estoy",
            "🤝 ¡Aprecio tu mensaje! Cuenta conmigo para *[PRODUCTO]*",
            "✨ Gracias por comunicarte. ¿Necesitas algo más de *[PRODUCTO]*?",
            "💫 ¡Un placer! Estoy aquí para lo que necesites sobre *[PRODUCTO]*",
            "🌟 Gracias a ti por tu interés. ¿Te ayudo con algo más?"
        ],
        "😂": [
            "😂 Me alegra que te cause gracia *[PRODUCTO]*. ¿Quieres ver más productos?",
            "😄 ¡Qué risa! ¿Te gustaría conocer otros productos similares?",
            "🤣 Me encanta tu sentido del humor. ¿Te interesa *[PRODUCTO]*?",
            "😆 ¡Buenísimo! Si quieres más info de *[PRODUCTO]*, aquí estoy",
            "🎉 Me alegra sacarte una sonrisa. ¿Te cuento más de *[PRODUCTO]*?"
        ]
    },
    respuestas_consultas: {
        generica: [
            "👕 *[PRODUCTO]* - [DESCRIPCION] - 💵 [PRECIO]",
            "✨ *[PRODUCTO]*: [DESCRIPCION]. Precio: 💵 [PRECIO]",
            "📦 *[PRODUCTO]* disponible. [DESCRIPCION] - 💵 [PRECIO]",
            "🎁 *[PRODUCTO]*: [DESCRIPCION]. Solo 💵 [PRECIO]",
            "🌟 *[PRODUCTO]* - [DESCRIPCION] - 💵 [PRECIO]. ¿Te interesa?"
        ],
        precio: [
            "La *[PRODUCTO]* está a 💵 [PRECIO]. ¿Te interesa?",
            "💰 Precio de *[PRODUCTO]*: 💵 [PRECIO]. ¿Quieres una?",
            "💵 *[PRODUCTO]* cuesta 💵 [PRECIO]. ¿Te animas?",
            "El valor de *[PRODUCTO]* es 💵 [PRECIO]. Escríbeme si quieres",
            "💲 *[PRODUCTO]*: 💵 [PRECIO]. Estoy a tus órdenes"
        ],
        descripcion: [
            "📝 *[PRODUCTO]*: [DESCRIPCION]. Precio: 💵 [PRECIO]",
            "✨ Características de *[PRODUCTO]*: [DESCRIPCION]. Valor: 💵 [PRECIO]",
            "🔍 *[PRODUCTO]*: [DESCRIPCION]. ¿Te gustaría adquirirla?",
            "📋 *[PRODUCTO]*: [DESCRIPCION]. Solo 💵 [PRECIO]",
            "🎯 *[PRODUCTO]*: [DESCRIPCION]. ¿Quieres más información?"
        ]
    },
    palabras_clave_respondibles: {
        precio: ["precio", "cuesta", "valor", "$$", "💰", "💵", "costó", "precio?"],
        info: ["info", "información", "características", "descripción", "qué es", "detalles"],
        generica: ["más", "info", "información", "quiero saber", "dime"]
}
};

@@ -1477,6 +1555,186 @@ async function enviarCSVporWhatsApp(sock, remitente, grupos) {
}
}

// ============================================
// NUEVAS FUNCIONES PARA INTERACCIONES
// ============================================

// Función para obtener un texto aleatorio de un array de sinónimos
function obtenerTextoAleatorio(arrayTextos) {
    if (!arrayTextos || arrayTextos.length === 0) return '';
    const indice = Math.floor(Math.random() * arrayTextos.length);
    return arrayTextos[indice];
}

// Función para obtener el producto desde un mensaje citado
async function obtenerProductoDesdeMensajeCitado(sock, mensaje) {
    try {
        if (!mensaje.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
            return null;
        }
        
        const quotedMsg = mensaje.message.extendedTextMessage.contextInfo.quotedMessage;
        let textoOriginal = '';
        
        if (quotedMsg.conversation) {
            textoOriginal = quotedMsg.conversation;
        } else if (quotedMsg.extendedTextMessage?.text) {
            textoOriginal = quotedMsg.extendedTextMessage.text;
        } else if (quotedMsg.imageMessage?.caption) {
            textoOriginal = quotedMsg.imageMessage.caption;
        } else if (quotedMsg.videoMessage?.caption) {
            textoOriginal = quotedMsg.videoMessage.caption;
        }
        
        return extraerNombreProducto(textoOriginal);
    } catch (error) {
        guardarLogLocal(`   ⚠️ Error obteniendo producto de mensaje citado: ${error.message}`);
        return null;
    }
}

// Función para clasificar la consulta del usuario
function clasificarConsulta(texto) {
    const textoLower = texto.toLowerCase();
    
    // Palabras clave para precio
    for (const palabra of CONFIG.palabras_clave_respondibles.precio) {
        if (textoLower.includes(palabra)) {
            return 'precio';
        }
    }
    
    // Palabras clave para información
    for (const palabra of CONFIG.palabras_clave_respondibles.info) {
        if (textoLower.includes(palabra)) {
            return 'descripcion';
        }
    }
    
    // Palabras clave genéricas
    for (const palabra of CONFIG.palabras_clave_respondibles.generica) {
        if (textoLower.includes(palabra)) {
            return 'generica';
        }
    }
    
    return 'no_respondible';
}

// Función para obtener datos completos del producto desde el caché
function obtenerDatosProducto(nombreProducto) {
    if (!nombreProducto || productosCache.length === 0) return null;
    
    const producto = productosCache.find(p => 
        p.producto.toLowerCase() === nombreProducto.toLowerCase()
    );
    
    return producto;
}

// Función para generar respuesta automática según tipo de consulta
function generarRespuestaAutomatica(tipoConsulta, nombreProducto, datosProducto) {
    if (!nombreProducto || !datosProducto) return null;
    
    const opcionesRespuesta = CONFIG.respuestas_consultas[tipoConsulta];
    if (!opcionesRespuesta || opcionesRespuesta.length === 0) return null;
    
    // Seleccionar una respuesta aleatoria
    let respuesta = obtenerTextoAleatorio(opcionesRespuesta);
    
    // Reemplazar placeholders
    respuesta = respuesta.replace('[PRODUCTO]', nombreProducto);
    respuesta = respuesta.replace('[DESCRIPCION]', datosProducto.descripcion || '');
    respuesta = respuesta.replace('[PRECIO]', datosProducto.precio || '');
    
    return respuesta;
}

// Función para generar enlace wa.me para alerta al admin
function generarEnlaceWaMe(numeroCliente, nombreProducto, preguntaCliente) {
    const numeroLimpio = numeroCliente.split('@')[0].replace(/[^0-9]/g, '');
    const textoRespuesta = `Hola, sobre *${nombreProducto}*: ${preguntaCliente}`;
    const textoCodificado = encodeURIComponent(textoRespuesta);
    return `wa.me/${numeroLimpio}?text=${textoCodificado}`;
}

// Función para enviar alerta al admin
async function enviarAlertaAdmin(sock, remitenteAdmin, datosAlerta) {
    try {
        const mensajeAlerta = `━━━━━━━━━━━━━━━━━━━━━━
🔔 CONSULTA PENDIENTE

📦 PRODUCTO: *${datosAlerta.producto}*
👤 CLIENTE: ${datosAlerta.clienteNombre} (${datosAlerta.clienteNumero})
💬 PREGUNTA: "${datosAlerta.pregunta}"
📍 LUGAR: ${datosAlerta.lugar}
⏱️ Hace ${datosAlerta.tiempo}

👉 RESPUESTA RÁPIDA:
${datosAlerta.enlace}

━━━━━━━━━━━━━━━━━━━━━━`;

        await sock.sendMessage(remitenteAdmin, { text: mensajeAlerta });
        guardarLogLocal(`   ✅ Alerta enviada al admin para producto: ${datosAlerta.producto}`);
        return true;
    } catch (error) {
        guardarLogLocal(`   ❌ Error enviando alerta al admin: ${error.message}`);
        return false;
    }
}

// Función para procesar reacciones a mensajes
async function procesarReaccion(sock, mensaje) {
    try {
        // Verificar si es una reacción
        if (!mensaje.message?.reactionMessage) return false;
        
        const reaccion = mensaje.message.reactionMessage;
        const emoji = reaccion.text;
        const keyOriginal = reaccion.key;
        
        // Verificar si la reacción es a un mensaje del bot
        if (!keyOriginal?.fromMe) return false;
        
        // Verificar si el emoji está en nuestra lista de respuestas
        const respuestasReaccion = CONFIG.respuestas_reacciones[emoji];
        if (!respuestasReaccion) return false;
        
        // Obtener el mensaje original al que reaccionaron
        const mensajeOriginal = await store.loadMessage(keyOriginal.remoteJid, keyOriginal.id);
        if (!mensajeOriginal) return false;
        
        // Extraer producto del mensaje original
        let textoOriginal = '';
        if (mensajeOriginal.message?.conversation) {
            textoOriginal = mensajeOriginal.message.conversation;
        } else if (mensajeOriginal.message?.extendedTextMessage?.text) {
            textoOriginal = mensajeOriginal.message.extendedTextMessage.text;
        } else if (mensajeOriginal.message?.imageMessage?.caption) {
            textoOriginal = mensajeOriginal.message.imageMessage.caption;
        } else if (mensajeOriginal.message?.videoMessage?.caption) {
            textoOriginal = mensajeOriginal.message.videoMessage.caption;
        }
        
        const nombreProducto = extraerNombreProducto(textoOriginal);
        if (!nombreProducto) return false;
        
        // Seleccionar respuesta aleatoria
        let respuesta = obtenerTextoAleatorio(respuestasReaccion);
        respuesta = respuesta.replace('[PRODUCTO]', nombreProducto);
        
        // Enviar respuesta en el mismo grupo
        await sock.sendMessage(keyOriginal.remoteJid, { text: respuesta });
        guardarLogLocal(`   ✅ Respuesta a reacción ${emoji} para producto: ${nombreProducto}`);
        
        return true;
    } catch (error) {
        guardarLogLocal(`   ❌ Error procesando reacción: ${error.message}`);
        return false;
    }
}

// ============================================
// SISTEMA DE COMANDOS PRIORITARIOS
// ============================================
@@ -1538,7 +1796,7 @@ async function procesarComandoPrioritario(sock, cmd, remitente, url_sheets) {
// ============================================
async function iniciarWhatsApp() {
console.log('====================================');
    console.log('🤖 BOT WHATSAPP - VERSIÓN 43.0 (MÚLTIPLES ARCHIVOS + DELAY INTELIGENTE)');
    console.log('🤖 BOT WHATSAPP - VERSIÓN 44.0 (INTERACCIONES + REACCIONES + MENCIONES)');
console.log('====================================\n');
console.log('⏰ Actualización de agenda: 6:00 AM (solo 1 vez al día)');
console.log('✍️  Typing adaptativo activado');
@@ -1557,14 +1815,21 @@ async function iniciarWhatsApp() {
console.log('🌐 Browser: Ubuntu (1ra vez) / macOS (sesiones existentes)');
console.log('📝 Logs locales (carpeta logs/)');
console.log('🎲 **SPINTEX Y SPINEMOJI CORREGIDOS PARA BAILEYS**');
    console.log('📦 **NUEVO: MÚLTIPLES ARCHIVOS POR PRODUCTO**');
    console.log('📦 **MÚLTIPLES ARCHIVOS POR PRODUCTO**');
console.log('   - Busca TODOS los archivos que coincidan con el nombre');
console.log('   - Orden: imágenes → videos → audios → documentos');
console.log('   - Texto personalizado para cada tipo de archivo');
    console.log('⏱️ **NUEVO: DELAY INTELIGENTE ENTRE GRUPOS**');
    console.log('⏱️ **DELAY INTELIGENTE ENTRE GRUPOS**');
console.log('   - Mide el tiempo real de cada envío');
console.log('   - Ajusta la espera automáticamente');
    console.log('   - No acumula retrasos en el día\n');
    console.log('   - No acumula retrasos en el día');
    console.log('💬 **NUEVO: SISTEMA DE INTERACCIONES**');
    console.log('   - ✅ Detecta menciones al bot en grupos (@bot)');
    console.log('   - ✅ Detecta respuestas a mensajes del bot');
    console.log('   - ✅ Responde automáticamente a consultas de precio/info');
    console.log('   - ✅ Alerta al admin con enlace wa.me para preguntas no respondibles');
    console.log('   - ✅ Detecta reacciones (👍❤️😮🙏😂) y responde en el grupo');
    console.log('   - ✅ Usa sinónimos para variedad en respuestas\n');

const url_sheets = leerURL();
if (!url_sheets) {
@@ -1707,12 +1972,7 @@ async function iniciarWhatsApp() {
});

// ============================================
        // ELIMINADO: El cron job que verificaba cada minuto
        // ELIMINADO: Los cron jobs de sincronización de grupos
        // ============================================

        // ============================================
        // EVENTO DE MENSAJES
        // EVENTO DE MENSAJES (MODIFICADO CON NUEVAS FUNCIONALIDADES)
// ============================================
sock.ev.on('messages.upsert', async (m) => {
const mensaje = m.messages[0];
@@ -1722,21 +1982,44 @@ async function iniciarWhatsApp() {
}

const remitente = mensaje.key.remoteJid;
            const esGrupo = remitente.includes('@g.us');
            const esPrivado = !esGrupo;

            // ============================================
            // PROCESAR REACCIONES (para grupos y privado)
            // ============================================
            if (mensaje.message?.reactionMessage) {
                await procesarReaccion(sock, mensaje);
                return;
            }

            // >>> MEJORA 2: Ignorar mensajes de grupos completamente <<<
            if (remitente && remitente.includes('@g.us')) {
                return; // No procesar mensajes de grupos
            // ============================================
            // PARA GRUPOS: SOLO PROCESAR SI HAY MENCIÓN
            // ============================================
            if (esGrupo) {
                // Verificar si el bot es mencionado
                const mentionedJid = mensaje.message?.extendedTextMessage?.contextInfo?.mentionedJid;
                const botMentioned = mentionedJid && mentionedJid.includes(sock.user.id);
                
                if (!botMentioned) {
                    return; // Ignorar mensajes de grupo sin mención
                }
}
            // >>> FIN MEJORA 2 <<<

            // Obtener texto del mensaje
const texto = mensaje.message.conversation || 
                         mensaje.message.extendedTextMessage?.text || '';
                         mensaje.message.extendedTextMessage?.text || 
                         mensaje.message.imageMessage?.caption ||
                         mensaje.message.videoMessage?.caption || '';

if (!texto || texto.trim() === '') {
return;
}
            
            if (remitente && !remitente.includes('@g.us') && texto) {

            // ============================================
            // COMANDOS PRIORITARIOS (solo en privado)
            // ============================================
            if (esPrivado) {
const cmd = texto.toLowerCase().trim();

console.log('\n═══════════════════════════════════════════════');
@@ -1770,7 +2053,7 @@ async function iniciarWhatsApp() {
});
}

                            let mensaje = `📊 *ESTADO DEL BOT - VERSIÓN 43.0*\n\n` +
                            let mensaje = `📊 *ESTADO DEL BOT - VERSIÓN 44.0*\n\n` +
`⏰ MODO: setTimeout + Delay inteligente\n` +
`📅 Última actualización: ${agenda.ultima_actualizacion || 'N/A'}\n` +
`📋 Grupos totales: ${total}\n` +
@@ -1780,6 +2063,7 @@ async function iniciarWhatsApp() {
`⏱️  Delay mensajes: ${CONFIG.tiempo_entre_mensajes_min}-${CONFIG.tiempo_entre_mensajes_max} seg (inteligente)\n` +
`📦 Múltiples archivos: ACTIVADO\n` +
`⏱️ Delay entre archivos: ${CONFIG.delay_entre_archivos}s\n` +
                                          `💬 Interacciones: ACTIVADO (menciones, respuestas, reacciones)\n` +
`✍️  Typing adaptativo: activado\n` +
`🔗 Link Previews: CON IMAGEN (caché local)\n` +
`📚 Data Store: ACTIVADO (extracción local)\n` +
@@ -1815,7 +2099,7 @@ async function iniciarWhatsApp() {
});
}

                        let mensaje = `📊 *ESTADO DEL BOT - VERSIÓN 43.0*\n\n` +
                        let mensaje = `📊 *ESTADO DEL BOT - VERSIÓN 44.0*\n\n` +
`⏰ MODO: setTimeout + Delay inteligente\n` +
`📅 Última actualización: ${agenda.ultima_actualizacion || 'N/A'}\n` +
`📋 Grupos totales: ${total}\n` +
@@ -1825,6 +2109,7 @@ async function iniciarWhatsApp() {
`⏱️  Delay mensajes: ${CONFIG.tiempo_entre_mensajes_min}-${CONFIG.tiempo_entre_mensajes_max} seg (inteligente)\n` +
`📦 Múltiples archivos: ACTIVADO\n` +
`⏱️ Delay entre archivos: ${CONFIG.delay_entre_archivos}s\n` +
                                      `💬 Interacciones: ACTIVADO (menciones, respuestas, reacciones)\n` +
`✍️  Typing adaptativo: activado\n` +
`🔗 Link Previews: CON IMAGEN (caché local)\n` +
`📚 Data Store: ACTIVADO (extracción local)\n` +
@@ -1845,7 +2130,51 @@ async function iniciarWhatsApp() {

await sock.sendMessage(remitente, { text: mensaje });
}
                    return;
                }
            }

            // ============================================
            // PROCESAR INTERACCIONES (RESPUESTAS A MENSAJES)
            // ============================================
            
            // Obtener producto del mensaje citado
            const nombreProducto = await obtenerProductoDesdeMensajeCitado(sock, mensaje);
            if (!nombreProducto) return;

            guardarLogLocal(`   🔍 Producto detectado en mensaje citado: "${nombreProducto}"`);

            // Obtener datos completos del producto
            const datosProducto = obtenerDatosProducto(nombreProducto);
            if (!datosProducto) return;

            // Clasificar la consulta del usuario
            const tipoConsulta = clasificarConsulta(texto);

            if (tipoConsulta !== 'no_respondible') {
                // Generar respuesta automática
                const respuesta = generarRespuestaAutomatica(tipoConsulta, nombreProducto, datosProducto);
                if (respuesta) {
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
});

@@ -1854,13 +2183,18 @@ async function iniciarWhatsApp() {
console.log('   - "listagrupos" - ⚡ PRIORITARIO');
console.log('   - "status" - Ver estado del bot');
console.log('   - Presiona CTRL+C para salir\n');
        console.log('📦 **NUEVO: MÚLTIPLES ARCHIVOS POR PRODUCTO**');
        console.log('📦 **MÚLTIPLES ARCHIVOS POR PRODUCTO**');
console.log('   - Ejemplo: Si el producto es "gorra", busca:');
console.log('     gorra.jpg (imagen con texto)');
console.log('     gorra.mp4 (🎬 video de gorra)');
console.log('     gorra.pdf (📄 información de gorra)');
        console.log('⏱️ **NUEVO: DELAY INTELIGENTE**');
        console.log('   - Se adapta automáticamente al tiempo real de envío\n');
        console.log('⏱️ **DELAY INTELIGENTE**');
        console.log('   - Se adapta automáticamente al tiempo real de envío');
        console.log('💬 **INTERACCIONES ACTIVADAS**');
        console.log('   - En grupos: menciona al bot con @ para activar');
        console.log('   - Responde automáticamente a consultas de precio/info');
        console.log('   - Las preguntas no respondibles alertan al admin');
        console.log('   - Reacciona con 👍❤️😮🙏😂 y el bot responderá\n');

} catch (error) {
guardarLogLocal(`❌ ERROR FATAL: ${error.message}`);
