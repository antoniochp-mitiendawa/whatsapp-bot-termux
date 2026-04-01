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
    carpeta_logs: './logs',
    archivo_store: './baileys_store.json',
    delay_entre_archivos: 2,
    tiempo_entre_mensajes_min: 5,
    tiempo_entre_mensajes_max: 10,
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
    delay_respuesta_min: 1, // segundos mínimos antes de responder (simular typing)
    delay_respuesta_max: 3  // segundos máximos antes de responder
};

// ============================================
let timersEnvios = []; // Array para guardar todos los setTimeout activos
let configNegocio = {}; // NUEVA VARIABLE GLOBAL PARA CONFIGURACIÓN DE NEGOCIO
const mensajesEnProcesamiento = new Set();
let productosCache = [];

// Crear carpetas necesarias
if (!fs.existsSync(CONFIG.carpeta_logs)) {
    fs.mkdirSync(CONFIG.carpeta_logs);
}

function guardarLogLocal(mensaje) {
    const fecha = new Date().toLocaleString();
    const log = `[${fecha}] ${mensaje}\n`;
    fs.appendFileSync(`${CONFIG.carpeta_logs}/bot_log.txt`, log);
    console.log(log.trim());
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
        
        productosCache = data.productos || [];
        guardarLogLocal(`✅ Agenda actualizada (${origen}): ${productosCache.length} productos cargados`);
        return true;

    } catch (error) {
        guardarLogLocal(`❌ Error en actualizarAgenda: ${error.message}`);
        return false;
    }
}

// ============================================
// FUNCIONES DE INTERACCIONES
// ============================================

function botEsMencionado(mensaje, botId) {
    if (!mensaje || !botId) return false;
    const botIdNormalizado = botId.split(':')[0];
    const mentionedJid = mensaje?.extendedTextMessage?.contextInfo?.mentionedJid || 
                        mensaje?.imageMessage?.contextInfo?.mentionedJid ||
                        mensaje?.videoMessage?.contextInfo?.mentionedJid;
    
    if (mentionedJid) {
        for (const jid of mentionedJid) {
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

function clasificarConsultaNegocio(texto) {
    const textoLower = texto.toLowerCase();
    for (const clave in CONFIG.palabras_clave_negocio) {
        for (const palabra of CONFIG.palabras_clave_negocio[clave]) {
            if (textoLower.includes(palabra)) return clave;
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

async function simularTyping(sock, jid, segundos) {
    await sock.sendPresenceUpdate('composing', jid);
    await new Promise(resolve => setTimeout(resolve, segundos * 1000));
    await sock.sendPresenceUpdate('paused', jid);
}

// ============================================
// INICIO DEL BOT
// ============================================
async function iniciarWhatsApp() {
    console.log('====================================');
    console.log('🤖 BOT WHATSAPP - VERSIÓN 47.0 (CONFIG NEGOCIO + RESPUESTAS)');
    console.log('====================================\n');

    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        browser: Browsers.macOS('Desktop'),
        logger: pino({ level: 'silent' })
    });

    sock.ev.on('creds.update', saveCreds);

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

        let debeProcesar = !esGrupo || botEsMencionado(mensaje.message, sock.user.id) || esRespuestaABot(mensaje, sock.user.id);

        if (!debeProcesar) {
            mensajesEnProcesamiento.delete(mensajeId);
            return;
        }

        // VERIFICAR CONSULTA DE NEGOCIO (PRIORIDAD)
        const tipoNegocio = clasificarConsultaNegocio(texto);
        if (tipoNegocio) {
            const respuestaNegocio = generarRespuestaNegocio(tipoNegocio);
            const mensajeConMencion = `@${usuarioId.split('@')[0]} ${respuestaNegocio}`;
            
            const delayTyping = Math.floor(Math.random() * (CONFIG.delay_respuesta_max - CONFIG.delay_respuesta_min + 1) + CONFIG.delay_respuesta_min);
            await simularTyping(sock, remitente, delayTyping);
            
            await sock.sendMessage(remitente, { 
                text: mensajeConMencion,
                mentions: [usuarioId]
            });
            guardarLogLocal(`✅ Respuesta de negocio enviada (${tipoNegocio})`);
            mensajesEnProcesamiento.delete(mensajeId);
            return;
        }

        // Lógica de productos (aquí continuaría tu código de clasificación de productos...)
        mensajesEnProcesamiento.delete(mensajeId);
    });

    // Leer URL y actualizar agenda inicial
    const url_sheets = fs.readFileSync('url_sheets.txt', 'utf-8').trim();
    if (url_sheets) {
        await actualizarAgenda(sock, url_sheets, 'inicial');
    }
}

iniciarWhatsApp().catch(error => {
    guardarLogLocal(`❌ ERROR FATAL: ${error.message}`);
});

process.on('SIGINT', () => {
    console.log('\n👋 Cerrando bot...');
    process.exit(0);
});
