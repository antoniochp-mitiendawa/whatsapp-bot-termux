// ============================================
// BOT DE WHATSAPP PARA TERMUX
// Versión: 47.0 - CONFIG NEGOCIO + RESPUESTAS + SINÓNIMOS
// BASE: VERSIÓN 46.1 (ESTABLE) + NUEVAS FUNCIONALIDADES
// ============================================

const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion, 
    getUrlInfo, 
    Browsers 
} = require('@whiskeysockets/baileys');
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
    delay_respuesta_min: 1, 
    delay_respuesta_max: 3  
};

let timersEnvios = [];
let configNegocio = {};
const mensajesEnProcesamiento = new Set();
let productosCache = [];

if (!fs.existsSync(CONFIG.carpeta_logs)) {
    fs.mkdirSync(CONFIG.carpeta_logs);
}

function guardarLogLocal(mensaje) {
    const fecha = new Date().toLocaleString();
    const log = `[${fecha}] ${mensaje}\n`;
    fs.appendFileSync(`${CONFIG.carpeta_logs}/bot_log.txt`, log);
    console.log(log.trim());
}

async function actualizarAgenda(sock, url_sheets, origen = 'automático') {
    try {
        const response = await axios.get(url_sheets);
        const data = response.data;
        if (!data) return false;

        if (data.negocio) {
            configNegocio = data.negocio;
            guardarLogLocal(`🏢 Configuración de negocio cargada: ${configNegocio.RAZON_SOCIAL || 'Sin nombre'}`);
        }

        // Lógica de guardado local (simplificada para este bloque)
        productosCache = data.productos || [];
        return true;
    } catch (error) {
        guardarLogLocal(`❌ Error en actualizarAgenda: ${error.message}`);
        return false;
    }
}

function botEsMencionado(mensaje, botId) {
    if (!mensaje || !botId) return false;
    const botIdNormalizado = botId.split(':')[0];
    const mentionedJid = mensaje?.extendedTextMessage?.contextInfo?.mentionedJid || 
                        mensaje?.imageMessage?.contextInfo?.mentionedJid;
    if (mentionedJid) {
        return mentionedJid.some(jid => jid.split(':')[0] === botIdNormalizado);
    }
    return false;
}

function esRespuestaABot(mensaje, botId) {
    const contextInfo = mensaje.message?.extendedTextMessage?.contextInfo;
    if (!contextInfo?.quotedMessage) return false;
    const botIdNormalizado = botId.split(':')[0];
    const participant = contextInfo.participant?.split(':')[0];
    const quotedParticipant = contextInfo.quotedParticipant?.split(':')[0];
    return participant === botIdNormalizado || quotedParticipant === botIdNormalizado;
}

function clasificarConsultaNegocio(texto) {
    const textoLower = texto.toLowerCase();
    for (const [tipo, palabras] of Object.entries(CONFIG.palabras_clave_negocio)) {
        if (palabras.some(p => textoLower.includes(p))) return tipo;
    }
    return null;
}

function generarRespuestaNegocio(tipoConsulta) {
    if (!configNegocio || Object.keys(configNegocio).length === 0) return "Información no disponible.";
    switch(tipoConsulta) {
        case 'horario': return `🕒 *Horario:*\n${configNegocio.HORARIO_ATENCION || 'No disponible'}`;
        case 'domicilio': return `📍 *Ubicación:*\n${configNegocio.UBICACION || 'No disponible'}`;
        case 'telefono': return `📞 *Contacto:*\n${configNegocio.TELEFONO_CONTACTO || 'No disponible'}`;
        case 'email': return `📧 *Email:*\n${configNegocio.EMAIL_CONTACTO || 'No disponible'}`;
        case 'web': return `🌐 *Web:*\n${configNegocio.SITIO_WEB || 'No disponible'}`;
        default: return configNegocio.MENSAJE_BIENVENIDA || "Hola, ¿en qué puedo ayudarte?";
    }
}

async function iniciarWhatsApp() {
    console.log('====================================');
    console.log('🤖 BOT WHATSAPP - VERSIÓN 47.0');
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

        const texto = (mensaje.message.conversation || mensaje.message.extendedTextMessage?.text || "").toLowerCase();
        const usuarioId = mensaje.key.participant || remitente;
        const mensajeId = mensaje.key.id;

        if (mensajesEnProcesamiento.has(mensajeId)) return;
        mensajesEnProcesamiento.add(mensajeId);

        // Lógica de negocio prioritaria
        const tipoNegocio = clasificarConsultaNegocio(texto);
        if (tipoNegocio) {
            const respuesta = generarRespuestaNegocio(tipoNegocio);
            const mencion = `@${usuarioId.split('@')[0]} ${respuesta}`;
            
            await sock.sendPresenceUpdate('composing', remitente);
            await new Promise(r => setTimeout(r, 2000));
            
            await sock.sendMessage(remitente, { 
                text: mencion, 
                mentions: [usuarioId] 
            });
            mensajesEnProcesamiento.delete(mensajeId);
            return;
        }
        mensajesEnProcesamiento.delete(mensajeId);
    });
}

iniciarWhatsApp().catch(err => console.log("Error fatal:", err));
