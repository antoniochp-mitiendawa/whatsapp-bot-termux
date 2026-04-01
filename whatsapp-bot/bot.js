// ============================================
// BOT DE WHATSAPP PARA TERMUX
// Versión: 46.0 - MENCIONES + TEXTOS PROFESIONALES + INMEDIATEZ
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
//   - Responde a respuestas (sin @) y menciones (con @)
//   - Menciona al usuario en respuestas a reacciones
//   - Menciona al usuario en respuestas a consultas
//   - Textos profesionales y cálidos para negocios
//   - Eliminación de artículos incorrectos
// + VERSIÓN 46.1: Filtro de estados para evitar procesar status@broadcast
// ============================================

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, getUrlInfo, Browsers } = require('@whiskeysockets/baileys');
@@ -1849,7 +1846,7 @@ async function procesarComandoPrioritario(sock, cmd, remitente, url_sheets) {
// ============================================
async function iniciarWhatsApp() {
console.log('====================================');
    console.log('🤖 BOT WHATSAPP - VERSIÓN 46.0 (MENCIONES + TEXTOS PROFESIONALES)');
    console.log('🤖 BOT WHATSAPP - VERSIÓN 46.1 (FILTRO DE ESTADOS + MENCIONES)');
console.log('====================================\n');
console.log('⏰ Actualización de agenda: 6:00 AM (solo 1 vez al día)');
console.log('✍️  Typing adaptativo activado');
@@ -1876,14 +1873,14 @@ async function iniciarWhatsApp() {
console.log('   - Mide el tiempo real de cada envío');
console.log('   - Ajusta la espera automáticamente');
console.log('   - No acumula retrasos en el día');
    console.log('💬 **SISTEMA DE INTERACCIONES VERSIÓN 46.0**');
    console.log('🚫 **FILTRO DE ESTADOS ACTIVADO**');
    console.log('   - Ignora mensajes de status@broadcast');
    console.log('   - Evita procesar estados como si fueran mensajes normales');
    console.log('💬 **SISTEMA DE INTERACCIONES VERSIÓN 46.1**');
console.log('   - ✅ Responde a RESPUESTAS (sin @) y MENCIONES (con @)');
    console.log('   - ✅ MENCIONA al usuario en respuestas a reacciones');
    console.log('   - ✅ MENCIONA al usuario en respuestas a consultas');
    console.log('   - ✅ MENCIONA al usuario en todas las respuestas');
console.log('   - ✅ TEXTOS PROFESIONALES para negocios');
    console.log('   - ✅ Sin artículos incorrectos (usa solo *[PRODUCTO]*)');
    console.log('   - ✅ Simula typing antes de responder (1-3 segundos)');
    console.log('   - ✅ Usa sinónimos para variedad en respuestas\n');
    console.log('   - ✅ Reacciona con 👍❤️😮🙏😂 y el bot responderá mencionándote\n');

const url_sheets = leerURL();
if (!url_sheets) {
@@ -2026,7 +2023,7 @@ async function iniciarWhatsApp() {
});

// ============================================
        // EVENTO DE MENSAJES (VERSIÓN 46.0 - CON DETECCIÓN DE RESPUESTAS SIN @)
        // EVENTO DE MENSAJES (VERSIÓN 46.1 - CON FILTRO DE ESTADOS)
// ============================================
sock.ev.on('messages.upsert', async (m) => {
const mensaje = m.messages[0];
@@ -2035,6 +2032,14 @@ async function iniciarWhatsApp() {
if (!mensaje.key || mensaje.key.fromMe || !mensaje.message) return;

const remitente = mensaje.key.remoteJid;
            
            // ============================================
            // NUEVO FILTRO: Ignorar estados (status@broadcast)
            // ============================================
            if (remitente === 'status@broadcast') {
                return; // Ignorar completamente los estados
            }
            
const esGrupo = remitente.includes('@g.us');
const mensajeId = mensaje.key.id;

@@ -2118,7 +2123,7 @@ async function iniciarWhatsApp() {
});
}

                                let mensaje = `📊 *ESTADO DEL BOT - VERSIÓN 46.0*\n\n` +
                                let mensaje = `📊 *ESTADO DEL BOT - VERSIÓN 46.1*\n\n` +
`⏰ MODO: setTimeout + Delay inteligente\n` +
`📅 Última actualización: ${agenda.ultima_actualizacion || 'N/A'}\n` +
`📋 Grupos totales: ${total}\n` +
@@ -2128,7 +2133,7 @@ async function iniciarWhatsApp() {
`⏱️  Delay mensajes: ${CONFIG.tiempo_entre_mensajes_min}-${CONFIG.tiempo_entre_mensajes_max} seg (inteligente)\n` +
`📦 Múltiples archivos: ACTIVADO\n` +
`⏱️ Delay entre archivos: ${CONFIG.delay_entre_archivos}s\n` +
                                              `💬 Interacciones: VERSIÓN 46.0 (menciones en respuestas + textos profesionales)\n` +
                                              `💬 Interacciones: VERSIÓN 46.1 (filtro de estados + menciones)\n` +
`✍️  Typing adaptativo: activado\n` +
`🔗 Link Previews: CON IMAGEN (caché local)\n` +
`📚 Data Store: ACTIVADO (extracción local)\n` +
@@ -2145,7 +2150,8 @@ async function iniciarWhatsApp() {
`🌐 Browser: ${existeSesion ? 'macOS/Desktop' : 'Ubuntu/Chrome'}\n` +
`📤 Comando listagrupos: disponible (con caché)\n` +
`🎲 SpinTex/SpinEmoji: CORREGIDO PARA BAILEYS\n` +
                                              `🔋 AHORRO DE BATERÍA: setTimeout ACTIVADO (0 verificaciones por minuto)`;
                                              `🔋 AHORRO DE BATERÍA: setTimeout ACTIVADO (0 verificaciones por minuto)\n` +
                                              `🚫 FILTRO DE ESTADOS: ACTIVADO (ignorando status@broadcast)`;

await sock.sendMessage(remitente, { text: mensaje });
mensajesEnProcesamiento.delete(mensajeId);
@@ -2165,7 +2171,7 @@ async function iniciarWhatsApp() {
});
}

                            let mensaje = `📊 *ESTADO DEL BOT - VERSIÓN 46.0*\n\n` +
                            let mensaje = `📊 *ESTADO DEL BOT - VERSIÓN 46.1*\n\n` +
`⏰ MODO: setTimeout + Delay inteligente\n` +
`📅 Última actualización: ${agenda.ultima_actualizacion || 'N/A'}\n` +
`📋 Grupos totales: ${total}\n` +
@@ -2175,7 +2181,7 @@ async function iniciarWhatsApp() {
`⏱️  Delay mensajes: ${CONFIG.tiempo_entre_mensajes_min}-${CONFIG.tiempo_entre_mensajes_max} seg (inteligente)\n` +
`📦 Múltiples archivos: ACTIVADO\n` +
`⏱️ Delay entre archivos: ${CONFIG.delay_entre_archivos}s\n` +
                                          `💬 Interacciones: VERSIÓN 46.0 (menciones en respuestas + textos profesionales)\n` +
                                          `💬 Interacciones: VERSIÓN 46.1 (filtro de estados + menciones)\n` +
`✍️  Typing adaptativo: activado\n` +
`🔗 Link Previews: CON IMAGEN (caché local)\n` +
`📚 Data Store: ACTIVADO (extracción local)\n` +
@@ -2192,7 +2198,8 @@ async function iniciarWhatsApp() {
`🌐 Browser: ${existeSesion ? 'macOS/Desktop' : 'Ubuntu/Chrome'}\n` +
`📤 Comando listagrupos: disponible (con caché)\n` +
`🎲 SpinTex/SpinEmoji: CORREGIDO PARA BAILEYS\n` +
                                          `🔋 AHORRO DE BATERÍA: setTimeout ACTIVADO (0 verificaciones por minuto)`;
                                          `🔋 AHORRO DE BATERÍA: setTimeout ACTIVADO (0 verificaciones por minuto)\n` +
                                          `🚫 FILTRO DE ESTADOS: ACTIVADO (ignorando status@broadcast)`;

await sock.sendMessage(remitente, { text: mensaje });
mensajesEnProcesamiento.delete(mensajeId);
@@ -2203,7 +2210,7 @@ async function iniciarWhatsApp() {
}

// ============================================
            // PROCESAR INTERACCIONES (RESPUESTAS A MENSAJES) - VERSIÓN 46.0 CON MENCIÓN
            // PROCESAR INTERACCIONES (RESPUESTAS A MENSAJES) - VERSIÓN 46.1 CON MENCIÓN
// ============================================
setImmediate(async () => {
try {
@@ -2285,7 +2292,10 @@ async function iniciarWhatsApp() {
console.log('⚡ **INMEDIATEZ OPTIMIZADA**');
console.log('   - Los mensajes se procesan inmediatamente al llegar');
console.log('   - Simulación de typing antes de responder (1-3 segundos)');
        console.log('💬 **INTERACCIONES VERSIÓN 46.0**');
        console.log('🚫 **FILTRO DE ESTADOS ACTIVADO**');
        console.log('   - Ignora mensajes de status@broadcast');
        console.log('   - Evita procesar estados como si fueran mensajes normales');
        console.log('💬 **INTERACCIONES VERSIÓN 46.1**');
console.log('   - Responde a RESPUESTAS (sin @) y MENCIONES (con @)');
console.log('   - MENCIONA al usuario en todas las respuestas');
console.log('   - TEXTOS PROFESIONALES para negocios');
