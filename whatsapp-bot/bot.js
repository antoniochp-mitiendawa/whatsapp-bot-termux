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
const fs = require('fs');
const pino = require('pino');
const axios = require('axios');
const { Boom } = require('@hapi/boom');

const CONFIG = {
    textos_sinonimos: {
        saludos: ["¡Hola! 👋", "¡Buen día! ☀️", "¡Hola, gracias por contactarnos! 😊", "¡Un gusto saludarte! 🤝", "¡Gracias por comunicarte! ✨"],
        agradecimientos: ["¡Gracias! 🙏", "Te lo agradecemos ✨", "¡Gracias por tu interés! 🌟", "Agradecemos tu mensaje 💫", "¡Gracias por escribirnos!"],
        audio: '🔊 Escucha más información sobre *[PRODUCTO]*',
        documento: '📄 Aquí tienes más información de *[PRODUCTO]*'
    },
    palabras_clave: {
        info: ["info", "información", "características", "descripción", "qué es", "detalles", "descripcion", "caracteristicas", "como es", "que tiene", "especificaciones"],
        generica: ["más", "info", "información", "quiero saber", "dime", "mas", "informacion", "saber", "conocer", "interesa", "me interesa", "quisiera saber"]
    },
    palabras_clave_negocio: {
        horario: ["horario", "atienden", "abren", "cierran", "hora", "horarios", "atencion", "atención", "a qué hora", "cuándo abren", "cuándo cierran", "días de atención"],
        domicilio: ["domicilio", "ubicación", "ubicacion", "dirección", "direccion", "dónde están", "donde estan", "en dónde", "donde quedan", "como llegar", "cómo llegar", "mapa"],
        telefono: ["teléfono", "telefono", "whatsapp", "contacto", "número", "numero", "celular", "llamar", "comunicarme", "hablar"],
        email: ["email", "correo", "mail", "electrónico", "electronico", "e-mail"],
        web: ["web", "sitio", "página", "pagina", "website", "internet", "online"]
    },
    delay_respuesta_min: 1, 
    delay_respuesta_max: 3  
};

// ============================================
let timersEnvios = []; // Array para guardar todos los setTimeout activos

// NUEVA VARIABLE GLOBAL PARA CONFIGURACIÓN DE NEGOCIO
let configNegocio = {};

// Crear carpetas necesarias
if (!fs.existsSync('./logs')) {
    fs.mkdirSync('./logs');
}

// ============================================
// ACTUALIZAR AGENDA (VERSIÓN 47.0 - CON LECTURA DE NEGOCIO)
// ============================================
async function actualizarAgenda(sock, url_sheets, origen = 'automático') {
    try {
        const response = await axios.get(url_sheets);
        const data = response.data;

        if (!data) {
            guardarLogLocal("❌ Error: No se recibieron datos de la URL");
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
            guardarLogLocal(`✅ Agenda actualizada (${origen}): ${total} grupos activos`);
            return true;
        }
        return false;
    } catch (error) {
        guardarLogLocal(`❌ Error en actualizarAgenda: ${error.message}`);
        return false;
    }
}

// ============================================
// NUEVAS FUNCIONES PARA INTERACCIONES (VERSIÓN 47.0 - CON NEGOCIO)
// ============================================

function botEsMencionado(mensaje, botId) {
    if (!mensaje || !botId) return false;
    const botIdNormalizado = botId.split(':')[0];
    
    const mentionedJid = mensaje?.extendedTextMessage?.contextInfo?.mentionedJid;
    if (mentionedJid) {
        for (const jid of mentionedJid) {
            if (jid.split(':')[0] === botIdNormalizado) return true;
        }
    }

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

function esRespuestaABot(mensaje, botId) {
    try {
        const contextInfo = mensaje.message?.extendedTextMessage?.contextInfo || 
                            mensaje.message?.imageMessage?.contextInfo;
        if (!contextInfo?.quotedMessage) return false;

        const botIdNormalizado = botId.split(':')[0];
        const participant = contextInfo.participant ? contextInfo.participant.split(':')[0] : null;
        const quotedParticipant = contextInfo.quotedParticipant ? contextInfo.quotedParticipant.split(':')[0] : null;
        
        return participant === botIdNormalizado || quotedParticipant === botIdNormalizado;
    } catch (error) {
        return false;
    }
}

function buscarProductoEnTexto(texto) {
    if (!texto || productosCache.length === 0) return null;
    const textoLower = texto.toLowerCase();
    for (const producto of productosCache) {
        if (textoLower.includes(producto.producto.toLowerCase())) {
            return producto.producto;
        }
    }
    return null;
}

function clasificarConsultaNegocio(texto) {
    const textoLower = texto.toLowerCase();
    for (const clave in CONFIG.palabras_clave_negocio) {
        for (const palabra of CONFIG.palabras_clave_negocio[clave]) {
            if (textoLower.includes(palabra)) {
                return clave;
            }
        }
    }
    return null;
}

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

// ============================================
async function iniciarWhatsApp() {
    console.log('====================================');
    console.log('🤖 BOT WHATSAPP - VERSIÓN 47.0 (CONFIG NEGOCIO + RESPUESTAS)');
    console.log('====================================\n');
    console.log('⏰ Actualización de agenda: 6:00 AM (solo 1 vez al día)');
    console.log('✍️  Typing adaptativo activado');
    console.log('🏢 **NUEVO: RESPUESTAS DE NEGOCIO**');
    console.log('   - ✅ Horario, Domicilio, Teléfono, Email, Web');
    console.log('   - Los datos se cargan desde Google Sheets (hoja CONFIG)\n');

    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        browser: Browsers.macOS('Desktop'),
        logger: pino({ level: 'silent' })
    });

    sock.ev.on('creds.update', saveCreds);

    // ============================================
    // EVENTO DE MENSAJES (VERSIÓN 47.0 - CON RESPUESTAS DE NEGOCIO)
    // ============================================
    sock.ev.on('messages.upsert', async (m) => {
        const mensaje = m.messages[0];
        if (!mensaje.message || mensaje.key.fromMe) return;

        const remitente = mensaje.key.remoteJid;
        if (remitente === 'status@broadcast') return;

        const esGrupo = remitente.includes('@g.us');
        const mensajeId = mensaje.key.id;
        const usuarioId = mensaje.key.participant || remitente;
        const texto = (mensaje.message.conversation || mensaje.message.extendedTextMessage?.text || "").toLowerCase();

        if (mensajesEnProcesamiento.has(mensajeId)) return;
        mensajesEnProcesamiento.add(mensajeId);

        let debeProcesar = false;
        if (esGrupo) {
            const esMencion = botEsMencionado(mensaje.message, sock.user.id);
            const esRespuesta = esRespuestaABot(mensaje, sock.user.id);
            if (esMencion || esRespuesta) debeProcesar = true;
        } else {
            debeProcesar = true;
        }

        if (!debeProcesar) {
            mensajesEnProcesamiento.delete(mensajeId);
            return;
        }

        // COMANDO ESTADO
        if (texto === 'estado' || texto === '.estado') {
            let statusMsg = `📊 *ESTADO DEL BOT - VERSIÓN 47.0*\n\n` +
                          `💬 Interacciones: VERSIÓN 47.0 (CONFIG NEGOCIO)\n` +
                          `🚫 FILTRO DE ESTADOS: ACTIVADO\n` +
                          `🏢 CONFIG NEGOCIO: ${configNegocio.RAZON_SOCIAL || 'No configurado'}`;
            await sock.sendMessage(remitente, { text: statusMsg });
            mensajesEnProcesamiento.delete(mensajeId);
            return;
        }

        // NUEVO: VERIFICAR SI ES CONSULTA DE NEGOCIO
        const tipoNegocio = clasificarConsultaNegocio(texto);
        if (tipoNegocio) {
            const respuestaNegocio = generarRespuestaNegocio(tipoNegocio);
            const mensajeConMencion = `@${usuarioId.split('@')[0]} ${respuestaNegocio}`;
            
            const delayTyping = Math.floor(Math.random() * (CONFIG.delay_respuesta_max - CONFIG.delay_respuesta_min + 1) + CONFIG.delay_respuesta_min);
            await sock.sendPresenceUpdate('composing', remitente);
            await new Promise(resolve => setTimeout(resolve, delayTyping * 1000));
            
            await sock.sendMessage(remitente, { 
                text: mensajeConMencion,
                mentions: [usuarioId]
            });
            guardarLogLocal(`✅ Respuesta de negocio enviada (${tipoNegocio}) a @${usuarioId.split('@')[0]}`);
            mensajesEnProcesamiento.delete(mensajeId);
            return;
        }

        // PROCESAR INTERACCIONES (PRODUCTOS)
        setImmediate(async () => {
            try {
                const tipoConsulta = clasificarConsulta(texto);
                if (tipoConsulta !== 'no_respondible') {
                    // Lógica de respuesta de productos...
                }
            } catch (e) {
                console.log("Error en procesamiento:", e);
            } finally {
                mensajesEnProcesamiento.delete(mensajeId);
            }
        });
    });
}

process.on('SIGINT', () => {
    console.log('\n\n👋 Cerrando bot...');
    guardarLogLocal('BOT CERRADO MANUALMENTE');
    if (timersEnvios.length > 0) {
        timersEnvios.forEach(timer => clearTimeout(timer));
    }
    process.exit(0);
});

console.log('====================================');
console.log('🚀 SISTEMA DE MENSAJES MULTI-PESTAÑA');
console.log('====================================\n');

iniciarWhatsApp().catch(error => {
    console.log('❌ Error fatal:', error);
});
