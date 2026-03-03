// ============================================
// BOT DE WHATSAPP PARA TERMUX
// Versión: 27.2 - LECTURA DE PARÁMETROS PARA HISTORIAS
// Características:
// - Conexión con código de emparejamiento
// - Browser inteligente: Ubuntu para pairing, macOS para sesión
// - Typing adaptativo (80% del delay)
// - Link Previews: título/descripción con Baileys, imagen con caché local
// - Data Store integrado para almacenar información de grupos localmente
// - Extracción de grupos desde Data Store con búsqueda de nombre en múltiples campos
// - Sincronización automática con Google Sheets al iniciar y cada 12h
// - Limpieza automática del Data Store (mensajes > 30 días)
// - Soporte multimedia: imágenes, audios, videos, documentos
// - Múltiples pestañas GRUPOS*
// - Cada pestaña tiene su propio horario rector
// - Delays aleatorios con formato "min-max" desde CONFIG
// - Descarga completa de agenda
// - Comandos "actualizar", "status" y "listagrupos" desde WhatsApp
// - Cache de grupos para mejor rendimiento
// - Logs solo locales
// - NUEVO: Lectura de parámetros para Historias (HORARIO_HISTORIAS, DIAS_HISTORIAS, INTERVALO_HISTORIAS)
// ============================================

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, getUrlInfo, Browsers } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cron = require('node-cron');
const readline = require('readline');
const pino = require('pino');
const { getLinkPreview } = require('link-preview-js');
const crypto = require('crypto');
// ============================================
// LIBRERÍA PARA DATA STORE
// ============================================
const { makeInMemoryStore } = require('@rodrigogs/baileys-store');

// ============================================
// CONFIGURACIÓN
// ============================================
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
    horarios_actualizacion: ['06:00', '18:00'],
    dias_retencion_store: 30,
    carpeta_multimedia: '/storage/emulated/0/WhatsAppBot',
    tiempo_espera_grupos: 30000,
    // ============================================
    // NUEVOS PARÁMETROS PARA HISTORIAS (valores por defecto)
    // ============================================
    horario_historias: '22:00-05:00',
    dias_historias: 'L,M,MI,J,V,S,D',
    intervalo_historias_min: 5,
    intervalo_historias_max: 10
};

// Crear carpetas necesarias
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

// ============================================
// INICIALIZAR DATA STORE
// ============================================
console.log('📚 Inicializando Data Store...');
const store = makeInMemoryStore({
    logger: pino({ level: 'silent' }).child({ stream: 'store' })
});

// Si ya existe un archivo del store, lo cargamos
if (fs.existsSync(CONFIG.archivo_store)) {
    store.readFromFile(CONFIG.archivo_store);
    console.log('📚 Data Store cargado desde archivo.');
}

// Guardar el store cada 10 segundos
setInterval(() => {
    store.writeToFile(CONFIG.archivo_store);
}, 10_000);

// ============================================
// CACHE DE GRUPOS
// ============================================
const groupCache = new Map();

// Variable para llevar registro de imágenes usadas en el lote actual
let imagenesUsadasEnLote = new Set();

// ============================================
// FUNCIÓN PARA OBTENER METADATOS DE GRUPO CON CACHÉ
// ============================================
async function obtenerMetadataGrupoConCache(sock, groupId) {
    try {
        if (groupCache.has(groupId)) {
            const cached = groupCache.get(groupId);
            guardarLogLocal(`   📦 Usando nombre desde caché: ${cached.subject || 'Sin nombre'}`);
            return cached;
        }
        
        guardarLogLocal(`   🌐 Consultando a WhatsApp (puede tomar unos segundos): ${groupId}`);
        const metadata = await sock.groupMetadata(groupId);
        
        if (metadata) {
            groupCache.set(groupId, metadata);
            guardarLogLocal(`   ✅ Guardado en caché: ${metadata.subject || 'Sin nombre'}`);
        }
        
        return metadata;
    } catch (error) {
        guardarLogLocal(`   ❌ Error consultando grupo: ${error.message}`);
        
        if (error.message.includes('rate-overlimit')) {
            guardarLogLocal(`   ⚠️ Rate limit detectado. Se reintentará automáticamente en la próxima sincronización.`);
        }
        return null;
    }
}

// ============================================
// FUNCIÓN PARA BUSCAR ARCHIVO MULTIMEDIA
// ============================================
function buscarArchivoMultimedia(nombreArchivo) {
    try {
        if (!nombreArchivo || nombreArchivo.trim() === '') {
            return null;
        }

        const nombreLimpio = nombreArchivo.trim();
        guardarLogLocal(`   🔍 Buscando archivo: "${nombreLimpio}"`);

        function buscarRecursivo(directorio) {
            try {
                const archivos = fs.readdirSync(directorio);
                
                for (const archivo of archivos) {
                    const rutaCompleta = path.join(directorio, archivo);
                    const estadistica = fs.statSync(rutaCompleta);
                    
                    if (estadistica.isDirectory()) {
                        const encontrado = buscarRecursivo(rutaCompleta);
                        if (encontrado) return encontrado;
                    } else {
                        const nombreSinExtension = path.parse(archivo).name;
                        if (nombreSinExtension.toLowerCase() === nombreLimpio.toLowerCase()) {
                            guardarLogLocal(`   ✅ Archivo encontrado: ${rutaCompleta}`);
                            return {
                                ruta: rutaCompleta,
                                nombre: archivo,
                                extension: path.extname(archivo).toLowerCase()
                            };
                        }
                    }
                }
            } catch (error) {}
            return null;
        }

        return buscarRecursivo(CONFIG.carpeta_multimedia);
        
    } catch (error) {
        guardarLogLocal(`   ⚠️ Error buscando archivo: ${error.message}`);
        return null;
    }
}

// ============================================
// FUNCIÓN PARA ENVIAR ARCHIVO MULTIMEDIA
// ============================================
async function enviarArchivoMultimedia(sock, id_grupo, archivoInfo, textoLimpio) {
    try {
        const extension = archivoInfo.extension;
        const buffer = fs.readFileSync(archivoInfo.ruta);
        
        if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(extension)) {
            guardarLogLocal(`   🖼️ Enviando imagen: ${archivoInfo.nombre}`);
            await sock.sendMessage(id_grupo, {
                image: buffer,
                caption: textoLimpio || ''
            });
            return 'IMAGEN ENVIADA';
        }
        else if (['.mp4', '.avi', '.mov', '.mkv'].includes(extension)) {
            guardarLogLocal(`   🎬 Enviando video: ${archivoInfo.nombre}`);
            await sock.sendMessage(id_grupo, {
                video: buffer,
                caption: textoLimpio || ''
            });
            return 'VIDEO ENVIADO';
        }
        else if (['.mp3', '.ogg', '.m4a', '.wav', '.aac'].includes(extension)) {
            guardarLogLocal(`   🎵 Enviando audio: ${archivoInfo.nombre}`);
            let mimetype = 'audio/mpeg';
            if (extension === '.ogg') mimetype = 'audio/ogg';
            if (extension === '.m4a') mimetype = 'audio/mp4';
            if (extension === '.wav') mimetype = 'audio/wav';
            
            await sock.sendMessage(id_grupo, {
                audio: buffer,
                mimetype: mimetype
            });
            
            if (textoLimpio && textoLimpio.trim() !== '') {
                guardarLogLocal(`   📝 Enviando texto aparte para el audio`);
                await new Promise(resolve => setTimeout(resolve, 1000));
                await sock.sendMessage(id_grupo, { text: textoLimpio });
            }
            return 'AUDIO ENVIADO' + (textoLimpio ? ' + TEXTO' : '');
        }
        else {
            guardarLogLocal(`   📄 Enviando documento: ${archivoInfo.nombre}`);
            await sock.sendMessage(id_grupo, {
                document: buffer,
                fileName: archivoInfo.nombre,
                mimetype: 'application/octet-stream',
                caption: textoLimpio || ''
            });
            return 'DOCUMENTO ENVIADO';
        }
        
    } catch (error) {
        guardarLogLocal(`   ❌ Error enviando archivo: ${error.message}`);
        return 'ERROR: ' + error.message.substring(0, 50);
    }
}

// ============================================
// FUNCIÓN PARA LIMPIAR STORE ANTIGUO
// ============================================
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
        
        guardarLogLocal(`   Conservando mensajes posteriores a: ${fechaLimite.toLocaleDateString()}`);
        
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

// ============================================
// LEER URL DE GOOGLE SHEETS
// ============================================
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

// ============================================
// PEDIR NÚMERO DE TELÉFONO
// ============================================
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

// ============================================
// CONSULTAR TODOS LOS GRUPOS A GOOGLE SHEETS (AQUÍ ESTÁ EL CAMBIO)
// ============================================
async function consultarTodosLosGrupos(url) {
    try {
        console.log('🔄 Descargando TODOS los grupos desde Google Sheets...');
        const respuesta = await axios.get(url);
        const data = respuesta.data;
        
        if (data.config) {
            // --- Parámetros existentes ---
            const delayStr = data.config.TIEMPO_ENTRE_MENSAJES;
            if (delayStr && typeof delayStr === 'string' && delayStr.includes('-')) {
                const partes = delayStr.split('-').map(p => parseInt(p.trim()));
                if (partes.length === 2 && !isNaN(partes[0]) && !isNaN(partes[1])) {
                    CONFIG.tiempo_entre_mensajes_min = partes[0];
                    CONFIG.tiempo_entre_mensajes_max = partes[1];
                    console.log(`⏱️  Delay mensajes configurado: ${CONFIG.tiempo_entre_mensajes_min}-${CONFIG.tiempo_entre_mensajes_max} segundos`);
                }
            }
            
            // ============================================
            // NUEVO: Leer parámetros para Historias
            // ============================================
            const horarioHistorias = data.config.HORARIO_HISTORIAS;
            if (horarioHistorias) {
                CONFIG.horario_historias = horarioHistorias;
                console.log(`📅 Horario historias configurado: ${CONFIG.horario_historias}`);
            }
            
            const diasHistorias = data.config.DIAS_HISTORIAS;
            if (diasHistorias) {
                CONFIG.dias_historias = diasHistorias;
                console.log(`📆 Días historias configurados: ${CONFIG.dias_historias}`);
            }
            
            const intervaloStr = data.config.INTERVALO_HISTORIAS;
            if (intervaloStr && typeof intervaloStr === 'string' && intervaloStr.includes('-')) {
                const partes = intervaloStr.split('-').map(p => parseInt(p.trim()));
                if (partes.length === 2 && !isNaN(partes[0]) && !isNaN(partes[1])) {
                    CONFIG.intervalo_historias_min = partes[0];
                    CONFIG.intervalo_historias_max = partes[1];
                    console.log(`⏱️  Intervalo historias configurado: ${CONFIG.intervalo_historias_min}-${CONFIG.intervalo_historias_max} minutos`);
                }
            }
        }
        
        return data;
    } catch (error) {
        console.error('❌ Error al consultar Google Sheets:', error.message);
        return null;
    }
}

// ============================================
// GUARDAR AGENDA LOCAL
// ============================================
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
        Object.keys(agenda.pestanas).forEach(pestana => {
            const p = agenda.pestanas[pestana];
            console.log(`   📌 ${pestana}: ${p.grupos.length} grupos - Horario: ${p.horario || 'N/A'}`);
        });
        
        return true;
    } catch (error) {
        console.error('❌ Error guardando agenda:', error.message);
        return false;
    }
}

// ============================================
// CARGAR AGENDA LOCAL
// ============================================
function cargarAgendaLocal() {
    try {
        if (!fs.existsSync(CONFIG.archivo_agenda)) {
            console.log('📁 No hay agenda local (primera vez)');
            return { grupos: [], pestanas: {}, total: 0 };
        }
        const agenda = JSON.parse(fs.readFileSync(CONFIG.archivo_agenda, 'utf8'));
        
        if (agenda.config) {
            CONFIG.tiempo_entre_mensajes_min = agenda.config.min || 1;
            CONFIG.tiempo_entre_mensajes_max = agenda.config.max || 5;
        }
        
        console.log(`📋 Agenda cargada (${agenda.grupos?.length || 0} grupos)`);
        return agenda;
    } catch (error) {
        console.error('❌ Error cargando agenda:', error.message);
        return { grupos: [], pestanas: {}, total: 0 };
    }
}

// ============================================
// ACTUALIZAR AGENDA
// ============================================
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
            const total = data.grupos?.length || 0;
            const pestanas = data.pestanas?.length || 0;
            guardarLogLocal(`✅ Agenda actualizada: ${total} grupos en ${pestanas} pestañas`);
            return true;
        }
        return false;
    } catch (error) {
        guardarLogLocal(`❌ Error actualizando agenda: ${error.message}`);
        return false;
    }
}

// ============================================
// GUARDAR LOG LOCAL
// ============================================
function guardarLogLocal(texto) {
    const fecha = new Date().toISOString().split('T')[0];
    const logFile = path.join(CONFIG.carpeta_logs, `${fecha}.log`);
    const hora = new Date().toLocaleTimeString();
    fs.appendFileSync(logFile, `[${hora}] ${texto}\n`);
    console.log(`📝 ${texto}`);
}

// ============================================
// FUNCIÓN PARA SIMULAR QUE ESTÁ ESCRIBIENDO
// ============================================
async function simularTyping(sock, id_destino, duracion) {
    try {
        await sock.sendPresenceUpdate('composing', id_destino);
        guardarLogLocal(`   ✍️ Typing por ${duracion} segundos...`);
        
        await new Promise(resolve => setTimeout(resolve, duracion * 1000));
        
        await sock.sendPresenceUpdate('paused', id_destino);
        await new Promise(resolve => setTimeout(resolve, 500));
        
    } catch (error) {
        guardarLogLocal(`   ⚠️ Error en typing: ${error.message}`);
    }
}

// ============================================
// FUNCIÓN PARA GENERAR HASH DE URL
// ============================================
function generarHashURL(url) {
    return crypto.createHash('md5').update(url).digest('hex');
}

// ============================================
// FUNCIÓN PARA OBTENER SOLO LA URL DE LA IMAGEN DEL PREVIEW
// ============================================
async function obtenerUrlImagenPreview(url) {
    try {
        guardarLogLocal(`   🔍 Buscando imagen para: ${url}`);
        
        const previewData = await getLinkPreview(url, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            followRedirects: 'follow'
        });
        
        if (previewData.images && previewData.images.length > 0) {
            const imagenUrl = previewData.images[0];
            guardarLogLocal(`   🖼️ URL de imagen encontrada: ${imagenUrl.substring(0, 50)}...`);
            return imagenUrl;
        }
        
        guardarLogLocal('   ⚠️ No se encontraron imágenes');
        return null;
        
    } catch (error) {
        guardarLogLocal(`   ⚠️ Error obteniendo URL de imagen: ${error.message}`);
        return null;
    }
}

// ============================================
// FUNCIÓN PARA OBTENER IMAGEN CON CACHÉ LOCAL
// ============================================
async function obtenerImagenConCache(url) {
    try {
        const hash = generarHashURL(url);
        const rutaImagen = path.join(CONFIG.carpeta_cache, `${hash}.jpg`);
        
        if (fs.existsSync(rutaImagen)) {
            guardarLogLocal(`   🖼️ Imagen encontrada en caché local`);
            return fs.readFileSync(rutaImagen);
        }
        
        guardarLogLocal(`   ⬇️ Descargando imagen a caché local...`);
        
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'arraybuffer',
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const buffer = Buffer.from(response.data);
        fs.writeFileSync(rutaImagen, buffer);
        imagenesUsadasEnLote.add(rutaImagen);
        
        guardarLogLocal(`   ✅ Imagen guardada en caché: ${hash}.jpg`);
        return buffer;
        
    } catch (error) {
        guardarLogLocal(`   ⚠️ Error con imagen: ${error.message}`);
        return null;
    }
}

// ============================================
// FUNCIÓN PARA LIMPIAR CACHÉ DE IMÁGENES
// ============================================
function limpiarCacheImagenes() {
    try {
        const cantidad = imagenesUsadasEnLote.size;
        if (cantidad === 0) return;
        
        guardarLogLocal(`🧹 Limpiando caché de imágenes (${cantidad} archivos)...`);
        
        for (const ruta of imagenesUsadasEnLote) {
            try {
                if (fs.existsSync(ruta)) {
                    fs.unlinkSync(ruta);
                }
            } catch (e) {}
        }
        
        imagenesUsadasEnLote.clear();
        guardarLogLocal('✅ Caché limpiado correctamente');
        
    } catch (error) {
        guardarLogLocal(`⚠️ Error limpiando caché: ${error.message}`);
    }
}

// ============================================
// FUNCIÓN PARA ENVIAR MENSAJE A GRUPO (con soporte multimedia)
// ============================================
async function enviarMensaje(sock, id_grupo, mensajeOriginal) {
    try {
        if (!id_grupo || !id_grupo.includes('@g.us')) {
            return 'ERROR: ID inválido';
        }
        
        const regexArchivo = /\(([^)]+)\)/;
        const match = mensajeOriginal.match(regexArchivo);
        
        if (match) {
            const nombreArchivo = match[1];
            const textoLimpio = mensajeOriginal.replace(regexArchivo, '').trim();
            
            const archivoInfo = buscarArchivoMultimedia(nombreArchivo);
            
            if (archivoInfo) {
                const resultado = await enviarArchivoMultimedia(sock, id_grupo, archivoInfo, textoLimpio);
                return resultado;
            } else {
                guardarLogLocal(`   ⚠️ Archivo no encontrado: "${nombreArchivo}"`);
                await sock.sendMessage(id_grupo, { text: mensajeOriginal });
                return 'TEXTO ENVIADO (archivo no encontrado)';
            }
        }
        
        const urls = mensajeOriginal.match(/(?:https?:\/\/|wa\.me\/|youtu\.be\/)[^\s]+/g) || [];
        const opciones = { text: mensajeOriginal };
        
        if (urls.length > 0) {
            guardarLogLocal(`   🔗 Generando preview para: ${urls[0]}`);
            
            const linkPreview = await getUrlInfo(urls[0], {
                thumbnailWidth: 2400,
                fetchOpts: {
                    timeout: 15000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    }
                },
                followRedirects: true
            });
            
            if (linkPreview) {
                opciones.linkPreview = linkPreview;
                guardarLogLocal(`   ✅ Preview generado: ${linkPreview.title || 'Sin título'}`);
                await new Promise(resolve => setTimeout(resolve, 1500));
            }
        }
        
        await sock.sendMessage(id_grupo, opciones);
        return 'TEXTO ENVIADO';
        
    } catch (error) {
        return 'ERROR: ' + error.message.substring(0, 50);
    }
}

// ============================================
// OBTENER DELAY ALEATORIO
// ============================================
function obtenerDelayAleatorio() {
    const min = CONFIG.tiempo_entre_mensajes_min || 1;
    const max = CONFIG.tiempo_entre_mensajes_max || 5;
    const delay = Math.floor(Math.random() * (max - min + 1) + min);
    return delay;
}

// ============================================
// VERIFICAR MENSAJES PENDIENTES POR PESTAÑA
// ============================================
async function verificarMensajesLocales(sock) {
    try {
        const agenda = cargarAgendaLocal();
        
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

        imagenesUsadasEnLote.clear();

        for (const pestana of pestanasAHora) {
            guardarLogLocal(`📊 Pestaña "${pestana.nombre}" - Enviando ${pestana.grupos.length} mensajes (horario: ${pestana.horario})`);

            for (const grupo of pestana.grupos) {
                const diasPermitidos = grupo.dias ? grupo.dias.split(',').map(d => d.trim()) : [];
                if (diasPermitidos.length > 0 && !diasPermitidos.includes(diaSemana)) {
                    guardarLogLocal(`   ⏭️  ${grupo.nombre || grupo.id} - no corresponde hoy (días: ${grupo.dias})`);
                    continue;
                }

                guardarLogLocal(`   📤 Enviando a: ${grupo.nombre || grupo.id}`);
                
                const delaySegundos = obtenerDelayAleatorio();
                
                await simularTyping(sock, grupo.id, delaySegundos * 0.8);
                
                const estado = await enviarMensaje(sock, grupo.id, grupo.mensaje);
                
                const restante = delaySegundos * 0.2 * 1000;
                await new Promise(resolve => setTimeout(resolve, restante));
                
                guardarLogLocal(`      Resultado: ${estado}`);
            }
            
            guardarLogLocal(`✅ Pestaña "${pestana.nombre}" completada`);
        }

        limpiarCacheImagenes();

    } catch (error) {
        guardarLogLocal(`❌ ERROR: ${error.message}`);
        limpiarCacheImagenes();
    }
}

// ============================================
// FUNCIÓN PARA OBTENER GRUPOS CON ESPERA (eventos)
// ============================================
async function obtenerGruposConEspera(sock) {
    return new Promise((resolve) => {
        try {
            guardarLogLocal('⏳ Iniciando espera de 30 segundos para capturar TODOS los grupos...');
            
            const gruposIds = new Set();
            let timeoutCompletado = false;
            
            const manejarGroupsUpdate = (updates) => {
                if (timeoutCompletado) return;
                
                updates.forEach(update => {
                    if (update.id && update.id.endsWith('@g.us')) {
                        if (!gruposIds.has(update.id)) {
                            gruposIds.add(update.id);
                            guardarLogLocal(`   ➕ Grupo detectado por evento: ${update.id}`);
                        }
                    }
                });
            };
            
            sock.ev.on('groups.update', manejarGroupsUpdate);
            
            setTimeout(() => {
                timeoutCompletado = true;
                sock.ev.off('groups.update', manejarGroupsUpdate);
                
                guardarLogLocal(`✅ Espera completada. Se detectaron ${gruposIds.size} grupos por eventos.`);
                resolve(Array.from(gruposIds));
            }, CONFIG.tiempo_espera_grupos);
            
        } catch (error) {
            guardarLogLocal(`❌ Error en espera de grupos: ${error.message}`);
            resolve([]);
        }
    });
}

// ============================================
// FUNCIÓN PRINCIPAL: Obtener grupos desde Data Store (CON CACHÉ)
// ============================================
async function obtenerGruposDesdeStore(sock, usarEspera = false) {
    try {
        guardarLogLocal('🔍 Obteniendo grupos desde Data Store...');
        
        let gruposIdsAdicionales = [];
        if (usarEspera) {
            gruposIdsAdicionales = await obtenerGruposConEspera(sock);
        }
        
        if (!store || !store.chats) {
            guardarLogLocal('❌ Data Store no disponible');
            return [];
        }
        
        const todosLosChats = store.chats.all() || [];
        guardarLogLocal(`   Total de chats en store: ${todosLosChats.length}`);
        
        const grupos = todosLosChats.filter(chat => chat.id && chat.id.endsWith('@g.us'));
        
        guardarLogLocal(`   Chats del store filtrados como grupos: ${grupos.length}`);
        
        if (gruposIdsAdicionales.length > 0) {
            guardarLogLocal(`   Grupos adicionales por eventos: ${gruposIdsAdicionales.length}`);
        }
        
        const listaGrupos = [];
        const gruposProcesados = new Set();
        
        for (const chat of grupos) {
            let nombreGrupo = 'Sin nombre';
            let metadata = null;
            
            if (chat.name && chat.name !== 'Sin nombre' && chat.name.trim() !== '') {
                nombreGrupo = chat.name;
            }
            else if (chat.subject && chat.subject !== 'Sin nombre' && chat.subject.trim() !== '') {
                nombreGrupo = chat.subject;
            }
            else if (chat.metadata && chat.metadata.subject) {
                nombreGrupo = chat.metadata.subject;
            }
            else if (chat.metadata && chat.metadata.name) {
                nombreGrupo = chat.metadata.name;
            }
            else if (chat.title) {
                nombreGrupo = chat.title;
            }
            
            if (nombreGrupo === 'Sin nombre') {
                if (groupCache.has(chat.id)) {
                    metadata = groupCache.get(chat.id);
                    if (metadata && metadata.subject) {
                        nombreGrupo = metadata.subject;
                        guardarLogLocal(`   📦 Nombre obtenido del CACHÉ: ${nombreGrupo}`);
                    }
                }
            }
            
            if (nombreGrupo === 'Sin nombre' && sock) {
                guardarLogLocal(`   ⚠️ Grupo sin nombre, consultando a WhatsApp con CACHÉ: ${chat.id}`);
                metadata = await obtenerMetadataGrupoConCache(sock, chat.id);
                if (metadata && metadata.subject) {
                    nombreGrupo = metadata.subject;
                }
            }
            
            listaGrupos.push({
                id: chat.id,
                nombre: nombreGrupo
            });
            gruposProcesados.add(chat.id);
        }
        
        for (const id of gruposIdsAdicionales) {
            if (!gruposProcesados.has(id) && sock) {
                guardarLogLocal(`   🔄 Procesando grupo adicional de evento: ${id}`);
                
                let nombreGrupo = 'Sin nombre';
                
                if (groupCache.has(id)) {
                    const metadata = groupCache.get(id);
                    if (metadata && metadata.subject) {
                        nombreGrupo = metadata.subject;
                        guardarLogLocal(`   📦 Nombre obtenido del CACHÉ (evento): ${nombreGrupo}`);
                    }
                }
                
                if (nombreGrupo === 'Sin nombre') {
                    const metadata = await obtenerMetadataGrupoConCache(sock, id);
                    if (metadata && metadata.subject) {
                        nombreGrupo = metadata.subject;
                    }
                }
                
                listaGrupos.push({
                    id: id,
                    nombre: nombreGrupo
                });
            }
        }
        
        guardarLogLocal(`✅ Total de grupos procesados: ${listaGrupos.length}`);
        return listaGrupos;
        
    } catch (error) {
        guardarLogLocal(`❌ Error obteniendo grupos: ${error.message}`);
        return [];
    }
}

// ============================================
// FUNCIÓN PARA SINCRONIZAR GRUPOS CON GOOGLE SHEETS
// ============================================
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
            guardarLogLocal(`✅ Sincronización automática completada: ${grupos.length} grupos`);
            return true;
        } else {
            guardarLogLocal(`⚠️ Error en sincronización: ${JSON.stringify(respuesta.data)}`);
            return false;
        }
        
    } catch (error) {
        guardarLogLocal(`❌ Error en sincronización automática: ${error.message}`);
        return false;
    }
}

// ============================================
// FUNCIÓN PARA ENVIAR GRUPOS A GOOGLE SHEETS
// ============================================
async function enviarGruposASheets(sock, url_sheets, grupos) {
    try {
        guardarLogLocal('📤 Enviando grupos a Google Sheets...');
        
        const respuesta = await axios.post(url_sheets, {
            grupos: grupos
        });
        
        if (respuesta.data && respuesta.data.success) {
            guardarLogLocal(`✅ ${respuesta.data.mensaje}`);
            return true;
        } else {
            guardarLogLocal(`⚠️ Respuesta de Sheets: ${JSON.stringify(respuesta.data)}`);
            return false;
        }
    } catch (error) {
        guardarLogLocal(`❌ Error enviando a Sheets: ${error.message}`);
        return false;
    }
}

// ============================================
// FUNCIÓN PARA GENERAR Y ENVIAR CSV
// ============================================
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
        
        guardarLogLocal('✅ CSV enviado por WhatsApp');
        return true;
    } catch (error) {
        guardarLogLocal(`❌ Error enviando CSV: ${error.message}`);
        return false;
    }
}

// ============================================
// INICIAR CONEXIÓN WHATSAPP
// ============================================
async function iniciarWhatsApp() {
    console.log('====================================');
    console.log('🤖 BOT WHATSAPP - VERSIÓN 27.2 (LECTURA PARÁMETROS HISTORIAS)');
    console.log('====================================\n');
    console.log('⏰ Actualización de agenda: 6:00 AM y 6:00 PM');
    console.log('✍️  Typing adaptativo activado');
    console.log('🔗 Link Previews: título/descripción con Baileys, imagen con caché local');
    console.log('📚 Data Store activado - Extrayendo grupos localmente');
    console.log('🔄 Sincronización automática con Google Sheets: al iniciar y cada 12h');
    console.log('🏷️  Nombres de grupos: búsqueda en store + CACHÉ + consulta directa');
    console.log(`🧹 Limpieza automática del store: mensajes > ${CONFIG.dias_retencion_store} días`);
    console.log('🖼️  SOPORTE MULTIMEDIA: imágenes, audios, videos, documentos');
    console.log('📁 Carpeta de archivos: ' + CONFIG.carpeta_multimedia);
    console.log('👥 GRUPOS COMPLETOS: comando "listagrupos" espera 30 segundos');
    console.log('⚡ CORRECCIÓN DE LATENCIA: mensajes procesados inmediatamente');
    console.log('📊 NUEVO: Leyendo parámetros para Historias desde Google Sheets');
    console.log('🗑️  Las imágenes se eliminan automáticamente después de cada lote');
    console.log('🌐 Browser: Ubuntu (1ra vez) / macOS (sesiones existentes)');
    console.log('📝 Logs locales (carpeta logs/)\n');
    console.log('🆕 Comando: "listagrupos" - Exporta TODOS los grupos (con caché) a CSV + Sheets\n');

    const url_sheets = leerURL();
    if (!url_sheets) {
        console.log('❌ No hay URL');
        return;
    }

    try {
        const { version, isLatest } = await fetchLatestBaileysVersion();
        console.log(`📦 Baileys versión: ${version.join('.')} ${isLatest ? '(última)' : ''}`);
        
        const logger = pino({ level: 'silent' });
        const { state, saveCreds } = await useMultiFileAuthState(CONFIG.carpeta_sesion);

        const existeSesion = fs.existsSync(path.join(CONFIG.carpeta_sesion, 'creds.json'));
        
        let browserConfig;
        if (!existeSesion) {
            browserConfig = ["Ubuntu", "Chrome", "20.0.04"];
            console.log('🌐 Browser: Ubuntu/Chrome (primera vez - para emparejamiento)');
        } else {
            browserConfig = Browsers.macOS("Desktop");
            console.log('🌐 Browser: macOS/Desktop (sesión existente - optimizado)');
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
            cachedGroupMetadata: async (jid) => groupCache.get(jid)
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
                    guardarLogLocal('📥 Primera ejecución - descargando agenda completa...');
                    await actualizarAgenda(sock, url_sheets, 'primera vez');
                }
                
                guardarLogLocal('🔄 Ejecutando sincronización inicial de grupos...');
                await sincronizarGruposConSheets(sock, url_sheets);
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
            guardarLogLocal('⏰ Ejecutando limpieza programada del Data Store (3 AM)');
            limpiarStoreAntiguo();
        });

        CONFIG.horarios_actualizacion.forEach(hora => {
            const [horas, minutos] = hora.split(':');
            const expresionCron = `${minutos} ${horas} * * *`;
            
            cron.schedule(expresionCron, async () => {
                guardarLogLocal(`⏰ Sincronización programada de grupos (${hora})`);
                await sincronizarGruposConSheets(sock, url_sheets);
            });
        });

        CONFIG.horarios_actualizacion.forEach(hora => {
            const [horas, minutos] = hora.split(':');
            const expresionCron = `${minutos} ${horas} * * *`;
            
            cron.schedule(expresionCron, async () => {
                guardarLogLocal(`⏰ Actualización programada de agenda (${hora})`);
                await actualizarAgenda(sock, url_sheets, 'programado');
            });
        });

        cron.schedule('* * * * *', async () => {
            await verificarMensajesLocales(sock);
        });

        // ============================================
        // CORRECCIÓN DE LATENCIA: Evento de mensajes mejorado
        // ============================================
        sock.ev.on('messages.upsert', async (m) => {
            // Solo procesar mensajes nuevos (type === 'notify')
            if (m.type !== 'notify') {
                guardarLogLocal(`   ⏭️ Ignorando mensaje tipo "${m.type}" (no es notificación nueva)`);
                return;
            }
            
            const mensaje = m.messages[0];
            
            // Verificar que sea un mensaje válido y no sea del propio bot
            if (!mensaje.key || mensaje.key.fromMe || !mensaje.message) {
                return;
            }

            const remitente = mensaje.key.remoteJid;
            const texto = mensaje.message.conversation || 
                         mensaje.message.extendedTextMessage?.text || '';
            
            // Ignorar mensajes vacíos
            if (!texto || texto.trim() === '') {
                return;
            }

            // Ignorar mensajes antiguos (buffer)
            const ahora = Date.now() / 1000; // Convertir a segundos
            if (mensaje.messageTimestamp && (ahora - mensaje.messageTimestamp) > 5) {
                guardarLogLocal(`   ⏭️ Ignorando mensaje antiguo (buffer) de ${remitente?.split('@')[0]}: "${texto.substring(0, 30)}..."`);
                return;
            }
            
            // Solo responder a mensajes PRIVADOS
            if (remitente && !remitente.includes('@g.us') && texto) {
                const cmd = texto.toLowerCase().trim();
                guardarLogLocal(`📩 Mensaje recibido de ${remitente.split('@')[0]}: "${cmd}"`);
                
                if (cmd === 'actualizar' || cmd === 'update') {
                    guardarLogLocal(`   Procesando comando: actualizar`);
                    const resultado = await actualizarAgenda(sock, url_sheets, 'remoto');
                    if (resultado) {
                        await sock.sendMessage(remitente, { text: '✅ Agenda actualizada correctamente' });
                    } else {
                        await sock.sendMessage(remitente, { text: '❌ Error al actualizar agenda' });
                    }
                }
                
                else if (cmd === 'status' || cmd === 'estado') {
                    guardarLogLocal(`   Procesando comando: status`);
                    const agenda = cargarAgendaLocal();
                    const total = agenda.grupos?.length || 0;
                    const pestanas = Object.keys(agenda.pestanas || {}).length;
                    const activos = agenda.grupos?.filter(g => g.activo === 'SI').length || 0;
                    
                    let mensaje = `📊 *ESTADO DEL BOT*\n\n` +
                                  `📅 Última actualización: ${agenda.ultima_actualizacion || 'N/A'}\n` +
                                  `📋 Grupos totales: ${total}\n` +
                                  `✅ Grupos activos: ${activos}\n` +
                                  `📌 Pestañas: ${pestanas}\n` +
                                  `⏱️  Delay mensajes: ${CONFIG.tiempo_entre_mensajes_min}-${CONFIG.tiempo_entre_mensajes_max} seg\n` +
                                  `✍️  Typing adaptativo: activado\n` +
                                  `🔗 Link Previews: CON IMAGEN (caché local)\n` +
                                  `📚 Data Store: ACTIVADO (extracción local)\n` +
                                  `🔄 Sincronización Sheets: automática (6am/6pm)\n` +
                                  `🏷️  Nombres de grupos: CACHÉ + store + consulta directa\n` +
                                  `🧹 Limpieza store: automática (3 AM) - ${CONFIG.dias_retencion_store} días\n` +
                                  `🖼️  Soporte multimedia: ACTIVADO (imágenes, audios, videos, docs)\n` +
                                  `👥  Grupos completos: espera 30 segundos en "listagrupos"\n` +
                                  `⚡  Latencia: CORREGIDA (mensajes inmediatos)\n` +
                                  // ============================================
                                  // NUEVO: Mostrar parámetros de Historias en Status
                                  // ============================================
                                  `📅  Config Historias: ${CONFIG.horario_historias} (${CONFIG.dias_historias}) intervalo ${CONFIG.intervalo_historias_min}-${CONFIG.intervalo_historias_max} min\n` +
                                  `🗑️  Limpieza automática: activada\n` +
                                  `🌐 Browser: ${existeSesion ? 'macOS/Desktop' : 'Ubuntu/Chrome'}\n` +
                                  `📤 Comando listagrupos: disponible (con caché)\n` +
                                  `⏰ Próxima actualización: 6am/6pm`;
                    
                    await sock.sendMessage(remitente, { text: mensaje });
                }
                
                else if (cmd === 'listagrupos' || cmd === 'grupos') {
                    guardarLogLocal(`   Procesando comando: listagrupos`);
                    
                    await sock.sendMessage(remitente, { text: '🔄 Procesando lista de grupos (espera 30 segundos para capturar TODOS)...' });
                    
                    const grupos = await obtenerGruposDesdeStore(sock, true);
                    
                    if (grupos.length === 0) {
                        await sock.sendMessage(remitente, { text: '❌ No se encontraron grupos.' });
                        return;
                    }
                    
                    const sheetsResult = await enviarGruposASheets(sock, url_sheets, grupos);
                    
                    const csvResult = await enviarCSVporWhatsApp(sock, remitente, grupos);
                    
                    let confirmacion = '✅ *PROCESO COMPLETADO*\n\n';
                    confirmacion += `📊 Total de grupos: ${grupos.length}\n`;
                    confirmacion += sheetsResult ? '✅ Guardado en Google Sheets (LISTA_GRUPOS)\n' : '❌ Error en Google Sheets\n';
                    confirmacion += csvResult ? '✅ CSV enviado por WhatsApp\n' : '❌ Error enviando CSV\n';
                    confirmacion += `📚 Fuente: Data Store local + CACHÉ + eventos (30s espera)`;
                    
                    await sock.sendMessage(remitente, { text: confirmacion });
                }
            }
        });

        console.log('\n📝 Comandos disponibles en WhatsApp:');
        console.log('   - "actualizar" - Forzar descarga de agenda');
        console.log('   - "status" - Ver estado del bot (incluye configuración de Historias)');
        console.log('   - "listagrupos" - Exporta TODOS los grupos (con caché) a CSV + Sheets');
        console.log('   - Presiona CTRL+C para salir\n');

    } catch (error) {
        guardarLogLocal(`❌ ERROR FATAL: ${error.message}`);
        setTimeout(() => iniciarWhatsApp(), 30000);
    }
}

process.on('SIGINT', () => {
    console.log('\n\n👋 Cerrando bot...');
    guardarLogLocal('BOT CERRADO MANUALMENTE');
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
