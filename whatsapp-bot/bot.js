// ============================================
// BOT DE WHATSAPP PARA TERMUX
// Versión: 41.0 - SPINTEX LIMPIO + TABLA DE ARCHIVOS
// + MEJORA 1: Keep-Alive cada 25 segundos
// + MEJORA 2: Ignorar mensajes de grupos
// + NUEVO: Sistema de SpinTex y SpinEmoji (CORREGIDO)
// + NUEVO: Tabla de correspondencia producto-archivo
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
    tiempo_espera_grupos: 30000
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
// NUEVO: CACHE DE PRODUCTOS (para tabla de correspondencia)
// ============================================
let productosCache = [];
let ultimaActualizacionProductos = 0;

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
// FUNCIÓN PARA BUSCAR ARCHIVO MULTIMEDIA (CORREGIDA)
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
                        // Comparación exacta del nombre base (sin extensión)
                        if (nombreSinExtension === nombreLimpio) {
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
// CONSULTAR TODOS LOS GRUPOS A GOOGLE SHEETS
// ============================================
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
                    console.log(`⏱️  Delay configurado: ${CONFIG.tiempo_entre_mensajes_min}-${CONFIG.tiempo_entre_mensajes_max} segundos (formato min-max)`);
                } else {
                    console.log(`⚠️  Formato de delay inválido: ${delayStr}, usando valores por defecto`);
                }
            } else if (delayStr && !isNaN(parseInt(delayStr))) {
                const valor = parseInt(delayStr);
                CONFIG.tiempo_entre_mensajes_min = 1;
                CONFIG.tiempo_entre_mensajes_max = valor;
                console.log(`⏱️  Delay configurado: ${CONFIG.tiempo_entre_mensajes_min}-${CONFIG.tiempo_entre_mensajes_max} segundos (convertido desde valor único)`);
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
            console.log(`   📌 ${pestana}: ${agenda.pestanas[pestana].grupos.length} grupos - Horario: ${agenda.pestanas[pestana].horario || 'N/A'}`);
        });
        
        return true;
    } catch (error) {
        console.error('❌ Error guardando agenda:', error.message);
        return false;
    }
}

// ============================================
// VARIABLE PARA ALMACENAR LA AGENDA EN MEMORIA
// ============================================
let agendaEnMemoria = null;

// ============================================
// CARGAR AGENDA LOCAL (SOLO UNA VEZ Y CUANDO SEA NECESARIO)
// ============================================
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

// ============================================
// FORZAR RECARGA DE AGENDA (para el comando actualizar)
// ============================================
function recargarAgenda() {
    agendaEnMemoria = null;
    return cargarAgendaLocal();
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
            recargarAgenda();
            const total = data.grupos?.length || 0;
            const pestanas = data.pestanas?.length || 0;
            guardarLogLocal(`✅ Agenda actualizada: ${total} grupos en ${pestanas} pestañas`);
            
            // Actualizar caché de productos con los productos recibidos
            if (data.productos && Array.isArray(data.productos)) {
                productosCache = data.productos;
                ultimaActualizacionProductos = Date.now();
                guardarLogLocal(`📦 Caché de productos actualizado desde Sheets: ${productosCache.length} productos`);
            }
            
            return true;
        }
        return false;
    } catch (error) {
        guardarLogLocal(`❌ Error actualizando agenda: ${error.message}`);
        return false;
    }
}

// ============================================
// GUARDAR LOG LOCAL (MEJORADO)
// ============================================
function guardarLogLocal(texto) {
    const fecha = new Date().toISOString().split('T')[0];
    const logFile = path.join(CONFIG.carpeta_logs, `${fecha}.log`);
    const hora = new Date().toLocaleTimeString();
    const linea = `[${hora}] ${texto}`;
    
    fs.appendFileSync(logFile, linea + '\n');
    
    if (texto.includes('📩 Mensaje recibido')) {
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
// NUEVA FUNCIÓN: Obtener emoji inteligente (sin cambios)
// ============================================
function obtenerEmojiInteligente(producto) {
    if (!producto) return '🎁';
    
    const texto = producto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    if (texto.includes('vaso') || texto.includes('taza') || texto.includes('botella') || 
        texto.includes('agua') || texto.includes('bebida') || texto.includes('cafe') || 
        texto.includes('café') || texto.includes('termo')) {
        return '🥤';
    }
    
    if (texto.includes('comida') || texto.includes('hamburguesa') || texto.includes('pizza') || 
        texto.includes('sandwich') || texto.includes('pan') || texto.includes('comer')) {
        return '🍔';
    }
    
    if (texto.includes('gorra') || texto.includes('sombrero') || texto.includes('camisa') || 
        texto.includes('camiseta') || texto.includes('pantalon') || texto.includes('vestido') ||
        texto.includes('ropa')) {
        return '👕';
    }
    
    if (texto.includes('telefono') || texto.includes('celular') || texto.includes('computadora') || 
        texto.includes('tablet') || texto.includes('cargador') || texto.includes('audifono') ||
        texto.includes('electronica')) {
        return '📱';
    }
    
    if (texto.includes('pelota') || texto.includes('deporte') || texto.includes('bicicleta') || 
        texto.includes('gimnasio') || texto.includes('ejercicio')) {
        return '⚽';
    }
    
    if (texto.includes('mueble') || texto.includes('silla') || texto.includes('mesa') || 
        texto.includes('cama') || texto.includes('decoracion')) {
        return '🏠';
    }
    
    return '🎁';
}

// ============================================
// NUEVA FUNCIÓN: Obtener productos desde Google Sheets (para tabla de correspondencia)
// ============================================
async function obtenerProductosDesdeSheets(url) {
    try {
        const respuesta = await axios.get(url);
        const data = respuesta.data;
        
        if (!data || !data.grupos) {
            return [];
        }
        
        // Extraer productos únicos de los mensajes
        const productosMap = new Map();
        
        data.grupos.forEach(grupo => {
            if (grupo.mensaje && grupo.mensaje.includes('*')) {
                // Extraer nombre del producto (entre asteriscos)
                const match = grupo.mensaje.match(/\*([^*]+)\*/);
                if (match && match[1]) {
                    const nombreProducto = match[1].trim();
                    // Buscar archivo en el mensaje (entre paréntesis)
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
        guardarLogLocal(`❌ Error obteniendo productos: ${error.message}`);
        return [];
    }
}

// ============================================
// NUEVA FUNCIÓN: Actualizar caché de productos
// ============================================
async function actualizarCacheProductos(url) {
    try {
        const ahora = Date.now();
        // Actualizar cada hora
        if (ahora - ultimaActualizacionProductos < 3600000 && productosCache.length > 0) {
            return productosCache;
        }
        
        productosCache = await obtenerProductosDesdeSheets(url);
        ultimaActualizacionProductos = ahora;
        guardarLogLocal(`📦 Caché de productos actualizado: ${productosCache.length} productos`);
        return productosCache;
        
    } catch (error) {
        guardarLogLocal(`❌ Error actualizando caché de productos: ${error.message}`);
        return productosCache;
    }
}

// ============================================
// NUEVA FUNCIÓN: Buscar archivo por nombre de producto (CORREGIDA CON TRIM)
// ============================================
function buscarArchivoPorProducto(nombreProducto) {
    if (!nombreProducto || productosCache.length === 0) return null;
    
    // Buscar el producto exacto en el caché
    const producto = productosCache.find(p => 
        p.producto.toLowerCase() === nombreProducto.toLowerCase()
    );
    
    if (producto) {
        // El archivo viene con paréntesis, los eliminamos y aplicamos trim para quitar espacios extras
        const archivoLimpio = producto.archivo.replace(/^\(|\)$/g, '').trim();
        guardarLogLocal(`   📦 Producto encontrado: "${producto.producto}" → archivo: "${archivoLimpio}"`);
        return archivoLimpio;
    }
    
    guardarLogLocal(`   ⚠️ Producto no encontrado en caché: "${nombreProducto}"`);
    return null;
}

// ============================================
// NUEVA FUNCIÓN: Extraer nombre del producto del texto (CORREGIDA)
// ============================================
function extraerNombreProducto(texto) {
    // Buscar el ÚLTIMO par de asteriscos en el mensaje (que es donde está el producto)
    const matches = [...texto.matchAll(/\*([^*]+)\*/g)];
    if (matches.length > 0) {
        // Tomar el último match (el producto)
        const ultimo = matches[matches.length - 1];
        return ultimo[1].trim();
    }
    return null;
}

// ============================================
// FUNCIÓN PARA PROCESAR SPINTEX Y SPINEMOJI (CORREGIDA PARA BAILEYS)
// ============================================
function procesarSpinEnMensaje(texto) {
    if (!texto || typeof texto !== 'string') return texto;
    
    let textoProcesado = texto;
    let modificado = false;
    
    // 1. Procesar SpinTex: {spin|opcion1|opcion2|opcion3}
    const spinTexRegex = /\{spin\|(.*?)\}/gi;
    let match;
    
    while ((match = spinTexRegex.exec(texto)) !== null) {
        const contenido = match[1];
        const opciones = contenido.split('|').map(op => op.trim()).filter(op => op !== '');
        
        if (opciones.length > 0) {
            const opcionAleatoria = opciones[Math.floor(Math.random() * opciones.length)];
            textoProcesado = textoProcesado.replace(match[0], opcionAleatoria);
            modificado = true;
            guardarLogLocal(`   🎲 SpinTex: elegida "${opcionAleatoria}" de [${opciones.join(', ')}]`);
        }
    }
    
    // 2. Procesar SpinEmoji: {emoji|😀|😎|🥳} o simplemente {👋|😊|✨|🙌} SIN palabra clave
    const spinEmojiRegex = /\{([^}]+)\}/g;
    
    while ((match = spinEmojiRegex.exec(texto)) !== null) {
        if (match[0].startsWith('{spin|')) continue;
        
        const contenido = match[1];
        const opciones = contenido.split('|').map(op => op.trim()).filter(op => op !== '');
        
        if (opciones.length > 0) {
            const opcionAleatoria = opciones[Math.floor(Math.random() * opciones.length)];
            textoProcesado = textoProcesado.replace(match[0], opcionAleatoria);
            modificado = true;
            guardarLogLocal(`   🎲 SpinEmoji: elegido "${opcionAleatoria}" de [${opciones.join(', ')}]`);
        }
    }
    
    if (modificado) {
        guardarLogLocal(`   📝 Mensaje después de spin: "${textoProcesado}"`);
    }
    
    return textoProcesado;
}

// ============================================
// FUNCIÓN MODIFICADA: ENVIAR MENSAJE (con tabla de correspondencia CORREGIDA)
// ============================================
async function enviarMensaje(sock, id_grupo, mensajeOriginal) {
    try {
        if (!id_grupo || !id_grupo.includes('@g.us')) {
            return 'ERROR: ID inválido';
        }
        
        // Aplicar procesamiento de spin al mensaje
        const mensajeProcesado = procesarSpinEnMensaje(mensajeOriginal);
        
        // CORRECCIÓN CRÍTICA PARA BAILEYS:
        // Forzar que el mensaje sea tratado como string plano
        const mensajeFinal = String(mensajeProcesado);
        
        // NUEVO: Buscar archivo por nombre de producto
        const nombreProducto = extraerNombreProducto(mensajeFinal);
        let archivoEnviado = false;
        
        if (nombreProducto) {
            guardarLogLocal(`   🔍 Producto detectado en mensaje: "${nombreProducto}"`);
            const nombreArchivo = buscarArchivoPorProducto(nombreProducto);
            
            if (nombreArchivo) {
                guardarLogLocal(`   📦 Buscando archivo: "${nombreArchivo}" en carpeta multimedia`);
                const archivoInfo = buscarArchivoMultimedia(nombreArchivo);
                
                if (archivoInfo) {
                    guardarLogLocal(`   ✅ Archivo encontrado: ${archivoInfo.nombre}`);
                    
                    // Limpiar el texto de posibles paréntesis residuales
                    const textoLimpio = mensajeFinal.replace(/\([^)]+\)/g, '').trim();
                    
                    // Enviar archivo multimedia con el texto como caption o por separado según el tipo
                    const resultado = await enviarArchivoMultimedia(sock, id_grupo, archivoInfo, textoLimpio);
                    archivoEnviado = true;
                    return resultado;
                } else {
                    guardarLogLocal(`   ⚠️ Archivo no encontrado: "${nombreArchivo}" en la carpeta multimedia`);
                }
            }
        }
        
        // Verificar si hay referencia a archivo multimedia en el texto (por compatibilidad)
        const regexArchivo = /\(([^)]+)\)/;
        const match = mensajeFinal.match(regexArchivo);
        
        if (match && !archivoEnviado) {
            const nombreArchivo = match[1];
            // Limpiar el texto quitando la referencia al archivo
            const textoLimpio = mensajeFinal.replace(regexArchivo, '').trim();
            
            guardarLogLocal(`   🔍 Buscando archivo por referencia directa: "${nombreArchivo}"`);
            const archivoInfo = buscarArchivoMultimedia(nombreArchivo);
            
            if (archivoInfo) {
                const resultado = await enviarArchivoMultimedia(sock, id_grupo, archivoInfo, textoLimpio);
                return resultado;
            } else {
                guardarLogLocal(`   ⚠️ Archivo no encontrado por referencia directa: "${nombreArchivo}"`);
                // Enviar como texto simple
                await sock.sendMessage(id_grupo, { text: mensajeFinal });
                return 'TEXTO ENVIADO (archivo no encontrado)';
            }
        }
        
        // Si no hay archivo, enviar solo el texto
        await sock.sendMessage(id_grupo, { text: mensajeFinal });
        return 'TEXTO ENVIADO';
        
    } catch (error) {
        guardarLogLocal(`   ❌ Error en envío: ${error.message}`);
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
// NUEVA FUNCIÓN: Consulta masiva de grupos (UNA SOLA VEZ)
// ============================================
async function obtenerTodosLosGruposWhatsApp(sock) {
    try {
        guardarLogLocal('🔍 Ejecutando consulta MASIVA de grupos (UNA SOLA VEZ)...');
        
        // Verificar si la función existe
        if (typeof sock.groupFetchAllParticipatingGroups !== 'function') {
            guardarLogLocal('⚠️ Función no disponible, usando método alternativo');
            return null;
        }
        
        // UNA SOLA CONSULTA para obtener TODOS los grupos
        const gruposDict = await sock.groupFetchAllParticipatingGroups();
        
        if (!gruposDict || typeof gruposDict !== 'object') {
            guardarLogLocal('⚠️ No se obtuvieron grupos');
            return null;
        }
        
        // Convertir a array
        const gruposArray = Object.entries(gruposDict).map(([id, info]) => ({
            id: id,
            info: info
        }));
        
        guardarLogLocal(`✅ Consulta masiva exitosa: ${gruposArray.length} grupos obtenidos en UNA SOLA LLAMADA`);
        return gruposArray;
        
    } catch (error) {
        guardarLogLocal(`❌ Error en consulta masiva: ${error.message}`);
        return null;
    }
}

// ============================================
// FUNCIÓN PRINCIPAL MODIFICADA: Obtener grupos (USA CONSULTA MASIVA)
// ============================================
async function obtenerGruposDesdeStore(sock, usarEspera = false) {
    try {
        guardarLogLocal('🔍 Obteniendo grupos...');
        
        // PASO 1: Intentar consulta masiva (UNA SOLA VEZ)
        const gruposMasivos = await obtenerTodosLosGruposWhatsApp(sock);
        
        // PASO 2: Si la consulta masiva funciona, procesar todo de una vez
        if (gruposMasivos && gruposMasivos.length > 0) {
            guardarLogLocal(`   Procesando ${gruposMasivos.length} grupos desde consulta masiva...`);
            
            const listaGrupos = [];
            
            for (const grupo of gruposMasivos) {
                let nombreGrupo = 'Sin nombre';
                const info = grupo.info;
                
                // Buscar nombre en diferentes campos
                if (info.name && info.name !== 'Sin nombre' && info.name.trim() !== '') {
                    nombreGrupo = info.name;
                }
                else if (info.subject && info.subject !== 'Sin nombre' && info.subject.trim() !== '') {
                    nombreGrupo = info.subject;
                }
                else if (info.metadata && info.metadata.subject) {
                    nombreGrupo = info.metadata.subject;
                }
                else if (info.metadata && info.metadata.name) {
                    nombreGrupo = info.metadata.name;
                }
                else if (info.title) {
                    nombreGrupo = info.title;
                }
                
                // Guardar en caché para futuras consultas
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
        
        // PASO 3: Si la consulta masiva falla, usar el método antiguo (grupo por grupo)
        guardarLogLocal('⚠️ Usando método alternativo (grupo por grupo)...');
        
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
// SISTEMA DE COMANDOS PRIORITARIOS
// ============================================

let procesandoComandoPrioritario = false;

async function procesarComandoPrioritario(sock, cmd, remitente, url_sheets) {
    try {
        procesandoComandoPrioritario = true;
        guardarLogLocal(`   ⚡ PRIORITARIO: Procesando comando "${cmd}" inmediatamente`);
        
        if (cmd === 'actualizar' || cmd === 'update') {
            guardarLogLocal(`   Procesando comando prioritario: actualizar`);
            const resultado = await actualizarAgenda(sock, url_sheets, 'remoto');
            if (resultado) {
                await sock.sendMessage(remitente, { text: '✅ Agenda actualizada correctamente' });
            } else {
                await sock.sendMessage(remitente, { text: '❌ Error al actualizar agenda' });
            }
        }
        
        else if (cmd === 'listagrupos' || cmd === 'grupos') {
            guardarLogLocal(`   Procesando comando prioritario: listagrupos`);
            
            await sock.sendMessage(remitente, { text: '🔄 Procesando lista de grupos (prioritario)...' });
            
            const grupos = await obtenerGruposDesdeStore(sock, true);
            
            if (grupos.length === 0) {
                await sock.sendMessage(remitente, { text: '❌ No se encontraron grupos.' });
                procesandoComandoPrioritario = false;
                return;
            }
            
            const sheetsResult = await enviarGruposASheets(sock, url_sheets, grupos);
            
            const csvResult = await enviarCSVporWhatsApp(sock, remitente, grupos);
            
            let confirmacion = '✅ *PROCESO COMPLETADO (PRIORITARIO)*\n\n';
            confirmacion += `📊 Total de grupos: ${grupos.length}\n`;
            confirmacion += sheetsResult ? '✅ Guardado en Google Sheets (LISTA_GRUPOS)\n' : '❌ Error en Google Sheets\n';
            confirmacion += csvResult ? '✅ CSV enviado por WhatsApp\n' : '❌ Error enviando CSV\n';
            confirmacion += `📚 Fuente: Consulta MASIVA (UNA SOLA LLAMADA)`;
            
            await sock.sendMessage(remitente, { text: confirmacion });
        }
        
        guardarLogLocal(`   ✅ Comando prioritario completado`);
        procesandoComandoPrioritario = false;
        
    } catch (error) {
        guardarLogLocal(`   ❌ Error en comando prioritario: ${error.message}`);
        procesandoComandoPrioritario = false;
    }
}

// ============================================
// INICIAR CONEXIÓN WHATSAPP
// ============================================
async function iniciarWhatsApp() {
    console.log('====================================');
    console.log('🤖 BOT WHATSAPP - VERSIÓN 41.0 (SPINTEX LIMPIO + TABLA DE ARCHIVOS)');
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
    console.log('⚡⚡ NUEVO: SISTEMA DE COMANDOS PRIORITARIOS');
    console.log('   - "actualizar" y "listagrupos" se procesan INMEDIATAMENTE');
    console.log('🔄 RESTAURADO: Consulta masiva de grupos (UNA SOLA LLAMADA)');
    console.log('🗑️  Las imágenes se eliminan automáticamente después de cada lote');
    console.log('🌐 Browser: Ubuntu (1ra vez) / macOS (sesiones existentes)');
    console.log('📝 Logs locales (carpeta logs/)');
    console.log('🆕 Comando: "listagrupos" - Exporta TODOS los grupos (con caché) a CSV + Sheets');
    console.log('🎲 **SPINTEX Y SPINEMOJI CORREGIDOS PARA BAILEYS**');
    console.log('   - {spin|opción1|opción2} → Elige aleatoriamente');
    console.log('   - {emoji|😀|😎|🥳} o {👋|😊|✨} → Elige emoji aleatorio');
    console.log('📦 **NUEVO: TABLA DE CORRESPONDENCIA PRODUCTO-ARCHIVO**');
    console.log('   - Los archivos se envían automáticamente según el producto elegido\n');

    const url_sheets = leerURL();
    if (!url_sheets) {
        console.log('❌ No hay URL');
        return;
    }

    try {
        // Cargar caché de productos al iniciar
        await actualizarCacheProductos(url_sheets);
        
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

        // ============================================
        // CONFIGURACIÓN DEL SOCKET
        // ============================================
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
            // >>> MEJORA 1: Keep-Alive cada 25 segundos <<<
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
                    guardarLogLocal('📥 Primera ejecución - descargando agenda completa...');
                    await actualizarAgenda(sock, url_sheets, 'primera vez');
                }
                
                // Actualizar caché de productos
                await actualizarCacheProductos(url_sheets);
                
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
                if (procesandoComandoPrioritario) {
                    guardarLogLocal(`⏰ Sincronización pospuesta (comando prioritario en ejecución)`);
                    return;
                }
                guardarLogLocal(`⏰ Sincronización programada de grupos (${hora})`);
                await sincronizarGruposConSheets(sock, url_sheets);
            });
        });

        CONFIG.horarios_actualizacion.forEach(hora => {
            const [horas, minutos] = hora.split(':');
            const expresionCron = `${minutos} ${horas} * * *`;
            
            cron.schedule(expresionCron, async () => {
                if (procesandoComandoPrioritario) {
                    guardarLogLocal(`⏰ Actualización pospuesta (comando prioritario en ejecución)`);
                    return;
                }
                guardarLogLocal(`⏰ Actualización programada de agenda (${hora})`);
                await actualizarAgenda(sock, url_sheets, 'programado');
            });
        });

        cron.schedule('* * * * *', async () => {
            if (procesandoComandoPrioritario) {
                return;
            }
            await verificarMensajesLocales(sock);
        });

        // ============================================
        // EVENTO DE MENSAJES
        // ============================================
        sock.ev.on('messages.upsert', async (m) => {
            const mensaje = m.messages[0];
            
            if (!mensaje.key || mensaje.key.fromMe || !mensaje.message) {
                return;
            }

            const remitente = mensaje.key.remoteJid;

            // >>> MEJORA 2: Ignorar mensajes de grupos completamente <<<
            if (remitente && remitente.includes('@g.us')) {
                return; // No procesar mensajes de grupos
            }
            // >>> FIN MEJORA 2 <<<

            const texto = mensaje.message.conversation || 
                         mensaje.message.extendedTextMessage?.text || '';
            
            if (!texto || texto.trim() === '') {
                return;
            }
            
            if (remitente && !remitente.includes('@g.us') && texto) {
                const cmd = texto.toLowerCase().trim();
                
                console.log('\n═══════════════════════════════════════════════');
                console.log(`📩 MENSAJE RECIBIDO de ${remitente.split('@')[0]}: "${cmd}"`);
                console.log('═══════════════════════════════════════════════\n');
                
                guardarLogLocal(`📩 Mensaje de ${remitente.split('@')[0]}: "${cmd}"`);
                
                if (cmd === 'actualizar' || cmd === 'update' || cmd === 'listagrupos' || cmd === 'grupos') {
                    setImmediate(() => {
                        procesarComandoPrioritario(sock, cmd, remitente, url_sheets);
                    });
                    return;
                }
                
                else if (cmd === 'status' || cmd === 'estado') {
                    if (procesandoComandoPrioritario) {
                        guardarLogLocal(`   ⏳ Comando status en espera (prioritario en ejecución)`);
                        setTimeout(async () => {
                            guardarLogLocal(`   Procesando comando: status (diferido)`);
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
                                          `⚡⚡ Comandos prioritarios: ACTIVADOS\n` +
                                          `🔄 Consulta masiva: RESTAURADA\n` +
                                          `🗑️  Limpieza automática: activada\n` +
                                          `📦 Tabla producto-archivo: ACTIVADA\n` +
                                          `🌐 Browser: ${existeSesion ? 'macOS/Desktop' : 'Ubuntu/Chrome'}\n` +
                                          `📤 Comando listagrupos: disponible (con caché)\n` +
                                          `🎲 SpinTex/SpinEmoji: CORREGIDO PARA BAILEYS\n` +
                                          `⏰ Próxima actualización: 6am/6pm`;
                            
                            await sock.sendMessage(remitente, { text: mensaje });
                        }, 1000);
                    } else {
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
                                      `⚡⚡ Comandos prioritarios: ACTIVADOS\n` +
                                      `🔄 Consulta masiva: RESTAURADA\n` +
                                      `🗑️  Limpieza automática: activada\n` +
                                      `📦 Tabla producto-archivo: ACTIVADA\n` +
                                      `🌐 Browser: ${existeSesion ? 'macOS/Desktop' : 'Ubuntu/Chrome'}\n` +
                                      `📤 Comando listagrupos: disponible (con caché)\n` +
                                      `🎲 SpinTex/SpinEmoji: CORREGIDO PARA BAILEYS\n` +
                                      `⏰ Próxima actualización: 6am/6pm`;
                        
                        await sock.sendMessage(remitente, { text: mensaje });
                    }
                }
            }
        });

        console.log('\n📝 Comandos disponibles en WhatsApp:');
        console.log('   - "actualizar" - ⚡ PRIORITARIO (se ejecuta inmediatamente)');
        console.log('   - "listagrupos" - ⚡ PRIORITARIO (se ejecuta inmediatamente)');
        console.log('   - "status" - Ver estado del bot');
        console.log('   - Presiona CTRL+C para salir\n');
        console.log('🎲 **SpinTex y SpinEmijo CORREGIDOS**');
        console.log('   Ejemplo 1 (con palabra clave): "{spin|Hola|Qué tal|Buenos días}"');
        console.log('   Ejemplo 2 (solo emojis): "{👋|😊|✨|🙌}"');
        console.log('   Ejemplo 3 (con palabra clave emoji): "{emoji|😀|😎|🥳}"\n');
        console.log('📦 **NUEVO: Tabla producto-archivo activa**');
        console.log('   - Los archivos se envían automáticamente según el producto\n');

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
