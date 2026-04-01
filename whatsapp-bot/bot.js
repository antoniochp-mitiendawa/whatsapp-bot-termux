// ============================================
// BOT DE WHATSAPP PARA TERMUX
// Versión: 48.0 - PAIRING FIX + MÚLTIPLES HOJAS + OPTIMIZACIÓN
// ============================================

const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    Browsers,
    delay
} = require('@whiskeysockets/baileys');
const fs = require('fs');
const pino = require('pino');
const axios = require('axios');
const { Boom } = require('@hapi/boom');
const readline = require('readline');

const CONFIG = {
    carpeta_logs: './logs',
    archivo_dueno: './owner_number.txt',
    archivo_url: './url_sheets.txt',
    delay_entre_envios_min: 7,
    delay_entre_envios_max: 28,
    ruta_raiz_almacenamiento: '/storage/emulated/0/',
    textos_sinonimos: {
        saludos: ["¡Hola! 👋", "¡Buen día! ☀️", "¡Hola, gracias por contactarnos! 😊", "¡Un gusto saludarte! 🤝", "¡Gracias por comunicarte! ✨"],
        agradecimientos: ["¡Gracias! 🙏", "Te lo agradecemos ✨", "¡Gracias por tu interés! 🌟", "Agradecemos tu mensaje 💫", "¡Gracias por escribirnos!"]
    },
    palabras_clave_negocio: {
        horario: ["horario", "atienden", "abren", "cierran", "hora", "horarios", "atencion", "atención"],
        domicilio: ["domicilio", "ubicación", "ubicacion", "dirección", "direccion", "dónde están", "donde estan"],
        telefono: ["teléfono", "telefono", "whatsapp", "contacto", "número", "numero"],
        email: ["email", "correo", "mail", "electrónico", "electronico"],
        web: ["web", "sitio", "página", "pagina", "website"]
    }
};

let configNegocio = {};
let tareasProgramadas = [];
let temporizadorActivo = false;
let botJid = null;
const mensajesEnProcesamiento = new Set();
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function guardarLogLocal(mensaje) {
    if (!fs.existsSync(CONFIG.carpeta_logs)) fs.mkdirSync(CONFIG.carpeta_logs, { recursive: true });
    const fecha = new Date().toLocaleString();
    fs.appendFileSync(`${CONFIG.carpeta_logs}/bot_log.txt`, `[${fecha}] ${mensaje}\n`);
    console.log(`[${fecha}] ${mensaje}`);
}

const question = (text) => new Promise((resolve) => rl.question(text, resolve));

function obtenerSinonimo(tipo) {
    const lista = CONFIG.textos_sinonimos[tipo];
    return lista[Math.floor(Math.random() * lista.length)];
}

function aplicarSpintax(texto) {
    if (!texto) return "";
    return texto.replace(/{([^{}]+)}/g, (match, opciones) => {
        const choices = opciones.split('|');
        return choices[Math.floor(Math.random() * choices.length)];
    });
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
    const contextInfo = mensaje.message?.extendedTextMessage?.contextInfo || 
                        mensaje.message?.imageMessage?.contextInfo;
    if (!contextInfo?.quotedMessage) return false;
    const botIdNormalizado = botId.split(':')[0];
    const participant = contextInfo.participant?.split(':')[0];
    const quotedParticipant = contextInfo.quotedParticipant?.split(':')[0];
    return participant === botIdNormalizado || quotedParticipant === botIdNormalizado;
}

function clasificarConsultaNegocio(texto) {
    const textoLower = texto.toLowerCase();
    for (const clave in CONFIG.palabras_clave_negocio) {
        if (CONFIG.palabras_clave_negocio[clave].some(p => textoLower.includes(p))) return clave;
    }
    return null;
}

function generarRespuestaNegocio(tipoConsulta) {
    if (!configNegocio) return "Lo siento, la información no está disponible.";
    switch(tipoConsulta) {
        case 'horario': return `🕒 *Horario:*\n${configNegocio.HORARIO_ATENCION || 'No definido'}`;
        case 'domicilio': return `📍 *Ubicación:*\n${configNegocio.UBICACION || 'No definida'}`;
        case 'telefono': return `📞 *Contacto:*\n${configNegocio.TELEFONO_CONTACTO || 'No definido'}`;
        case 'email': return `📧 *Email:*\n${configNegocio.EMAIL_CONTACTO || 'No definido'}`;
        case 'web': return `🌐 *Web:*\n${configNegocio.SITIO_WEB || 'No definida'}`;
        default: return configNegocio.MENSAJE_BIENVENIDA || "Hola, ¿en qué puedo ayudarte?";
    }
}

async function obtenerTodasLasHojas(url_sheets) {
    try {
        const response = await axios.get(url_sheets);
        return response.data;
    } catch (error) {
        guardarLogLocal(`❌ Error Sheets: ${error.message}`);
        return null;
    }
}

function identificarHojasDeEnvios(data) {
    const hojasEnvios = [];
    const encabezadosRequeridos = ['HORARIO', 'DIAS', 'ID', 'NOMBRE', 'MENSAJE', 'ARCHIVO', 'CAPTION', 'ACTIVO'];
    
    for (const [nombreHoja, contenido] of Object.entries(data)) {
        if (contenido && Array.isArray(contenido) && contenido.length > 0) {
            const primerFila = contenido[0];
            const tieneEncabezados = encabezadosRequeridos.every(enc => primerFila.hasOwnProperty(enc));
            if (tieneEncabezados) {
                hojasEnvios.push({
                    nombre: nombreHoja,
                    datos: contenido.slice(1).filter(row => row.ACTIVO && row.ACTIVO.toUpperCase() === 'SI')
                });
                guardarLogLocal(`📄 Hoja detectada: ${nombreHoja} - ${hojasEnvios[hojasEnvios.length-1].datos.length} grupos activos`);
            }
        }
    }
    return hojasEnvios;
}

function consolidarTareas(hojasEnvios) {
    const todasTareas = [];
    for (const hoja of hojasEnvios) {
        for (const grupo of hoja.datos) {
            if (grupo.HORARIO && grupo.DIAS && grupo.ID) {
                todasTareas.push({
                    id: grupo.ID,
                    nombre: grupo.NOMBRE || 'Sin nombre',
                    horario: grupo.HORARIO,
                    dias: grupo.DIAS.toLowerCase(),
                    mensaje: grupo.MENSAJE || '',
                    archivo: grupo.ARCHIVO || null,
                    caption: grupo.CAPTION || '',
                    hojaOrigen: hoja.nombre
                });
            }
        }
    }
    guardarLogLocal(`📋 Total tareas consolidadas: ${todasTareas.length}`);
    return todasTareas;
}

async function actualizarAgenda(sock, url_sheets, origen = 'automático') {
    guardarLogLocal(`🔄 Sincronizando agenda (${origen})...`);
    const data = await obtenerTodasLasHojas(url_sheets);
    if (!data) return false;
    
    if (data.negocio) {
        configNegocio = data.negocio;
        guardarLogLocal(`🏢 Negocio: ${configNegocio.RAZON_SOCIAL || 'Cargado'}`);
    }
    
    const hojasEnvios = identificarHojasDeEnvios(data);
    tareasProgramadas = consolidarTareas(hojasEnvios);
    reiniciarProgramador(sock);
    guardarLogLocal(`✅ Sincronización completada`);
    return true;
}

function obtenerProximoHorario(tareas) {
    const ahora = new Date();
    const horaActual = ahora.getHours();
    const minutoActual = ahora.getMinutes();
    const minutosActuales = horaActual * 60 + minutoActual;
    const diaActual = ahora.toLocaleDateString('es-ES', { weekday: 'long' }).toLowerCase();
    
    let horarioMasCercano = null;
    let diferenciaMinima = Infinity;
    
    for (const tarea of tareas) {
        if (!tarea.dias.includes(diaActual)) continue;
        const [horaStr, minutoStr] = tarea.horario.split(':');
        const minutosTarea = parseInt(horaStr) * 60 + parseInt(minutoStr);
        if (minutosTarea <= minutosActuales) continue;
        const diferencia = minutosTarea - minutosActuales;
        if (diferencia < diferenciaMinima) {
            diferenciaMinima = diferencia;
            horarioMasCercano = {
                horario: tarea.horario,
                diferenciaMinutos: diferencia,
                tareasEnEsteHorario: [tarea]
            };
        } else if (diferencia === diferenciaMinima && horarioMasCercano) {
            horarioMasCercano.tareasEnEsteHorario.push(tarea);
        }
    }
    return horarioMasCercano;
}

function ejecutarEnvios(sock, tareasDelHorario) {
    guardarLogLocal(`🚀 Ejecutando ${tareasDelHorario.length} envíos para horario ${tareasDelHorario[0].horario}`);
    
    (async () => {
        for (let i = 0; i < tareasDelHorario.length; i++) {
            const grupo = tareasDelHorario[i];
            try {
                guardarLogLocal(`📤 Enviando a: ${grupo.nombre} (${grupo.id})`);
                await sock.sendPresenceUpdate('composing', grupo.id);
                await delay(4000);
                const mensajeLimpio = aplicarSpintax(grupo.mensaje);
                await sock.sendMessage(grupo.id, { text: mensajeLimpio });
                
                if (grupo.archivo) {
                    const ruta = `${CONFIG.ruta_raiz_almacenamiento}${grupo.archivo}`;
                    if (fs.existsSync(ruta)) {
                        if (ruta.endsWith('.mp3') || ruta.endsWith('.ogg')) {
                            await sock.sendMessage(grupo.id, { audio: { url: ruta }, mimetype: 'audio/mp4', ptt: true });
                        } else if (ruta.endsWith('.mp4')) {
                            await sock.sendMessage(grupo.id, { video: { url: ruta }, caption: grupo.caption || '' });
                        } else {
                            await sock.sendMessage(grupo.id, { image: { url: ruta }, caption: grupo.caption || '' });
                        }
                    }
                }
                
                if (i < tareasDelHorario.length - 1) {
                    const delayEntre = Math.floor(Math.random() * (CONFIG.delay_entre_envios_max - CONFIG.delay_entre_envios_min + 1) + CONFIG.delay_entre_envios_min) * 1000;
                    await delay(delayEntre);
                }
            } catch (error) {
                guardarLogLocal(`❌ Error enviando a ${grupo.nombre}: ${error.message}`);
            }
        }
        guardarLogLocal(`✅ Envíos completados para horario ${tareasDelHorario[0].horario}`);
        reiniciarProgramador(sock);
    })();
}

function reiniciarProgramador(sock) {
    if (temporizadorActivo) clearTimeout(temporizadorActivo);
    if (!tareasProgramadas || tareasProgramadas.length === 0) {
        guardarLogLocal("⏸️ No hay tareas programadas");
        return;
    }
    const proximo = obtenerProximoHorario(tareasProgramadas);
    if (!proximo) {
        guardarLogLocal("⏸️ No hay más horarios para hoy. Esperando próximo día...");
        temporizadorActivo = setTimeout(() => reiniciarProgramador(sock), 24 * 60 * 60 * 1000);
        return;
    }
    const tiempoEsperaMs = proximo.diferenciaMinutos * 60 * 1000;
    guardarLogLocal(`⏰ Próximo envío en ${proximo.diferenciaMinutos} minutos (${proximo.horario}) - ${proximo.tareasEnEsteHorario.length} tareas`);
    temporizadorActivo = setTimeout(() => ejecutarEnvios(sock, proximo.tareasEnEsteHorario), tiempoEsperaMs);
}

async function registrarDueno(sock, numeroDueno) {
    const jidTentativo = numeroDueno.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
    guardarLogLocal(`📨 Enviando solicitud de confirmación al dueño...`);
    await sock.sendMessage(jidTentativo, {
        text: "🔐 *Confirmación de Dueño*\n\nPor favor, responde este mensaje con:\n\n*soy el dueño*\n\nPara confirmar que eres el administrador del bot."
    });
    
    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            guardarLogLocal("⏰ Tiempo de espera agotado");
            resolve(null);
        }, 120000);
        
        const handler = (msg) => {
            const mensaje = msg.messages[0];
            if (!mensaje.message || mensaje.key.fromMe) return;
            const remitente = mensaje.key.remoteJid;
            const texto = (mensaje.message.conversation || mensaje.message.extendedTextMessage?.text || "").toLowerCase();
            if (remitente === jidTentativo && texto.includes("soy el dueño")) {
                clearTimeout(timeout);
                sock.ev.off('messages.upsert', handler);
                fs.writeFileSync(CONFIG.archivo_dueno, remitente);
                guardarLogLocal(`✅ Dueño registrado: ${remitente}`);
                sock.sendMessage(remitente, { text: "✅ *Confirmación exitosa*\n\nYa eres el dueño del bot. Usa el comando *actualizar* para sincronizar datos." });
                resolve(remitente);
            }
        };
        sock.ev.on('messages.upsert', handler);
    });
}

async function iniciarWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        browser: Browsers.ubuntu('Chrome'),
        logger: pino({ level: 'silent' })
    });
    
    sock.ev.on('creds.update', saveCreds);
    
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'open') {
            guardarLogLocal('✅ Conexión establecida con WhatsApp');
            const authState = await useMultiFileAuthState('auth_info_baileys');
            if (authState.state.creds.me) {
                botJid = authState.state.creds.me.id;
                guardarLogLocal(`🤖 Bot ID: ${botJid}`);
            }
            
            if (!fs.existsSync(CONFIG.archivo_dueno)) {
                guardarLogLocal("👤 No hay dueño registrado. Iniciando registro...");
                const numDueno = await question('👤 Escribe el número del DUEÑO (ej: 52155...): ');
                const jidRegistrado = await registrarDueno(sock, numDueno);
                if (!jidRegistrado) {
                    guardarLogLocal("❌ No se pudo registrar al dueño");
                    process.exit(1);
                }
            }
            
            if (fs.existsSync(CONFIG.archivo_url)) {
                const url = fs.readFileSync(CONFIG.archivo_url, 'utf-8').trim();
                await actualizarAgenda(sock, url, 'inicial');
            }
        }
        
        if (connection === 'close') {
            const reason = new Boom(lastDisconnect?.error)?.output.statusCode;
            if (reason !== DisconnectReason.loggedOut) {
                setTimeout(() => iniciarWhatsApp(), 5000);
            }
        }
    });
    
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const remitente = msg.key.remoteJid;
        if (remitente === 'status@broadcast') return;
        const texto = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase();
        const usuarioId = msg.key.participant || remitente;
        const mensajeId = msg.key.id;
        if (mensajesEnProcesamiento.has(mensajeId)) return;
        mensajesEnProcesamiento.add(mensajeId);
        
        const jidDueno = fs.existsSync(CONFIG.archivo_dueno) ? fs.readFileSync(CONFIG.archivo_dueno, 'utf-8').trim() : null;
        const esDueno = remitente === jidDueno;
        
        if (esDueno && texto === 'actualizar') {
            const url = fs.readFileSync(CONFIG.archivo_url, 'utf-8').trim();
            await sock.sendMessage(remitente, { text: '🔄 Sincronizando agenda...' });
            await actualizarAgenda(sock, url, 'manual');
            await sock.sendMessage(remitente, { text: '✅ Agenda actualizada correctamente.' });
            mensajesEnProcesamiento.delete(mensajeId);
            return;
        }
        
        const esMencion = botEsMencionado(msg.message, botJid);
        const esRespuesta = esRespuestaABot(msg.message, botJid);
        
        if (esMencion || esRespuesta) {
            const respuesta = obtenerSinonimo('agradecimientos');
            await sock.sendPresenceUpdate('composing', remitente);
            await delay(2000);
            await sock.sendMessage(remitente, { text: `@${usuarioId.split('@')[0]} ${respuesta}`, mentions: [usuarioId] });
            mensajesEnProcesamiento.delete(mensajeId);
            return;
        }
        
        const tipoNegocio = clasificarConsultaNegocio(texto);
        if (tipoNegocio) {
            const respuesta = generarRespuestaNegocio(tipoNegocio);
            await sock.sendPresenceUpdate('composing', remitente);
            await delay(2000);
            await sock.sendMessage(remitente, { text: `@${usuarioId.split('@')[0]} ${respuesta}`, mentions: [usuarioId] });
            mensajesEnProcesamiento.delete(mensajeId);
            return;
        }
        
        mensajesEnProcesamiento.delete(mensajeId);
    });
    
    const credsPath = 'auth_info_baileys/creds.json';
    if (!fs.existsSync(credsPath)) {
        console.log('\n====================================');
        console.log('📱 CONFIGURACIÓN DE NÚMERO BOT');
        console.log('====================================');
        const numeroBot = await question('Escribe el número que será el BOT (ej: 52155...): ');
        
        await new Promise((resolve) => {
            const checkConnection = (update) => {
                if (update.connection === 'open') {
                    sock.ev.off('connection.update', checkConnection);
                    resolve();
                }
            };
            sock.ev.on('connection.update', checkConnection);
            setTimeout(resolve, 30000);
        });
        
        try {
            const code = await sock.requestPairingCode(numeroBot.replace(/[^0-9]/g, ''));
            console.log(`\n🔑 CÓDIGO DE VINCULACIÓN: ${code}\n`);
        } catch (error) {
            guardarLogLocal(`❌ Error al solicitar pairing code: ${error.message}`);
        }
    } else {
        guardarLogLocal("🔑 Sesión existente encontrada");
    }
}

iniciarWhatsApp().catch(err => guardarLogLocal(`❌ FATAL: ${err.message}`));
