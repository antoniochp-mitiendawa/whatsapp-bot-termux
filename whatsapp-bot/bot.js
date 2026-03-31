// ============================================
// BOT DE WHATSAPP PARA TERMUX
// Versión: 47.0 - CORRECCIÓN PRECIO + MENCIONES GRUPOS + CONFIG NEGOCIO + ATENCIÓN PRIVADO
// Versión: 48.0 - CORRECCIÓN PRECIO + RESPUESTAS NEGOCIO + SINÓNIMOS
// + MEJORA 1: Keep-Alive cada 25 segundos
// + MEJORA 2: Ignorar mensajes de grupos (sin contexto)
// + MEJORA 3: PROCESAMIENTO INMEDIATO DE MENSAJES
@@ -12,6 +12,9 @@
// + NUEVO 9: CONFIGURACIÓN DE NEGOCIO DESDE GOOGLE SHEETS
// + NUEVO 10: ATENCIÓN EN PRIVADO SIN NECESIDAD DE MENCIÓN
// + NUEVO 11: RESPUESTAS CON FORMATO ELEGANTE (ENCABEZADO + DATOS NEGOCIO)
// + CORRECCIÓN 12: PRECIO AHORA SE MUESTRA CORRECTAMENTE (FIX UNDEFINED)
// + NUEVO 13: RESPUESTAS PARA DOMICILIO, HORARIO, TELÉFONO, ETC.
// + NUEVO 14: SINÓNIMOS AMPLIADOS PARA CONSULTAS DEL NEGOCIO
// ============================================

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, getUrlInfo, Browsers } = require('@whiskeysockets/baileys');
@@ -55,7 +58,7 @@ const CONFIG = {
audio: '🔊 Escucha más información sobre *[PRODUCTO]*',
documento: '📄 Aquí tienes más información de *[PRODUCTO]*'
},
    // CONFIGURACIÓN PARA INTERACCIONES (VERSIÓN 47.0 - CORREGIDA)
    // CONFIGURACIÓN PARA INTERACCIONES (VERSIÓN 48.0 - SINÓNIMOS AMPLIADOS)
textos_sinonimos: {
saludos: ["¡Hola! 👋", "¡Buen día! ☀️", "¡Hola, gracias por contactarnos! 😊", "¡Un gusto saludarte! 🤝", "¡Gracias por comunicarte! ✨"],
agradecimientos: ["¡Gracias! 🙏", "Te lo agradecemos ✨", "¡Gracias por tu interés! 🌟", "Agradecemos tu mensaje 💫", "¡Gracias por escribirnos!"],
@@ -128,6 +131,14 @@ const CONFIG = {
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
@@ -137,7 +148,7 @@ const CONFIG = {
// VARIABLES GLOBALES
// ============================================
let timersEnvios = []; // Array para guardar todos los setTimeout activos
let configNegocio = {}; // NUEVO: Configuración del negocio desde Sheets
let configNegocio = {}; // Configuración del negocio desde Sheets

// Crear carpetas necesarias
if (!fs.existsSync(CONFIG.carpeta_logs)) {
@@ -617,7 +628,7 @@ function recargarAgenda() {
}

// ============================================
// ACTUALIZAR AGENDA (VERSIÓN 47.0 - CON CONFIG NEGOCIO)
// ACTUALIZAR AGENDA (VERSIÓN 48.0 - CON CONFIG NEGOCIO)
// ============================================
async function actualizarAgenda(sock, url_sheets, origen = 'automático') {
try {
@@ -638,7 +649,9 @@ async function actualizarAgenda(sock, url_sheets, origen = 'automático') {
// NUEVO: Guardar configuración del negocio
if (data.negocio) {
configNegocio = data.negocio;
            guardarLogLocal(`🏢 Configuración de negocio cargada: ${configNegocio.razon_social || 'Sin nombre'}`);
            guardarLogLocal(`🏢 Configuración de negocio cargada: ${configNegocio.RAZON_SOCIAL || 'Sin nombre'}`);
            // Log para depuración
            guardarLogLocal(`📋 Datos de negocio: ${JSON.stringify(configNegocio)}`);
}

if (guardarAgendaLocal(data)) {
@@ -652,6 +665,10 @@ async function actualizarAgenda(sock, url_sheets, origen = 'automático') {
productosCache = data.productos;
ultimaActualizacionProductos = Date.now();
guardarLogLocal(`📦 Caché de productos actualizado desde Sheets: ${productosCache.length} productos`);
                // Log para depuración de precios
                productosCache.forEach(p => {
                    guardarLogLocal(`   📦 Producto: ${p.producto}, Precio: ${p.precio}`);
                });
}

// Si hay un socket activo, reprogramar todos los envíos
@@ -1563,7 +1580,7 @@ async function enviarCSVporWhatsApp(sock, remitente, grupos) {
}

// ============================================
// NUEVAS FUNCIONES PARA INTERACCIONES (VERSIÓN 47.0 - CORREGIDAS)
// NUEVAS FUNCIONES PARA INTERACCIONES (VERSIÓN 48.0 - CORREGIDAS)
// ============================================

// Función para obtener un texto aleatorio de un array de sinónimos
@@ -1653,6 +1670,48 @@ function buscarProductoEnTexto(texto) {
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
async function obtenerProductoDesdeMensajeCitado(sock, mensaje) {
try {
@@ -1724,12 +1783,24 @@ function generarRespuestaAutomatica(tipoConsulta, nombreProducto, datosProducto)
// Seleccionar una respuesta aleatoria
let respuesta = obtenerTextoAleatorio(opcionesRespuesta);

    // CORRECCIÓN: Asegurar que el precio tenga formato correcto
    // CORRECCIÓN: Asegurar que el precio tenga formato correcto y no sea undefined
let precioFormateado = datosProducto.precio || '';
    if (precioFormateado && !precioFormateado.includes('$') && !precioFormateado.includes('€') && !precioFormateado.includes('£')) {
        precioFormateado = '$' + precioFormateado;
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
@@ -1738,6 +1809,37 @@ function generarRespuestaAutomatica(tipoConsulta, nombreProducto, datosProducto)
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
    
    return respuesta;
}

// Función para generar enlace wa.me para alerta al admin
function generarEnlaceWaMe(numeroCliente, nombreProducto, preguntaCliente) {
const numeroLimpio = numeroCliente.split('@')[0].replace(/[^0-9]/g, '');
@@ -1772,7 +1874,7 @@ ${datosAlerta.enlace}
}
}

// Función para procesar reacciones a mensajes (VERSIÓN 47.0 - CON MENCIÓN CORREGIDA)
// Función para procesar reacciones a mensajes (VERSIÓN 48.0 - CON MENCIÓN CORREGIDA)
async function procesarReaccion(sock, mensaje) {
try {
// Verificar si es una reacción
@@ -1889,7 +1991,7 @@ async function procesarComandoPrioritario(sock, cmd, remitente, url_sheets) {
// ============================================
async function iniciarWhatsApp() {
console.log('====================================');
    console.log('🤖 BOT WHATSAPP - VERSIÓN 47.0 (CORRECCIÓN PRECIO + MENCIONES + CONFIG NEGOCIO)');
    console.log('🤖 BOT WHATSAPP - VERSIÓN 48.0 (PRECIO CORREGIDO + RESPUESTAS NEGOCIO)');
console.log('====================================\n');
console.log('⏰ Actualización de agenda: 6:00 AM (solo 1 vez al día)');
console.log('✍️  Typing adaptativo activado');
@@ -1918,12 +2020,14 @@ async function iniciarWhatsApp() {
console.log('   - No acumula retrasos en el día');
console.log('🚫 **FILTRO DE ESTADOS ACTIVADO**');
console.log('   - Ignora mensajes de status@broadcast');
    console.log('💬 **SISTEMA DE INTERACCIONES VERSIÓN 47.0**');
    console.log('   - ✅ CORREGIDO: Precio visible en respuestas automáticas');
    console.log('   - ✅ CORREGIDO: Menciones en grupos funcionan correctamente');
    console.log('   - ✅ NUEVO: Configuración de negocio desde Google Sheets');
    console.log('   - ✅ NUEVO: Atención en privado sin necesidad de mención');
    console.log('   - ✅ NUEVO: Formato elegante con datos del negocio\n');
    console.log('💰 **PRECIO CORREGIDO**');
    console.log('   - Ahora se muestra correctamente en todas las respuestas');
    console.log('🏢 **RESPUESTAS DE NEGOCIO ACTIVADAS**');
    console.log('   - ✅ Horario: "horario", "atienden", "a qué hora"');
    console.log('   - ✅ Domicilio: "domicilio", "ubicación", "dónde están"');
    console.log('   - ✅ Teléfono: "teléfono", "contacto", "whatsapp"');
    console.log('   - ✅ Email: "email", "correo", "mail"');
    console.log('   - ✅ Web: "web", "sitio", "página"\n');

const url_sheets = leerURL();
if (!url_sheets) {
@@ -2066,7 +2170,7 @@ async function iniciarWhatsApp() {
});

// ============================================
        // EVENTO DE MENSAJES (VERSIÓN 47.0 - CON TODAS LAS CORRECCIONES)
        // EVENTO DE MENSAJES (VERSIÓN 48.0 - CON RESPUESTAS DE NEGOCIO)
// ============================================
sock.ev.on('messages.upsert', async (m) => {
const mensaje = m.messages[0];
@@ -2085,6 +2189,7 @@ async function iniciarWhatsApp() {

const esGrupo = remitente.includes('@g.us');
const mensajeId = mensaje.key.id;
            const usuarioId = mensaje.key.participant || remitente;

// Evitar procesar el mismo mensaje múltiples veces
if (mensajesEnProcesamiento.has(mensajeId)) return;
@@ -2176,7 +2281,7 @@ async function iniciarWhatsApp() {
});
}

                                let mensaje = `📊 *ESTADO DEL BOT - VERSIÓN 47.0*\n\n` +
                                let mensaje = `📊 *ESTADO DEL BOT - VERSIÓN 48.0*\n\n` +
`⏰ MODO: setTimeout + Delay inteligente\n` +
`📅 Última actualización: ${agenda.ultima_actualizacion || 'N/A'}\n` +
`📋 Grupos totales: ${total}\n` +
@@ -2186,7 +2291,7 @@ async function iniciarWhatsApp() {
`⏱️  Delay mensajes: ${CONFIG.tiempo_entre_mensajes_min}-${CONFIG.tiempo_entre_mensajes_max} seg (inteligente)\n` +
`📦 Múltiples archivos: ACTIVADO\n` +
`⏱️ Delay entre archivos: ${CONFIG.delay_entre_archivos}s\n` +
                                              `💬 Interacciones: VERSIÓN 47.0 (CORREGIDA)\n` +
                                              `💬 Interacciones: VERSIÓN 48.0 (PRECIO CORREGIDO + NEGOCIO)\n` +
`✍️  Typing adaptativo: activado\n` +
`🔗 Link Previews: CON IMAGEN (caché local)\n` +
`📚 Data Store: ACTIVADO (extracción local)\n` +
@@ -2205,7 +2310,8 @@ async function iniciarWhatsApp() {
`🎲 SpinTex/SpinEmoji: CORREGIDO PARA BAILEYS\n` +
`🔋 AHORRO DE BATERÍA: setTimeout ACTIVADO (0 verificaciones por minuto)\n` +
`🚫 FILTRO DE ESTADOS: ACTIVADO (ignorando status@broadcast)\n` +
                                              `🏢 CONFIG NEGOCIO: ${configNegocio.razon_social || 'No configurado'}`;
                                              `💰 PRECIO: CORREGIDO (ya no sale vacío)\n` +
                                              `🏢 RESPUESTAS NEGOCIO: Horario, Domicilio, Teléfono, Email, Web`;

await sock.sendMessage(remitente, { text: mensaje });
mensajesEnProcesamiento.delete(mensajeId);
@@ -2225,7 +2331,7 @@ async function iniciarWhatsApp() {
});
}

                            let mensaje = `📊 *ESTADO DEL BOT - VERSIÓN 47.0*\n\n` +
                            let mensaje = `📊 *ESTADO DEL BOT - VERSIÓN 48.0*\n\n` +
`⏰ MODO: setTimeout + Delay inteligente\n` +
`📅 Última actualización: ${agenda.ultima_actualizacion || 'N/A'}\n` +
`📋 Grupos totales: ${total}\n` +
@@ -2235,7 +2341,7 @@ async function iniciarWhatsApp() {
`⏱️  Delay mensajes: ${CONFIG.tiempo_entre_mensajes_min}-${CONFIG.tiempo_entre_mensajes_max} seg (inteligente)\n` +
`📦 Múltiples archivos: ACTIVADO\n` +
`⏱️ Delay entre archivos: ${CONFIG.delay_entre_archivos}s\n` +
                                          `💬 Interacciones: VERSIÓN 47.0 (CORREGIDA)\n` +
                                          `💬 Interacciones: VERSIÓN 48.0 (PRECIO CORREGIDO + NEGOCIO)\n` +
`✍️  Typing adaptativo: activado\n` +
`🔗 Link Previews: CON IMAGEN (caché local)\n` +
`📚 Data Store: ACTIVADO (extracción local)\n` +
@@ -2254,7 +2360,8 @@ async function iniciarWhatsApp() {
`🎲 SpinTex/SpinEmoji: CORREGIDO PARA BAILEYS\n` +
`🔋 AHORRO DE BATERÍA: setTimeout ACTIVADO (0 verificaciones por minuto)\n` +
`🚫 FILTRO DE ESTADOS: ACTIVADO (ignorando status@broadcast)\n` +
                                          `🏢 CONFIG NEGOCIO: ${configNegocio.razon_social || 'No configurado'}`;
                                          `💰 PRECIO: CORREGIDO (ya no sale vacío)\n` +
                                          `🏢 RESPUESTAS NEGOCIO: Horario, Domicilio, Teléfono, Email, Web`;

await sock.sendMessage(remitente, { text: mensaje });
mensajesEnProcesamiento.delete(mensajeId);
@@ -2265,10 +2372,29 @@ async function iniciarWhatsApp() {
}

// ============================================
            // PROCESAR INTERACCIONES (VERSIÓN 47.0 - CON CORRECCIONES)
            // PROCESAR INTERACCIONES (VERSIÓN 48.0 - CON RESPUESTAS DE NEGOCIO)
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

@@ -2294,7 +2420,6 @@ async function iniciarWhatsApp() {

// Clasificar la consulta del usuario
const tipoConsulta = clasificarConsulta(texto);
                    const usuarioId = mensaje.key.participant || remitente;

if (tipoConsulta !== 'no_respondible') {
// Generar respuesta automática (CORREGIDA - con precio)
@@ -2356,11 +2481,14 @@ async function iniciarWhatsApp() {
console.log('   - Simulación de typing antes de responder (1-3 segundos)');
console.log('🚫 **FILTRO DE ESTADOS ACTIVADO**');
console.log('   - Ignora mensajes de status@broadcast');
        console.log('💬 **INTERACCIONES VERSIÓN 47.0**');
        console.log('   - ✅ PRECIO CORREGIDO: Ahora se muestra en todas las respuestas');
        console.log('   - ✅ MENCIONES CORREGIDAS: En grupos funcionan correctamente');
        console.log('   - ✅ ATENCIÓN PRIVADO: Responde sin necesidad de mención');
        console.log('   - ✅ CONFIG NEGOCIO: Datos desde Google Sheets\n');
        console.log('💰 **PRECIO CORREGIDO**');
        console.log('   - Ahora se muestra correctamente en todas las respuestas');
        console.log('🏢 **RESPUESTAS DE NEGOCIO ACTIVADAS**');
        console.log('   - ✅ Horario: "horario", "atienden", "a qué hora"');
        console.log('   - ✅ Domicilio: "domicilio", "ubicación", "dónde están"');
        console.log('   - ✅ Teléfono: "teléfono", "contacto", "whatsapp"');
        console.log('   - ✅ Email: "email", "correo", "mail"');
        console.log('   - ✅ Web: "web", "sitio", "página"\n');

} catch (error) {
guardarLogLocal(`❌ ERROR FATAL: ${error.message}`);
