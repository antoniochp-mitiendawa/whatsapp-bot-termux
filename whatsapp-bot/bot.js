// ============================================
// BOT DE WHATSAPP PARA TERMUX
// Versión: 46.1 - FILTRO DE ESTADOS + MENCIONES + TEXTOS PROFESIONALES
// CORRECCIÓN: Ruta multimedia en /storage/emulated/0/
// ============================================

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cron = require('node-cron');
const readline = require('readline');
const pino = require('pino');
const { getLinkPreview } = require('link-preview-js');
const crypto = require('crypto');
const { makeInMemoryStore } = require('@rodrigogs/baileys-store');

const CONFIG = {
    carpeta_sesion: './sesion_whatsapp',
    archivo_url: '../url_sheets.txt',
    archivo_agenda: './agenda.json',
    archivo_store: './baileys_store.json',
    tiempo_entre_mensajes_min: 1,
    tiempo_entre_mensajes_max: 5,
    tiempo_typing: 3000,
    carpeta_logs: './logs',
    carpeta_cache: './cache',
    numero_telefono: '',
    horarios_actualizacion: ['06:00'],
    dias_retencion_store: 30,
    carpeta_multimedia: '/storage/emulated/0/',
    tiempo_espera_grupos: 30000,
    delay_entre_archivos: 3,
    textos_por_tipo: {
        imagen: '',
        video: '🎬 Te comparto un video de *[PRODUCTO]*',
        audio: '🔊 Escucha más información sobre *[PRODUCTO]*',
        documento: '📄 Aquí tienes más información de *[PRODUCTO]*'
    },
    textos_sinonimos: {
        saludos: ["¡Hola! 👋", "¡Buen día! ☀️", "¡Hola, gracias por contactarnos! 😊", "¡Un gusto saludarte! 🤝", "¡Gracias por comunicarte! ✨"],
        agradecimientos: ["¡Gracias! 🙏", "Te lo agradecemos ✨", "¡Gracias por tu interés! 🌟", "Agradecemos tu mensaje 💫", "¡Gracias por escribirnos!"],
        ofertas: ["¿Te interesa? 🤔", "¿Te gustaría adquirir uno? 🛍️", "¿Quieres obtener más información? 📋", "¿Te gustaría conocer más detalles? ✨", "Estamos a tus órdenes para lo que necesites 🤝"],
        contacto: ["Estamos a tus órdenes 🤝", "Aquí estamos para ayudarte 👋", "Puedes escribirnos cuando quieras 📱", "Para cualquier duda, aquí estamos 💬", "Cuenta con nosotros para lo que necesites 🌟"],
        despedidas: ["¡Hasta luego! 👋", "¡Que tengas buen día! ☀️", "¡Quedamos atentos! ✨", "¡Cuidate mucho! 🙏", "¡Para cualquier cosa, aquí estamos!"]
    },
    respuestas_reacciones: {
        "👍": [
            "👋 ¡Gracias por tu interés en *[PRODUCTO]*! Está disponible. ¿Te gustaría adquirir uno?",
            "👍 ¡Gracias por el like! *[PRODUCTO]* es un producto excelente. ¿Quieres más información?",
            "🙌 Agradecemos tu interés en *[PRODUCTO]*. Estamos a tus órdenes",
            "✨ ¡Gracias por tu atención! *[PRODUCTO]* es uno de los más solicitados. ¿Te gustaría conocer más?",
            "👏 Apreciamos tu interés en *[PRODUCTO]*. Para cualquier duda, aquí estamos"
        ],
        "❤️": [
            "❤️ ¡Gracias por tu interés en *[PRODUCTO]*! Nos da gusto que te guste",
            "💖 ¡Qué bonito! *[PRODUCTO]* es especial. ¿Quieres más información?",
            "💝 ¡Gracias por el corazón! ¿Te gustaría adquirir *[PRODUCTO]*?",
            "💗 Agradecemos tu interés en *[PRODUCTO]*. Estamos aquí para ayudarte",
            "💕 ¡Gracias! *[PRODUCTO]* tiene excelentes comentarios. ¿Te gustaría conocer más detalles?"
        ],
        "😮": [
            "😮 ¿Sorprendido con *[PRODUCTO]*? Es realmente increíble, ¿quieres conocer más?",
            "😲 ¡Vaya! *[PRODUCTO]* impacta a primera vista. ¿Te gustaría saber más?",
            "🤯 Increíble, ¿verdad? *[PRODUCTO]* tiene características únicas. ¿Te interesa?",
            "😱 ¡Nos encanta tu reacción! *[PRODUCTO]* es único. ¿Te gustaría adquirirlo?",
            "🌟 Así es, *[PRODUCTO]* es sorprendente. ¿Quieres más información?"
        ],
        "🙏": [
            "🙏 ¡Gracias a ti! Para cualquier duda sobre *[PRODUCTO]*, aquí estamos",
            "🤝 Apreciamos tu mensaje. ¿Necesitas información adicional de *[PRODUCTO]*?",
            "✨ Gracias por comunicarte. ¿Te podemos ayudar con algo más de *[PRODUCTO]*?",
            "💫 ¡Un placer! Estamos aquí para lo que necesites sobre *[PRODUCTO]*",
            "🌟 Gracias por tu interés. ¿Te gustaría conocer más de *[PRODUCTO]*?"
        ],
        "😂": [
            "😂 Nos alegra que te cause interés *[PRODUCTO]*. ¿Quieres ver más productos similares?",
            "😄 ¡Qué bien! ¿Te gustaría conocer otros productos de nuestra línea?",
            "🤣 Gracias por tu mensaje. ¿Te interesa *[PRODUCTO]* o algún otro producto?",
            "😆 ¡Buenísimo! Si quieres más información de *[PRODUCTO]*, aquí estamos",
            "🎉 Nos da gusto tu interés. ¿Te contamos más de *[PRODUCTO]*?"
        ]
    },
    respuestas_consultas: {
        generica: [
            "👕 *[PRODUCTO]* - [DESCRIPCION]. Precio: 💵 [PRECIO]",
            "✨ *[PRODUCTO]*: [DESCRIPCION]. Valor: 💵 [PRECIO]",
            "📦 *[PRODUCTO]* disponible. [DESCRIPCION] - 💵 [PRECIO]",
            "🎁 *[PRODUCTO]*: [DESCRIPCION]. Precio: 💵 [PRECIO]",
            "🌟 *[PRODUCTO]* - [DESCRIPCION] - 💵 [PRECIO]. ¿Te gustaría conocer más?"
        ],
        precio: [
            "*[PRODUCTO]* tiene un precio de 💵 [PRECIO]. ¿Te gustaría adquirir uno?",
            "💰 Valor de *[PRODUCTO]*: 💵 [PRECIO]. ¿Te interesa?",
            "💵 *[PRODUCTO]*: 💵 [PRECIO]. ¿Quieres más información?",
            "El precio de *[PRODUCTO]* es 💵 [PRECIO]. Estamos a tus órdenes",
            "💲 *[PRODUCTO]*: 💵 [PRECIO]. ¿Te gustaría obtener uno?"
        ],
        descripcion: [
            "📝 *[PRODUCTO]*: [DESCRIPCION]. Precio: 💵 [PRECIO]",
            "✨ Características de *[PRODUCTO]*: [DESCRIPCION]. Valor: 💵 [PRECIO]",
            "🔍 *[PRODUCTO]*: [DESCRIPCION]. ¿Te gustaría adquirirlo?",
            "📋 *[PRODUCTO]*: [DESCRIPCION]. Precio: 💵 [PRECIO]",
            "🎯 *[PRODUCTO]*: [DESCRIPCION]. ¿Quieres más información?"
        ]
    },
    palabras_clave_respondibles: {
        precio: ["precio", "cuesta", "valor", "$$", "💰", "💵", "costó", "precio?", "cuánto", "cuanto", "costo", "vale", "valor?", "precio", "costo"],
        info: ["info", "información", "características", "descripción", "qué es", "detalles", "descripcion", "caracteristicas", "como es", "que tiene", "especificaciones"],
        generica: ["más", "info", "información", "quiero saber", "dime", "mas", "informacion", "saber", "conocer", "interesa", "me interesa", "quisiera saber"]
    },
    delay_respuesta_min: 1,
    delay_respuesta_max: 3
};

let timersEnvios = [];

if (!fs.existsSync(CONFIG.carpeta_logs)) {
    fs.mkdirSync(CONFIG.carpeta_logs);
}
if (!fs.existsSync(CONFIG.carpeta_sesion)) {
    fs.mkdirSync(CONFIG.carpeta_sesion);
}
if (!fs.existsSync(CONFIG.carpeta_cache)) {
    fs.mkdirSync(CONFIG.carpeta_cache);
}
if (!fs.existsSync(CONFIG.carpeta_multimedia)) {
    try {
        fs.mkdirSync(CONFIG.carpeta_multimedia, { recursive: true });
        console.log('📁 Carpeta multimedia creada:', CONFIG.carpeta_multimedia);
    } catch (error) {
        console.error('❌ Error creando carpeta multimedia:', error.message);
    }
}

console.log('📚 Inicializando Data Store...');
const store = makeInMemoryStore({
    logger: pino({ level: 'silent' }).child({ stream: 'store' })
});

if (fs.existsSync(CONFIG.archivo_store)) {
    store.readFromFile(CONFIG.archivo_store);
    console.log('📚 Data Store cargado desde archivo.');
}

setInterval(() => {
    store.writeToFile(CONFIG.archivo_store);
}, 10_000);

const groupCache = new Map();
let imagenesUsadasEnLote = new Set();
let productosCache = [];
let ultimaActualizacionProductos = 0;
const mensajesEnProcesamiento = new Set();

async function obtenerMetadataGrupoConCache(sock, groupId) {
    try {
        if (groupCache.has(groupId)) {
            const cached = groupCache.get(groupId);
            guardarLogLocal(`   📦 Usando nombre desde caché: ${cached.subject || 'Sin nombre'}`);
            return cached;
        }
        
        guardarLogLocal(`   🌐 Consultando a WhatsApp: ${groupId}`);
        const metadata = await sock.groupMetadata(groupId);
        
        if (metadata) {
            groupCache.set(groupId, metadata);
            guardarLogLocal(`   ✅ Guardado en caché: ${metadata.subject || 'Sin nombre'}`);
        }
        
        return metadata;
    } catch (error) {
        guardarLogLocal(`   ❌ Error consultando grupo: ${error.message}`);
        return null;
    }
}

function buscarTodosLosArchivosMultimedia(nombreBase) {
    try {
        if (!nombreBase || nombreBase.trim() === '') {
            return [];
        }

        const nombreLimpio = nombreBase.trim().toLowerCase();
        guardarLogLocal(`   🔍 Buscando TODOS los archivos que contengan: "${nombreLimpio}" en ${CONFIG.carpeta_multimedia}`);
        
        const archivosEncontrados = [];

        function buscarRecursivo(directorio) {
            try {
                const archivos = fs.readdirSync(directorio);
                
                for (const archivo of archivos) {
                    const rutaCompleta = path.join(directorio, archivo);
                    const estadistica = fs.statSync(rutaCompleta);
                    
                    if (estadistica.isDirectory()) {
                        buscarRecursivo(rutaCompleta);
                    } else {
                        const nombreSinExtension = path.parse(archivo).name.toLowerCase();
                        if (nombreSinExtension.includes(nombreLimpio)) {
                            archivosEncontrados.push({
                                ruta: rutaCompleta,
                                nombre: archivo,
                                nombreBase: path.parse(archivo).name,
                                extension: path.extname(archivo).toLowerCase()
                            });
                        }
                    }
                }
            } catch (error) {}
        }

        buscarRecursivo(CONFIG.carpeta_multimedia);
        
        const ordenPrioridad = {
            'imagen': 1,
            'video': 2,
            'audio': 3,
            'documento': 4
        };
        
        archivosEncontrados.sort((a, b) => {
            const tipoA = obtenerTipoArchivo(a.extension);
            const tipoB = obtenerTipoArchivo(b.extension);
            return (ordenPrioridad[tipoA] || 5) - (ordenPrioridad[tipoB] || 5);
        });
        
        guardarLogLocal(`   ✅ Encontrados ${archivosEncontrados.length} archivos para "${nombreLimpio}"`);
        archivosEncontrados.forEach((arch, idx) => {
            guardarLogLocal(`      ${idx+1}. ${arch.nombre} (${obtenerTipoArchivo(arch.extension)})`);
        });
        
        return archivosEncontrados;
        
    } catch (error) {
        guardarLogLocal(`   ⚠️ Error buscando archivos: ${error.message}`);
        return [];
    }
}

function obtenerTipoArchivo(extension) {
    if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(extension)) {
        return 'imagen';
    }
    else if (['.mp4', '.avi', '.mov', '.mkv', '.webm'].includes(extension)) {
        return 'video';
    }
    else if (['.mp3', '.ogg', '.m4a', '.wav', '.aac', '.opus'].includes(extension)) {
        return 'audio';
    }
    else {
        return 'documento';
    }
}

function obtenerTextoPorTipo(tipo, nombreProducto) {
    let texto = CONFIG.textos_por_tipo[tipo] || '';
    return texto.replace('[PRODUCTO]', nombreProducto);
}

async function enviarMultiplesArchivos(sock, id_grupo, archivos, textoPrincipal, nombreProducto) {
    try {
        let primerArchivo = true;
        
        for (const archivo of archivos) {
            const tipo = obtenerTipoArchivo(archivo.extension);
            const buffer = fs.readFileSync(archivo.ruta);
            
            let textoEnvio = '';
            if (primerArchivo && tipo === 'imagen') {
                textoEnvio = textoPrincipal;
                guardarLogLocal(`   📝 Enviando texto principal con primera imagen`);
            } else {
                textoEnvio = obtenerTextoPorTipo(tipo, nombreProducto);
                if (textoEnvio) {
                    guardarLogLocal(`   📝 Usando texto para ${tipo}: "${textoEnvio}"`);
                }
            }
            
            if (tipo === 'imagen') {
                guardarLogLocal(`   🖼️ Enviando imagen: ${archivo.nombre}`);
                await sock.sendMessage(id_grupo, {
                    image: buffer,
                    caption: textoEnvio || ''
                });
            }
            else if (tipo === 'video') {
                guardarLogLocal(`   🎬 Enviando video: ${archivo.nombre}`);
                await sock.sendMessage(id_grupo, {
                    video: buffer,
                    caption: textoEnvio || ''
                });
            }
            else if (tipo === 'audio') {
                guardarLogLocal(`   🎵 Enviando audio: ${archivo.nombre}`);
                let mimetype = 'audio/mpeg';
                if (archivo.extension === '.ogg') mimetype = 'audio/ogg';
                if (archivo.extension === '.m4a') mimetype = 'audio/mp4';
                if (archivo.extension === '.wav') mimetype = 'audio/wav';
                
                await sock.sendMessage(id_grupo, {
                    audio: buffer,
                    mimetype: mimetype,
                    caption: textoEnvio || ''
                });
            }
            else {
                guardarLogLocal(`   📄 Enviando documento: ${archivo.nombre}`);
                await sock.sendMessage(id_grupo, {
                    document: buffer,
                    fileName: archivo.nombre,
                    mimetype: 'application/octet-stream',
                    caption: textoEnvio || ''
                });
            }
            
            if (archivos.indexOf(archivo) < archivos.length - 1) {
                guardarLogLocal(`   ⏱️ Esperando ${CONFIG.delay_entre_archivos}s antes del siguiente archivo...`);
                await new Promise(resolve => setTimeout(resolve, CONFIG.delay_entre_archivos * 1000));
            }
            
            primerArchivo = false;
        }
        
        return true;
        
    } catch (error) {
        guardarLogLocal(`   ❌ Error enviando múltiples archivos: ${error.message}`);
        return false;
    }
}

function limpiarStoreAntiguo() {
    try {
        guardarLogLocal('🧹 Iniciando limpieza automática del Data Store...');
        
        if (!store || !store.chats) {
            guardarLogLocal('⚠️ Data Store no disponible para limpiar');
            return false;
        }
        
        const fechaLimite = new Date();
        fechaLimite.setDate(fechaLimite.getDate() - CONFIG.dias_retencion_store);
        const timestampLimite = fechaLimite.getTime();
        
        const chats = store.chats.all() || [];
        let mensajesEliminados = 0;
        
        chats.forEach(chat => {
            if (!chat.messages) return;
            
            const mensajesOriginales = Array.from(chat.messages.values());
            const mensajesConservar = mensajesOriginales.filter(msg => {
                const msgTimestamp = msg.messageTimestamp * 1000;
                return msgTimestamp >= timestampLimite;
            });
            
            mensajesEliminados += mensajesOriginales.length - mensajesConservar.length;
            
            if (mensajesConservar.length > 0) {
                const nuevoMapa = new Map();
                mensajesConservar.forEach(msg => {
                    if (msg.key && msg.key.id) {
                        nuevoMapa.set(msg.key.id, msg);
                    }
                });
                chat.messages = nuevoMapa;
            } else {
                chat.messages = new Map();
            }
        });
        
        store.writeToFile(CONFIG.archivo_store);
        guardarLogLocal(`✅ Limpieza completada: ${mensajesEliminados} mensajes antiguos eliminados`);
        return true;
        
    } catch (error) {
        guardarLogLocal(`❌ Error en limpieza del store: ${error.message}`);
        return false;
    }
}

function leerURL() {
    try {
        let urlPath = CONFIG.archivo_url;
        if (!fs.existsSync(urlPath)) {
            urlPath = './url_sheets.txt';
        }
        const url = fs.readFileSync(urlPath, 'utf8').trim();
        console.log('✅ URL de Google Sheets cargada');
        return url;
    } catch (error) {
        console.error('❌ No se pudo leer la URL:', error.message);
        return null;
    }
}

function pedirNumeroSilencioso() {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        rl.question('📱 Introduce tu número (sin +): ', (numero) => {
            rl.close();
            resolve(numero.trim());
        });
    });
}

async function consultarTodosLosGrupos(url) {
    try {
        console.log('🔄 Descargando TODOS los grupos desde Google Sheets...');
        const respuesta = await axios.get(url);
        const data = respuesta.data;
        
        if (data.config) {
            const delayStr = data.config.TIEMPO_ENTRE_MENSAJES;
            if (delayStr && typeof delayStr === 'string' && delayStr.includes('-')) {
                const partes = delayStr.split('-').map(p => parseInt(p.trim()));
                if (partes.length === 2 && !isNaN(partes[0]) && !isNaN(partes[1])) {
                    CONFIG.tiempo_entre_mensajes_min = partes[0];
                    CONFIG.tiempo_entre_mensajes_max = partes[1];
                    console.log(`⏱️  Delay configurado: ${CONFIG.tiempo_entre_mensajes_min}-${CONFIG.tiempo_entre_mensajes_max} segundos`);
                }
            } else if (delayStr && !isNaN(parseInt(delayStr))) {
                const valor = parseInt(delayStr);
                CONFIG.tiempo_entre_mensajes_min = 1;
                CONFIG.tiempo_entre_mensajes_max = valor;
                console.log(`⏱️  Delay configurado: ${CONFIG.tiempo_entre_mensajes_min}-${CONFIG.tiempo_entre_mensajes_max} segundos`);
            }
        }
        
        return data;
    } catch (error) {
        console.error('❌ Error al consultar Google Sheets:', error.message);
        return null;
    }
}

function guardarAgendaLocal(data) {
    try {
        const grupos = data.grupos || [];
        
        const agenda = {
            ultima_actualizacion: new Date().toISOString(),
            config: {
                min: CONFIG.tiempo_entre_mensajes_min,
                max: CONFIG.tiempo_entre_mensajes_max
            },
            pestanas: {},
            grupos: grupos,
            total: grupos.length
        };
        
        grupos.forEach(grupo => {
            if (!agenda.pestanas[grupo.pestana]) {
                agenda.pestanas[grupo.pestana] = {
                    horario: grupo.horario_rector,
                    grupos: []
                };
            }
            agenda.pestanas[grupo.pestana].grupos.push(grupo);
        });
        
        fs.writeFileSync(CONFIG.archivo_agenda, JSON.stringify(agenda, null, 2));
        
        console.log(`✅ Agenda guardada localmente (${grupos.length} grupos en ${Object.keys(agenda.pestanas).length} pestañas)`);
        
        return true;
    } catch (error) {
        console.error('❌ Error guardando agenda:', error.message);
        return false;
    }
}

let agendaEnMemoria = null;

function cargarAgendaLocal() {
    try {
        if (agendaEnMemoria) {
            return agendaEnMemoria;
        }
        
        if (!fs.existsSync(CONFIG.archivo_agenda)) {
            console.log('📁 No hay agenda local (primera vez)');
            agendaEnMemoria = { grupos: [], pestanas: {}, total: 0 };
            return agendaEnMemoria;
        }
        const agenda = JSON.parse(fs.readFileSync(CONFIG.archivo_agenda, 'utf8'));
        
        if (agenda.config) {
            CONFIG.tiempo_entre_mensajes_min = agenda.config.min || 1;
            CONFIG.tiempo_entre_mensajes_max = agenda.config.max || 5;
        }
        
        agendaEnMemoria = agenda;
        console.log(`📋 Agenda cargada (${agenda.grupos?.length || 0} grupos)`);
        return agendaEnMemoria;
    } catch (error) {
        console.error('❌ Error cargando agenda:', error.message);
        agendaEnMemoria = { grupos: [], pestanas: {}, total: 0 };
        return agendaEnMemoria;
    }
}

function recargarAgenda() {
    agendaEnMemoria = null;
    return cargarAgendaLocal();
}

async function actualizarAgenda(sock, url_sheets, origen = 'automático') {
    try {
        guardarLogLocal(`🔄 Actualizando agenda (${origen})...`);
        
        const data = await consultarTodosLosGrupos(url_sheets);
        
        if (!data) {
            guardarLogLocal('⚠️ No se pudo conectar con Google Sheets');
            return false;
        }
        
        if (data.error) {
            guardarLogLocal(`⚠️ Error en Sheets: ${data.error}`);
            return false;
        }
        
        if (guardarAgendaLocal(data)) {
            recargarAgenda();
            const total = data.grupos?.length || 0;
            guardarLogLocal(`✅ Agenda actualizada: ${total} grupos`);
            
            if (data.productos && Array.isArray(data.productos)) {
                productosCache = data.productos;
                ultimaActualizacionProductos = Date.now();
                guardarLogLocal(`📦 Caché de productos actualizado: ${productosCache.length} productos`);
            }
            
            if (sock) {
                reprogramarTodosLosEnvios(sock);
            }
            
            return true;
        }
        return false;
    } catch (error) {
        guardarLogLocal(`❌ Error actualizando agenda: ${error.message}`);
        return false;
    }
}

function guardarLogLocal(texto) {
    const fecha = new Date().toISOString().split('T')[0];
    const logFile = path.join(CONFIG.carpeta_logs, `${fecha}.log`);
    const hora = new Date().toLocaleTimeString();
    const linea = `[${hora}] ${texto}`;
    
    fs.appendFileSync(logFile, linea + '\n');
    
    if (texto.includes('📩 MENSAJE RECIBIDO')) {
        console.log('\x1b[32m%s\x1b[0m', `📩 ${texto}`);
    } else if (texto.includes('⚡ PRIORITARIO')) {
        console.log('\x1b[33m%s\x1b[0m', `⚡ ${texto}`);
    } else if (texto.includes('✅') || texto.includes('✔️')) {
        console.log('\x1b[36m%s\x1b[0m', `✅ ${texto}`);
    } else if (texto.includes('❌') || texto.includes('⚠️')) {
        console.log('\x1b[31m%s\x1b[0m', `❌ ${texto}`);
    } else {
        console.log(`📝 ${texto}`);
    }
}

async function simularTyping(sock, id_destino, duracion) {
    try {
        await sock.sendPresenceUpdate('composing', id_destino);
        await new Promise(resolve => setTimeout(resolve, duracion * 1000));
        await sock.sendPresenceUpdate('paused', id_destino);
    } catch (error) {}
}

function generarHashURL(url) {
    return crypto.createHash('md5').update(url).digest('hex');
}

async function obtenerUrlImagenPreview(url) {
    try {
        const previewData = await getLinkPreview(url, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            followRedirects: 'follow'
        });
        
        if (previewData.images && previewData.images.length > 0) {
            return previewData.images[0];
        }
        return null;
    } catch (error) {
        return null;
    }
}

async function obtenerImagenConCache(url) {
    try {
        const hash = generarHashURL(url);
        const rutaImagen = path.join(CONFIG.carpeta_cache, `${hash}.jpg`);
        
        if (fs.existsSync(rutaImagen)) {
            return fs.readFileSync(rutaImagen);
        }
        
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'arraybuffer',
            timeout: 10000
        });
        
        const buffer = Buffer.from(response.data);
        fs.writeFileSync(rutaImagen, buffer);
        imagenesUsadasEnLote.add(rutaImagen);
        
        return buffer;
    } catch (error) {
        return null;
    }
}

function limpiarCacheImagenes() {
    try {
        const cantidad = imagenesUsadasEnLote.size;
        if (cantidad === 0) return;
        
        for (const ruta of imagenesUsadasEnLote) {
            try {
                if (fs.existsSync(ruta)) {
                    fs.unlinkSync(ruta);
                }
            } catch (e) {}
        }
        
        imagenesUsadasEnLote.clear();
    } catch (error) {}
}

function obtenerEmojiInteligente(producto) {
    if (!producto) return '🎁';
    
    const texto = producto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    if (texto.includes('vaso') || texto.includes('taza') || texto.includes('botella') || texto.includes('termo')) return '🥤';
    if (texto.includes('comida') || texto.includes('hamburguesa') || texto.includes('pizza')) return '🍔';
    if (texto.includes('gorra') || texto.includes('camisa') || texto.includes('ropa')) return '👕';
    if (texto.includes('telefono') || texto.includes('celular') || texto.includes('computadora')) return '📱';
    if (texto.includes('pelota') || texto.includes('deporte') || texto.includes('bicicleta')) return '⚽';
    if (texto.includes('mueble') || texto.includes('silla') || texto.includes('mesa')) return '🏠';
    
    return '🎁';
}

async function obtenerProductosDesdeSheets(url) {
    try {
        const respuesta = await axios.get(url);
        const data = respuesta.data;
        
        if (!data || !data.grupos) {
            return [];
        }
        
        const productosMap = new Map();
        
        data.grupos.forEach(grupo => {
            if (grupo.mensaje && grupo.mensaje.includes('*')) {
                const match = grupo.mensaje.match(/\*([^*]+)\*/);
                if (match && match[1]) {
                    const nombreProducto = match[1].trim();
                    const archivoMatch = grupo.mensaje.match(/\(([^)]+)\)/);
                    if (archivoMatch && archivoMatch[1]) {
                        productosMap.set(nombreProducto, archivoMatch[1].trim());
                    }
                }
            }
        });
        
        return Array.from(productosMap.entries()).map(([producto, archivo]) => ({
            producto: producto,
            archivo: archivo
        }));
        
    } catch (error) {
        return [];
    }
}

async function actualizarCacheProductos(url) {
    try {
        const ahora = Date.now();
        if (ahora - ultimaActualizacionProductos < 3600000 && productosCache.length > 0) {
            return productosCache;
        }
        
        productosCache = await obtenerProductosDesdeSheets(url);
        ultimaActualizacionProductos = ahora;
        guardarLogLocal(`📦 Caché de productos actualizado: ${productosCache.length} productos`);
        return productosCache;
        
    } catch (error) {
        return productosCache;
    }
}

function buscarArchivosPorProducto(nombreProducto) {
    if (!nombreProducto || productosCache.length === 0) return [];
    
    const producto = productosCache.find(p => 
        p.producto.toLowerCase() === nombreProducto.toLowerCase()
    );
    
    if (producto) {
        const archivoLimpio = producto.archivo.replace(/^\(|\)$/g, '').trim();
        guardarLogLocal(`   📦 Producto encontrado: "${producto.producto}" → archivo base: "${archivoLimpio}"`);
        return buscarTodosLosArchivosMultimedia(archivoLimpio);
    }
    
    guardarLogLocal(`   ⚠️ Producto no encontrado en caché: "${nombreProducto}"`);
    return [];
}

function extraerNombreProducto(texto) {
    if (!texto) return null;
    const matches = [...texto.matchAll(/\*([^*]+)\*/g)];
    if (matches.length > 0) {
        const ultimo = matches[matches.length - 1];
        return ultimo[1].trim();
    }
    return null;
}

function procesarSpinEnMensaje(texto) {
    if (!texto || typeof texto !== 'string') return texto;
    
    let textoProcesado = texto;
    let modificado = false;
    
    const spinTexRegex = /\{spin\|(.*?)\}/gi;
    let match;
    
    while ((match = spinTexRegex.exec(texto)) !== null) {
        const contenido = match[1];
        const opciones = contenido.split('|').map(op => op.trim()).filter(op => op !== '');
        
        if (opciones.length > 0) {
            const opcionAleatoria = opciones[Math.floor(Math.random() * opciones.length)];
            textoProcesado = textoProcesado.replace(match[0], opcionAleatoria);
            modificado = true;
        }
    }
    
    const spinEmojiRegex = /\{([^}]+)\}/g;
    
    while ((match = spinEmojiRegex.exec(texto)) !== null) {
        if (match[0].startsWith('{spin|')) continue;
        
        const contenido = match[1];
        const opciones = contenido.split('|').map(op => op.trim()).filter(op => op !== '');
        
        if (opciones.length > 0) {
            const opcionAleatoria = opciones[Math.floor(Math.random() * opciones.length)];
            textoProcesado = textoProcesado.replace(match[0], opcionAleatoria);
            modificado = true;
        }
    }
    
    return textoProcesado;
}

async function enviarMensaje(sock, id_grupo, mensajeOriginal) {
    try {
        if (!id_grupo || !id_grupo.includes('@g.us')) {
            return { resultado: 'ERROR: ID inválido', tiempo: 0 };
        }
        
        const inicioEnvio = Date.now();
        const mensajeProcesado = procesarSpinEnMensaje(mensajeOriginal);
        const mensajeFinal = String(mensajeProcesado);
        
        const nombreProducto = extraerNombreProducto(mensajeFinal);
        
        if (nombreProducto) {
            guardarLogLocal(`   🔍 Producto detectado en mensaje: "${nombreProducto}"`);
            
            const archivos = buscarArchivosPorProducto(nombreProducto);
            
            if (archivos.length > 0) {
                guardarLogLocal(`   📦 Encontrados ${archivos.length} archivos para enviar`);
                const textoLimpio = mensajeFinal.replace(/\([^)]+\)/g, '').trim();
                await enviarMultiplesArchivos(sock, id_grupo, archivos, textoLimpio, nombreProducto);
                return {
                    resultado: `MÚLTIPLES ARCHIVOS (${archivos.length})`,
                    tiempo: (Date.now() - inicioEnvio) / 1000
                };
            }
        }
        
        await sock.sendMessage(id_grupo, { text: mensajeFinal });
        return {
            resultado: 'TEXTO ENVIADO',
            tiempo: (Date.now() - inicioEnvio) / 1000
        };
        
    } catch (error) {
        guardarLogLocal(`   ❌ Error en envío: ${error.message}`);
        return {
            resultado: 'ERROR: ' + error.message.substring(0, 50),
            tiempo: 0
        };
    }
}

function obtenerDelayAleatorio() {
    const min = CONFIG.tiempo_entre_mensajes_min || 1;
    const max = CONFIG.tiempo_entre_mensajes_max || 5;
    return Math.floor(Math.random() * (max - min + 1) + min);
}

async function verificarMensajesLocales(sock) {
    try {
        const agenda = agendaEnMemoria || cargarAgendaLocal();
        
        if (!agenda.grupos || agenda.grupos.length === 0) {
            return;
        }

        const ahora = new Date();
        const horaActual = ahora.getHours().toString().padStart(2,'0') + ':' + 
                          ahora.getMinutes().toString().padStart(2,'0');
        const diaSemana = ['D','L','M','MI','J','V','S'][ahora.getDay()];

        const pestanasAHora = [];
        
        Object.keys(agenda.pestanas || {}).forEach(nombrePestana => {
            const pestana = agenda.pestanas[nombrePestana];
            if (pestana.horario === horaActual) {
                pestanasAHora.push({
                    nombre: nombrePestana,
                    horario: pestana.horario,
                    grupos: pestana.grupos.filter(g => g.activo === 'SI')
                });
            }
        });

        if (pestanasAHora.length === 0) {
            return;
        }

        guardarLogLocal(`⏰ HORA DE ENVÍO DETECTADA: ${horaActual} - Procesando ${pestanasAHora.length} pestañas`);
        imagenesUsadasEnLote.clear();

        let ultimoTiempoEnvio = 0;

        for (const pestana of pestanasAHora) {
            guardarLogLocal(`📊 Pestaña "${pestana.nombre}" - Enviando ${pestana.grupos.length} mensajes`);

            for (const grupo of pestana.grupos) {
                const diasPermitidos = grupo.dias ? grupo.dias.split(',').map(d => d.trim()) : [];
                if (diasPermitidos.length > 0 && !diasPermitidos.includes(diaSemana)) {
                    guardarLogLocal(`   ⏭️ ${grupo.nombre || grupo.id} - no corresponde hoy`);
                    continue;
                }

                const delayMinimoSegundos = obtenerDelayAleatorio();
                const tiempoDesdeUltimoEnvio = (Date.now() - ultimoTiempoEnvio) / 1000;
                
                if (ultimoTiempoEnvio > 0 && tiempoDesdeUltimoEnvio < delayMinimoSegundos) {
                    const tiempoEspera = delayMinimoSegundos - tiempoDesdeUltimoEnvio;
                    guardarLogLocal(`   ⏱️ Delay inteligente: esperando ${tiempoEspera.toFixed(1)}s`);
                    await new Promise(resolve => setTimeout(resolve, tiempoEspera * 1000));
                }
                
                await simularTyping(sock, grupo.id, delayMinimoSegundos * 0.5);
                
                const resultado = await enviarMensaje(sock, grupo.id, grupo.mensaje);
                
                ultimoTiempoEnvio = Date.now();
                guardarLogLocal(`      Resultado: ${resultado.resultado} (${resultado.tiempo.toFixed(1)}s)`);
            }
        }

        limpiarCacheImagenes();

    } catch (error) {
        guardarLogLocal(`❌ ERROR: ${error.message}`);
        limpiarCacheImagenes();
    }
}

function calcularTiempoHastaHorario(horario) {
    const ahora = new Date();
    const [horas, minutos] = horario.split(':').map(Number);
    
    const proximo = new Date(ahora);
    proximo.setHours(horas, minutos, 0, 0);
    
    if (proximo <= ahora) {
        proximo.setDate(proximo.getDate() + 1);
    }
    
    return proximo - ahora;
}

function programarHorario(horario, sock) {
    const tiempoEspera = calcularTiempoHastaHorario(horario);
    const fechaEjecucion = new Date(Date.now() + tiempoEspera);
    
    guardarLogLocal(`   📅 Programado: ${horario} (en ${Math.round(tiempoEspera/60000)} minutos)`);
    
    const timer = setTimeout(async () => {
        guardarLogLocal(`⏰ EJECUTANDO HORARIO PROGRAMADO: ${horario}`);
        await verificarMensajesLocales(sock);
        programarHorario(horario, sock);
    }, tiempoEspera);
    
    timersEnvios.push(timer);
    return timer;
}

function cancelarTodosLosTimers() {
    if (timersEnvios.length > 0) {
        guardarLogLocal(`🔄 Cancelando ${timersEnvios.length} timers activos...`);
        timersEnvios.forEach(timer => clearTimeout(timer));
        timersEnvios = [];
    }
}

function reprogramarTodosLosEnvios(sock) {
    cancelarTodosLosTimers();
    
    const agenda = cargarAgendaLocal();
    const horariosUnicos = new Set();
    
    if (agenda.pestanas) {
        Object.values(agenda.pestanas).forEach(pestana => {
            if (pestana.horario) {
                horariosUnicos.add(pestana.horario);
            }
        });
    }
    
    guardarLogLocal(`🔄 Reprogramando ${horariosUnicos.size} horarios de envío...`);
    
    horariosUnicos.forEach(horario => {
        programarHorario(horario, sock);
    });
}

async function obtenerGruposConEspera(sock) {
    return new Promise((resolve) => {
        try {
            const gruposIds = new Set();
            let timeoutCompletado = false;
            
            const manejarGroupsUpdate = (updates) => {
                if (timeoutCompletado) return;
                
                updates.forEach(update => {
                    if (update.id && update.id.endsWith('@g.us')) {
                        gruposIds.add(update.id);
                    }
                });
            };
            
            sock.ev.on('groups.update', manejarGroupsUpdate);
            
            setTimeout(() => {
                timeoutCompletado = true;
                sock.ev.off('groups.update', manejarGroupsUpdate);
                resolve(Array.from(gruposIds));
            }, CONFIG.tiempo_espera_grupos);
            
        } catch (error) {
            resolve([]);
        }
    });
}

async function obtenerTodosLosGruposWhatsApp(sock) {
    try {
        guardarLogLocal('🔍 Ejecutando consulta MASIVA de grupos...');
        
        if (typeof sock.groupFetchAllParticipatingGroups !== 'function') {
            guardarLogLocal('⚠️ Función no disponible, usando método alternativo');
            return null;
        }
        
        const gruposDict = await sock.groupFetchAllParticipatingGroups();
        
        if (!gruposDict || typeof gruposDict !== 'object') {
            return null;
        }
        
        const gruposArray = Object.entries(gruposDict).map(([id, info]) => ({
            id: id,
            info: info
        }));
        
        guardarLogLocal(`✅ Consulta masiva exitosa: ${gruposArray.length} grupos`);
        return gruposArray;
        
    } catch (error) {
        guardarLogLocal(`❌ Error en consulta masiva: ${error.message}`);
        return null;
    }
}

async function obtenerGruposDesdeStore(sock, usarEspera = false) {
    try {
        guardarLogLocal('🔍 Obteniendo grupos...');
        
        const gruposMasivos = await obtenerTodosLosGruposWhatsApp(sock);
        
        if (gruposMasivos && gruposMasivos.length > 0) {
            const listaGrupos = [];
            
            for (const grupo of gruposMasivos) {
                let nombreGrupo = 'Sin nombre';
                const info = grupo.info;
                
                if (info.name && info.name !== 'Sin nombre') nombreGrupo = info.name;
                else if (info.subject && info.subject !== 'Sin nombre') nombreGrupo = info.subject;
                else if (info.metadata && info.metadata.subject) nombreGrupo = info.metadata.subject;
                else if (info.title) nombreGrupo = info.title;
                
                if (!groupCache.has(grupo.id)) {
                    groupCache.set(grupo.id, info);
                }
                
                listaGrupos.push({
                    id: grupo.id,
                    nombre: nombreGrupo
                });
            }
            
            guardarLogLocal(`✅ ${listaGrupos.length} grupos procesados desde consulta masiva`);
            return listaGrupos;
        }
        
        guardarLogLocal('⚠️ Usando método alternativo...');
        
        let gruposIdsAdicionales = [];
        if (usarEspera) {
            gruposIdsAdicionales = await obtenerGruposConEspera(sock);
        }
        
        if (!store || !store.chats) {
            return [];
        }
        
        const todosLosChats = store.chats.all() || [];
        const grupos = todosLosChats.filter(chat => chat.id && chat.id.endsWith('@g.us'));
        
        const listaGrupos = [];
        const gruposProcesados = new Set();
        
        for (const chat of grupos) {
            let nombreGrupo = 'Sin nombre';
            
            if (chat.name && chat.name !== 'Sin nombre') nombreGrupo = chat.name;
            else if (chat.subject && chat.subject !== 'Sin nombre') nombreGrupo = chat.subject;
            else if (chat.metadata && chat.metadata.subject) nombreGrupo = chat.metadata.subject;
            else if (chat.title) nombreGrupo = chat.title;
            
            if (nombreGrupo === 'Sin nombre' && groupCache.has(chat.id)) {
                const metadata = groupCache.get(chat.id);
                if (metadata && metadata.subject) nombreGrupo = metadata.subject;
            }
            
            if (nombreGrupo === 'Sin nombre' && sock) {
                const metadata = await obtenerMetadataGrupoConCache(sock, chat.id);
                if (metadata && metadata.subject) nombreGrupo = metadata.subject;
            }
            
            listaGrupos.push({
                id: chat.id,
                nombre: nombreGrupo
            });
            gruposProcesados.add(chat.id);
        }
        
        for (const id of gruposIdsAdicionales) {
            if (!gruposProcesados.has(id) && sock) {
                let nombreGrupo = 'Sin nombre';
                
                if (groupCache.has(id)) {
                    const metadata = groupCache.get(id);
                    if (metadata && metadata.subject) nombreGrupo = metadata.subject;
                }
                
                if (nombreGrupo === 'Sin nombre') {
                    const metadata = await obtenerMetadataGrupoConCache(sock, id);
                    if (metadata && metadata.subject) nombreGrupo = metadata.subject;
                }
                
                listaGrupos.push({
                    id: id,
                    nombre: nombreGrupo
                });
            }
        }
        
        return listaGrupos;
        
    } catch (error) {
        guardarLogLocal(`❌ Error obteniendo grupos: ${error.message}`);
        return [];
    }
}

async function sincronizarGruposConSheets(sock, url_sheets) {
    try {
        guardarLogLocal('🔄 Iniciando sincronización automática de grupos...');
        
        const grupos = await obtenerGruposDesdeStore(sock, false);
        
        if (grupos.length === 0) {
            guardarLogLocal('⚠️ No hay grupos para sincronizar');
            return false;
        }
        
        const respuesta = await axios.post(url_sheets, {
            grupos: grupos
        });
        
        if (respuesta.data && respuesta.data.success) {
            guardarLogLocal(`✅ Sincronización completada: ${grupos.length} grupos`);
            return true;
        } else {
            return false;
        }
        
    } catch (error) {
        guardarLogLocal(`❌ Error en sincronización: ${error.message}`);
        return false;
    }
}

async function enviarGruposASheets(sock, url_sheets, grupos) {
    try {
        const respuesta = await axios.post(url_sheets, {
            grupos: grupos
        });
        
        if (respuesta.data && respuesta.data.success) {
            return true;
        }
        return false;
    } catch (error) {
        return false;
    }
}

async function enviarCSVporWhatsApp(sock, remitente, grupos) {
    try {
        let csvContent = 'ID_GRUPO,NOMBRE_GRUPO\n';
        grupos.forEach(g => {
            const nombreEscapado = g.nombre.includes(',') ? `"${g.nombre}"` : g.nombre;
            csvContent += `${g.id},${nombreEscapado}\n`;
        });
        
        const csvPath = path.join(CONFIG.carpeta_logs, 'grupos_exportados.csv');
        fs.writeFileSync(csvPath, csvContent);
        
        await sock.sendMessage(remitente, {
            document: fs.readFileSync(csvPath),
            fileName: 'grupos_exportados.csv',
            mimetype: 'text/csv',
            caption: '📎 Archivo con la lista de grupos'
        });
        
        return true;
    } catch (error) {
        return false;
    }
}

function obtenerTextoAleatorio(arrayTextos) {
    if (!arrayTextos || arrayTextos.length === 0) return '';
    const indice = Math.floor(Math.random() * arrayTextos.length);
    return arrayTextos[indice];
}

function extraerTextoDeMensaje(mensaje) {
    if (!mensaje) return '';
    
    if (mensaje.conversation) return mensaje.conversation;
    if (mensaje.extendedTextMessage?.text) return mensaje.extendedTextMessage.text;
    if (mensaje.imageMessage?.caption) return mensaje.imageMessage.caption;
    if (mensaje.videoMessage?.caption) return mensaje.videoMessage.caption;
    if (mensaje.documentMessage?.caption) return mensaje.documentMessage.caption;
    
    return '';
}

function botEsMencionado(mensaje, botId) {
    if (!mensaje || !botId) return false;
    
    const mentionedJid = mensaje?.extendedTextMessage?.contextInfo?.mentionedJid;
    if (mentionedJid && mentionedJid.includes(botId)) return true;
    
    if (mensaje?.imageMessage?.contextInfo?.mentionedJid?.includes(botId)) return true;
    if (mensaje?.videoMessage?.contextInfo?.mentionedJid?.includes(botId)) return true;
    
    return false;
}

function esRespuestaABot(mensaje, botId) {
    try {
        const contextInfo = mensaje?.extendedTextMessage?.contextInfo || 
                           mensaje?.imageMessage?.contextInfo ||
                           mensaje?.videoMessage?.contextInfo;
        
        if (!contextInfo?.quotedMessage) return false;
        
        return contextInfo.participant === botId || contextInfo.quotedParticipant === botId;
    } catch (error) {
        return false;
    }
}

async function obtenerProductoDesdeMensajeCitado(sock, mensaje) {
    try {
        const contextInfo = mensaje.message?.extendedTextMessage?.contextInfo || 
                           mensaje.message?.imageMessage?.contextInfo ||
                           mensaje.message?.videoMessage?.contextInfo;
        
        if (!contextInfo?.quotedMessage) return null;
        
        const quotedMsg = contextInfo.quotedMessage;
        const textoOriginal = extraerTextoDeMensaje(quotedMsg);
        
        if (!textoOriginal) return null;
        
        return extraerNombreProducto(textoOriginal);
        
    } catch (error) {
        return null;
    }
}

function clasificarConsulta(texto) {
    const textoLower = texto.toLowerCase();
    
    for (const palabra of CONFIG.palabras_clave_respondibles.precio) {
        if (textoLower.includes(palabra)) {
            return 'precio';
        }
    }
    
    for (const palabra of CONFIG.palabras_clave_respondibles.info) {
        if (textoLower.includes(palabra)) {
            return 'descripcion';
        }
    }
    
    for (const palabra of CONFIG.palabras_clave_respondibles.generica) {
        if (textoLower.includes(palabra)) {
            return 'generica';
        }
    }
    
    return 'no_respondible';
}

function obtenerDatosProducto(nombreProducto) {
    if (!nombreProducto || productosCache.length === 0) return null;
    
    const producto = productosCache.find(p => 
        p.producto.toLowerCase() === nombreProducto.toLowerCase()
    );
    
    return producto;
}

function generarRespuestaAutomatica(tipoConsulta, nombreProducto, datosProducto) {
    if (!nombreProducto || !datosProducto) return null;
    
    const opcionesRespuesta = CONFIG.respuestas_consultas[tipoConsulta];
    if (!opcionesRespuesta || opcionesRespuesta.length === 0) return null;
    
    let respuesta = obtenerTextoAleatorio(opcionesRespuesta);
    
    respuesta = respuesta.replace('[PRODUCTO]', nombreProducto);
    respuesta = respuesta.replace('[DESCRIPCION]', datosProducto.descripcion || '');
    respuesta = respuesta.replace('[PRECIO]', datosProducto.precio || '');
    
    return respuesta;
}

function generarEnlaceWaMe(numeroCliente, nombreProducto, preguntaCliente) {
    const numeroLimpio = numeroCliente.split('@')[0].replace(/[^0-9]/g, '');
    const textoRespuesta = `Hola, sobre *${nombreProducto}*: ${preguntaCliente}`;
    const textoCodificado = encodeURIComponent(textoRespuesta);
    return `wa.me/${numeroLimpio}?text=${textoCodificado}`;
}

async function enviarAlertaAdmin(sock, remitenteAdmin, datosAlerta) {
    try {
        const mensajeAlerta = `━━━━━━━━━━━━━━━━━━━━━━
🔔 CONSULTA PENDIENTE

📦 PRODUCTO: *${datosAlerta.producto}*
👤 CLIENTE: ${datosAlerta.clienteNombre}
💬 PREGUNTA: "${datosAlerta.pregunta}"
📍 LUGAR: ${datosAlerta.lugar}

👉 RESPUESTA RÁPIDA:
${datosAlerta.enlace}

━━━━━━━━━━━━━━━━━━━━━━`;

        await sock.sendMessage(remitenteAdmin, { text: mensajeAlerta });
        return true;
    } catch (error) {
        return false;
    }
}

async function procesarReaccion(sock, mensaje) {
    try {
        if (!mensaje.message?.reactionMessage) return false;
        
        const reaccion = mensaje.message.reactionMessage;
        const emoji = reaccion.text;
        const keyOriginal = reaccion.key;
        const usuarioId = mensaje.key.participant || mensaje.key.remoteJid;
        
        if (!keyOriginal?.fromMe) return false;
        
        const respuestasReaccion = CONFIG.respuestas_reacciones[emoji];
        if (!respuestasReaccion) return false;
        
        let textoOriginal = '';
        try {
            const mensajeOriginal = await store.loadMessage(keyOriginal.remoteJid, keyOriginal.id);
            if (mensajeOriginal) {
                textoOriginal = extraerTextoDeMensaje(mensajeOriginal.message);
            }
        } catch (e) {}
        
        const nombreProducto = extraerNombreProducto(textoOriginal) || 'producto';
        
        let respuesta = obtenerTextoAleatorio(respuestasReaccion);
        respuesta = respuesta.replace('[PRODUCTO]', nombreProducto);
        
        const mensajeConMencion = `@${usuarioId.split('@')[0]} ${respuesta}`;
        
        const delayTyping = Math.floor(Math.random() * (CONFIG.delay_respuesta_max - CONFIG.delay_respuesta_min + 1) + CONFIG.delay_respuesta_min);
        await simularTyping(sock, keyOriginal.remoteJid, delayTyping);
        
        await sock.sendMessage(keyOriginal.remoteJid, { 
            text: mensajeConMencion,
            mentions: [usuarioId]
        });
        
        return true;
    } catch (error) {
        return false;
    }
}

let procesandoComandoPrioritario = false;

async function procesarComandoPrioritario(sock, cmd, remitente, url_sheets) {
    try {
        procesandoComandoPrioritario = true;
        guardarLogLocal(`   ⚡ PRIORITARIO: Procesando comando "${cmd}"`);
        
        if (cmd === 'actualizar' || cmd === 'update') {
            const resultado = await actualizarAgenda(sock, url_sheets, 'remoto');
            if (resultado) {
                await sock.sendMessage(remitente, { text: '✅ Agenda actualizada correctamente' });
            } else {
                await sock.sendMessage(remitente, { text: '❌ Error al actualizar agenda' });
            }
        }
        
        else if (cmd === 'listagrupos' || cmd === 'grupos') {
            await sock.sendMessage(remitente, { text: '🔄 Procesando lista de grupos...' });
            
            const grupos = await obtenerGruposDesdeStore(sock, true);
            
            if (grupos.length === 0) {
                await sock.sendMessage(remitente, { text: '❌ No se encontraron grupos.' });
                procesandoComandoPrioritario = false;
                return;
            }
            
            const sheetsResult = await enviarGruposASheets(sock, url_sheets, grupos);
            const csvResult = await enviarCSVporWhatsApp(sock, remitente, grupos);
            
            let confirmacion = '✅ *PROCESO COMPLETADO*\n\n';
            confirmacion += `📊 Total de grupos: ${grupos.length}\n`;
            confirmacion += sheetsResult ? '✅ Guardado en Google Sheets\n' : '❌ Error en Google Sheets\n';
            confirmacion += csvResult ? '✅ CSV enviado por WhatsApp\n' : '❌ Error enviando CSV\n';
            
            await sock.sendMessage(remitente, { text: confirmacion });
        }
        
        procesandoComandoPrioritario = false;
        
    } catch (error) {
        guardarLogLocal(`   ❌ Error en comando prioritario: ${error.message}`);
        procesandoComandoPrioritario = false;
    }
}

async function iniciarWhatsApp() {
    console.log('====================================');
    console.log('🤖 BOT WHATSAPP - VERSIÓN 46.1');
    console.log('📁 Ruta multimedia: /storage/emulated/0/');
    console.log('====================================\n');

    const url_sheets = leerURL();
    if (!url_sheets) {
        console.log('❌ No hay URL');
        return;
    }

    try {
        await actualizarCacheProductos(url_sheets);
        
        const { version } = await fetchLatestBaileysVersion();
        console.log(`📦 Baileys versión: ${version.join('.')}`);
        
        const logger = pino({ level: 'silent' });
        const { state, saveCreds } = await useMultiFileAuthState(CONFIG.carpeta_sesion);

        const existeSesion = fs.existsSync(path.join(CONFIG.carpeta_sesion, 'creds.json'));
        
        let browserConfig;
        if (!existeSesion) {
            browserConfig = ["Ubuntu", "Chrome", "20.0.04"];
            console.log('🌐 Browser: Ubuntu/Chrome (primera vez)');
        } else {
            browserConfig = Browsers.macOS("Desktop");
            console.log('🌐 Browser: macOS/Desktop');
        }

        const sock = makeWASocket({
            version,
            auth: state,
            logger: logger,
            printQRInTerminal: false,
            browser: browserConfig,
            syncFullHistory: false,
            markOnlineOnConnect: true,
            defaultQueryTimeoutMs: 60000,
            shouldSyncHistoryMessage: () => false,
            generateHighQualityLinkPreview: true,
            cachedGroupMetadata: async (jid) => groupCache.get(jid),
            keepAliveIntervalMs: 25000
        });

        store.bind(sock.ev);

        sock.ev.on('groups.update', async (updates) => {
            for (const update of updates) {
                try {
                    const metadata = await sock.groupMetadata(update.id);
                    groupCache.set(update.id, metadata);
                } catch (e) {}
            }
        });

        sock.ev.on('group-participants.update', async (update) => {
            try {
                const metadata = await sock.groupMetadata(update.id);
                groupCache.set(update.id, metadata);
            } catch (e) {}
        });

        if (!sock.authState.creds.registered) {
            console.log('📱 PRIMERA CONFIGURACIÓN\n');
            const numero = await pedirNumeroSilencioso();
            console.log(`\n🔄 Solicitando código...`);
            
            setTimeout(async () => {
                try {
                    const codigo = await sock.requestPairingCode(numero);
                    console.log('\n====================================');
                    console.log('🔐 CÓDIGO:', codigo);
                    console.log('====================================');
                    console.log('1. Abre WhatsApp');
                    console.log('2. 3 puntos → Dispositivos vinculados');
                    console.log('3. Vincular con número');
                    console.log('4. Ingresa el código\n');
                } catch (error) {
                    console.log('❌ Error al generar código');
                }
            }, 2000);
        }

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === 'open') {
                console.log('\n✅ CONECTADO A WHATSAPP\n');
                guardarLogLocal('CONEXIÓN EXITOSA');
                
                limpiarStoreAntiguo();
                
                const agenda = cargarAgendaLocal();
                if (agenda.grupos.length === 0) {
                    guardarLogLocal('📥 Primera ejecución - descargando agenda...');
                    await actualizarAgenda(sock, url_sheets, 'primera vez');
                }
                
                await actualizarCacheProductos(url_sheets);
                
                guardarLogLocal('🔄 Ejecutando sincronización inicial de grupos...');
                await sincronizarGruposConSheets(sock, url_sheets);
                
                reprogramarTodosLosEnvios(sock);
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error instanceof Boom ? lastDisconnect.error.output.statusCode : 500;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                
                if (shouldReconnect) {
                    guardarLogLocal('🔄 Reconectando...');
                    setTimeout(() => iniciarWhatsApp(), 5000);
                } else {
                    guardarLogLocal('🚫 Sesión cerrada. Borra carpeta sesion_whatsapp');
                }
            }
        });

        sock.ev.on('creds.update', saveCreds);

        cron.schedule('0 3 * * *', async () => {
            guardarLogLocal('⏰ Ejecutando limpieza programada (3 AM)');
            limpiarStoreAntiguo();
        });

        cron.schedule('0 6 * * *', async () => {
            if (procesandoComandoPrioritario) {
                guardarLogLocal('⏰ Actualización de 6am pospuesta');
                return;
            }
            guardarLogLocal('⏰ ACTUALIZACIÓN AUTOMÁTICA (6:00 AM)');
            await actualizarAgenda(sock, url_sheets, 'automático 6am');
        });

        sock.ev.on('messages.upsert', async (m) => {
            const mensaje = m.messages[0];
            
            if (!mensaje.key || mensaje.key.fromMe || !mensaje.message) return;

            const remitente = mensaje.key.remoteJid;
            
            if (remitente === 'status@broadcast') {
                return;
            }
            
            const esGrupo = remitente.includes('@g.us');
            const mensajeId = mensaje.key.id;

            if (mensajesEnProcesamiento.has(mensajeId)) return;
            mensajesEnProcesamiento.add(mensajeId);
            setTimeout(() => mensajesEnProcesamiento.delete(mensajeId), 10000);

            if (mensaje.message?.reactionMessage) {
                setImmediate(() => procesarReaccion(sock, mensaje));
                return;
            }

            if (esGrupo) {
                const esMencion = botEsMencionado(mensaje.message, sock.user.id);
                const esRespuesta = esRespuestaABot(mensaje, sock.user.id);
                
                if (!esMencion && !esRespuesta) {
                    mensajesEnProcesamiento.delete(mensajeId);
                    return;
                }
            }

            const texto = extraerTextoDeMensaje(mensaje.message);
            if (!texto || texto.trim() === '') {
                mensajesEnProcesamiento.delete(mensajeId);
                return;
            }

            console.log(`📩 MENSAJE RECIBIDO de ${remitente.split('@')[0]}: "${texto.substring(0, 50)}"`);
            guardarLogLocal(`📩 Mensaje de ${remitente.split('@')[0]}: "${texto.substring(0, 100)}"`);

            if (!esGrupo) {
                const cmd = texto.toLowerCase().trim();
                
                if (cmd === 'actualizar' || cmd === 'update' || cmd === 'listagrupos' || cmd === 'grupos') {
                    setImmediate(() => {
                        procesarComandoPrioritario(sock, cmd, remitente, url_sheets);
                    });
                    mensajesEnProcesamiento.delete(mensajeId);
                    return;
                }
                
                else if (cmd === 'status' || cmd === 'estado') {
                    setImmediate(async () => {
                        const agenda = cargarAgendaLocal();
                        const total = agenda.grupos?.length || 0;
                        const pestanas = Object.keys(agenda.pestanas || {}).length;
                        const activos = agenda.grupos?.filter(g => g.activo === 'SI').length || 0;
                        
                        const horarios = new Set();
                        if (agenda.pestanas) {
                            Object.values(agenda.pestanas).forEach(p => {
                                if (p.horario) horarios.add(p.horario);
                            });
                        }
                        
                        let mensajeStatus = `📊 *ESTADO DEL BOT*\n\n` +
                                          `⏰ MODO: setTimeout + Delay inteligente\n` +
                                          `📅 Última actualización: ${agenda.ultima_actualizacion || 'N/A'}\n` +
                                          `📋 Grupos totales: ${total}\n` +
                                          `✅ Grupos activos: ${activos}\n` +
                                          `📌 Pestañas: ${pestanas}\n` +
                                          `⏱️ Horarios programados: ${Array.from(horarios).join(', ') || 'Ninguno'}\n` +
                                          `📁 Ruta multimedia: /storage/emulated/0/\n` +
                                          `🚫 Filtro de estados: ACTIVADO\n` +
                                          `💬 Interacciones: VERSIÓN 46.1`;
                        
                        await sock.sendMessage(remitente, { text: mensajeStatus });
                        mensajesEnProcesamiento.delete(mensajeId);
                    });
                    return;
                }
            }

            setImmediate(async () => {
                try {
                    const nombreProducto = await obtenerProductoDesdeMensajeCitado(sock, mensaje);
                    if (!nombreProducto) {
                        mensajesEnProcesamiento.delete(mensajeId);
                        return;
                    }

                    const datosProducto = obtenerDatosProducto(nombreProducto);
                    if (!datosProducto) {
                        mensajesEnProcesamiento.delete(mensajeId);
                        return;
                    }

                    const tipoConsulta = clasificarConsulta(texto);
                    const usuarioId = mensaje.key.participant || remitente;

                    if (tipoConsulta !== 'no_respondible') {
                        const respuesta = generarRespuestaAutomatica(tipoConsulta, nombreProducto, datosProducto);
                        if (respuesta) {
                            const mensajeConMencion = `@${usuarioId.split('@')[0]} ${respuesta}`;
                            const delayTyping = Math.floor(Math.random() * (CONFIG.delay_respuesta_max - CONFIG.delay_respuesta_min + 1) + CONFIG.delay_respuesta_min);
                            await simularTyping(sock, remitente, delayTyping);
                            await sock.sendMessage(remitente, { 
                                text: mensajeConMencion,
                                mentions: [usuarioId]
                            });
                        }
                    } else {
                        const enlace = generarEnlaceWaMe(remitente, nombreProducto, texto);
                        const datosAlerta = {
                            producto: nombreProducto,
                            clienteNombre: remitente.split('@')[0],
                            clienteNumero: remitente.split('@')[0],
                            pregunta: texto,
                            lugar: esGrupo ? 'Grupo' : 'Chat privado',
                            tiempo: 'ahora mismo',
                            enlace: enlace
                        };
                        await enviarAlertaAdmin(sock, sock.user.id, datosAlerta);
                    }
                } catch (error) {
                    guardarLogLocal(`   ❌ Error procesando interacción: ${error.message}`);
                } finally {
                    mensajesEnProcesamiento.delete(mensajeId);
                }
            });
        });

        console.log('\n📝 Comandos disponibles:');
        console.log('   - "actualizar" - ⚡ PRIORITARIO');
        console.log('   - "listagrupos" - ⚡ PRIORITARIO');
        console.log('   - "status" - Ver estado del bot');
        console.log('   - Presiona CTRL+C para salir\n');
        console.log('📁 Los archivos multimedia se buscan en: /storage/emulated/0/');
        console.log('   Ejemplo: si el producto es "gorra", busca TODOS los archivos');
        console.log('   que contengan "gorra" en el nombre (gorra.jpg, gorra.mp4, etc.)\n');

    } catch (error) {
        guardarLogLocal(`❌ ERROR FATAL: ${error.message}`);
        setTimeout(() => iniciarWhatsApp(), 30000);
    }
}

process.on('SIGINT', () => {
    console.log('\n\n👋 Cerrando bot...');
    guardarLogLocal('BOT CERRADO MANUALMENTE');
    cancelarTodosLosTimers();
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
