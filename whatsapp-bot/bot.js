// ============================================
// BOT DE WHATSAPP PARA TERMUX
// Versión: 2.0 (con código de emparejamiento)
// ============================================

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeInMemoryStore } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cron = require('node-cron');
const readline = require('readline');

// ============================================
// CONFIGURACIÓN
// ============================================
const CONFIG = {
    carpeta_sesion: './sesion_whatsapp',
    archivo_url: '../url_sheets.txt',  // La URL que guardamos al instalar
    tiempo_entre_mensajes: 5000,  // 5 segundos entre mensajes
    carpeta_logs: './logs',
    numero_telefono: ''  // Se pedirá al inicio
};

// Crear carpetas necesarias
if (!fs.existsSync(CONFIG.carpeta_logs)) {
    fs.mkdirSync(CONFIG.carpeta_logs);
}
if (!fs.existsSync(CONFIG.carpeta_sesion)) {
    fs.mkdirSync(CONFIG.carpeta_sesion);
}

// ============================================
// LEER URL DE GOOGLE SHEETS
// ============================================
function leerURL() {
    try {
        // Buscar el archivo en diferentes lugares
        let urlPath = CONFIG.archivo_url;
        if (!fs.existsSync(urlPath)) {
            // Intentar en el directorio actual
            urlPath = './url_sheets.txt';
        }
        
        const url = fs.readFileSync(urlPath, 'utf8').trim();
        console.log('✅ URL de Google Sheets cargada');
        return url;
    } catch (error) {
        console.error('❌ No se pudo leer la URL:', error.message);
        console.log('📝 Crea un archivo url_sheets.txt con tu URL de Google Sheets');
        return null;
    }
}

// ============================================
// PEDIR NÚMERO DE TELÉFONO
// ============================================
function pedirNumeroTelefono() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        console.log('\n====================================');
        console.log('📱 CONFIGURACIÓN INICIAL');
        console.log('====================================');
        console.log('Necesitas tu número de teléfono con código de país');
        console.log('Ejemplo: 521234567890 (México)');
        console.log('Ejemplo: 5511999999999 (Brasil)');
        console.log('Ejemplo: 34666666666 (España)');
        console.log('====================================\n');
        
        rl.question('✏️  Escribe tu número (sin + ni espacios): ', (numero) => {
            rl.close();
            resolve(numero.trim());
        });
    });
}

// ============================================
// CONSULTAR MENSAJES PENDIENTES
// ============================================
async function consultarMensajesPendientes(url) {
    try {
        console.log('🔄 Consultando Google Sheets...');
        const respuesta = await axios.get(url);
        return respuesta.data;
    } catch (error) {
        console.error('❌ Error al consultar Google Sheets:', error.message);
        return null;
    }
}

// ============================================
// REGISTRAR ENVÍO EN LOGS
// ============================================
async function registrarEnvio(url, id_grupo, mensaje, estado) {
    try {
        await axios.post(url, {
            accion: 'registrar_envio',
            id_grupo: id_grupo,
            mensaje: mensaje,
            estado: estado
        });
    } catch (error) {
        console.log('⚠️ No se pudo registrar en logs:', error.message);
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
}

// ============================================
// ENVIAR MENSAJE A GRUPO
// ============================================
async function enviarMensaje(sock, id_grupo, mensaje) {
    try {
        console.log(`📤 Enviando a: ${id_grupo}`);
        
        // Verificar que el ID del grupo es válido
        if (!id_grupo || !id_grupo.includes('@g.us')) {
            console.log('❌ ID de grupo no válido:', id_grupo);
            return 'ERROR: ID inválido';
        }
        
        await sock.sendMessage(id_grupo, { text: mensaje });
        console.log('✅ Enviado correctamente');
        return 'ENVIADO';
    } catch (error) {
        console.error('❌ Error al enviar:', error.message);
        return 'ERROR: ' + error.message.substring(0, 50);
    }
}

// ============================================
// PROCESAR MENSAJES PENDIENTES
// ============================================
async function procesarMensajes(sock, url) {
    try {
        // Consultar mensajes pendientes
        const data = await consultarMensajesPendientes(url);
        
        if (!data) {
            console.log('⚠️ No se pudo obtener datos de Google Sheets');
            return;
        }
        
        if (!data.pendientes || data.pendientes.length === 0) {
            console.log('⏳ No hay mensajes programados para este minuto');
            return;
        }

        console.log(`📊 Se encontraron ${data.pendientes.length} mensajes para enviar ahora`);

        // Enviar cada mensaje
        for (const grupo of data.pendientes) {
            console.log('-----------------------------------');
            console.log(`👥 Grupo: ${grupo.nombre || 'Sin nombre'}`);
            console.log(`🆔 ID: ${grupo.id}`);
            
            const estado = await enviarMensaje(sock, grupo.id, grupo.mensaje);
            
            // Registrar en Google Sheets
            await registrarEnvio(url, grupo.id, grupo.mensaje, estado);
            
            // Guardar en log local
            guardarLogLocal(`${grupo.id} - ${estado}`);
            
            // Esperar entre mensajes
            await new Promise(resolve => setTimeout(resolve, CONFIG.tiempo_entre_mensajes));
        }
        
        console.log('-----------------------------------');
        console.log('✅ Lote completado');
        
    } catch (error) {
        console.error('❌ Error en procesarMensajes:', error.message);
        guardarLogLocal(`ERROR GENERAL: ${error.message}`);
    }
}

// ============================================
// INICIAR CONEXIÓN WHATSAPP CON CÓDIGO DE EMPAREJAMIENTO
// ============================================
async function iniciarWhatsApp() {
    console.log('====================================');
    console.log('🤖 INICIANDO BOT DE WHATSAPP');
    console.log('====================================');

    // Leer URL de Google Sheets
    const url_sheets = leerURL();
    if (!url_sheets) {
        console.log('❌ No se puede continuar sin la URL de Google Sheets');
        console.log('📝 Ejecuta primero: cat url_sheets.txt');
        return;
    }

    try {
        // Obtener última versión de Baileys
        const { version, isLatest } = await fetchLatestBaileysVersion();
        console.log(`📦 Usando Baileys versión: ${version} (${isLatest ? 'última' : 'desactualizada'})`);

        // Cargar estado de autenticación
        const { state, saveCreds } = await useMultiFileAuthState(CONFIG.carpeta_sesion);

        // Verificar si ya existe sesión
        const existeSesion = fs.existsSync(path.join(CONFIG.carpeta_sesion, 'creds.json'));
        
        if (!existeSesion) {
            // Primera vez: pedir número para código de emparejamiento
            console.log('\n📱 PRIMERA CONFIGURACIÓN');
            console.log('Necesitas vincular este bot con tu WhatsApp');
            
            const numero = await pedirNumeroTelefono();
            CONFIG.numero_telefono = numero;
            
            console.log(`\n🔄 Solicitando código para: ${numero}`);
        }

        // Crear socket
        const sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false,  // No usar QR
            browser: ['WhatsApp Bot', 'Termux', '2.0.0'],
            syncFullHistory: false,
            markOnlineOnConnect: true
        });

        // Si es primera vez, solicitar código de emparejamiento
        if (!existeSesion && CONFIG.numero_telefono) {
            setTimeout(async () => {
                try {
                    console.log('🔄 Solicitando código de emparejamiento...');
                    let code = await sock.requestPairingCode(CONFIG.numero_telefono);
                    code = code.match(/.{1,4}/g)?.join('-') || code;
                    
                    console.log('\n====================================');
                    console.log('🔐 CÓDIGO DE EMPAREJAMIENTO');
                    console.log('====================================');
                    console.log(`📱 Código: ${code}`);
                    console.log('====================================');
                    console.log('📌 INSTRUCCIONES:');
                    console.log('1. Abre WhatsApp en tu teléfono');
                    console.log('2. Ve a: 3 puntos → Dispositivos vinculados');
                    console.log('3. Toca "Vincular dispositivo"');
                    console.log('4. En lugar de escanear, elige "Vincular con número"');
                    console.log('5. Ingresa este código tal como aparece');
                    console.log('====================================\n');
                    
                    guardarLogLocal(`Código generado para ${CONFIG.numero_telefono}`);
                } catch (error) {
                    console.error('❌ Error al solicitar código:', error.message);
                }
            }, 1000);
        }

        // Manejar eventos de conexión
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            // Ignorar QR (no lo usamos)
            if (qr) {
                // No hacer nada, no mostramos QR
            }

            if (connection === 'open') {
                console.log('\n====================================');
                console.log('✅ CONECTADO A WHATSAPP');
                console.log('====================================');
                console.log('📱 Bot vinculado correctamente');
                console.log('⏰ Esperando mensajes programados...\n');
                
                // Mostrar información del usuario
                if (sock.user) {
                    console.log(`👤 Conectado como: ${sock.user.id.split(':')[0]}`);
                }
                
                guardarLogLocal('CONEXIÓN EXITOSA');
                
                // Ejecutar una verificación inicial
                setTimeout(() => {
                    procesarMensajes(sock, url_sheets);
                }, 5000);
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error instanceof Boom ? lastDisconnect.error.output.statusCode : 500;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                
                console.log(`❌ Conexión cerrada (código: ${statusCode})`);
                console.log('🔄 Reconectando en 5 segundos...');
                
                if (shouldReconnect) {
                    setTimeout(() => iniciarWhatsApp(), 5000);
                } else {
                    console.log('\n🚫 Sesión cerrada. Para reiniciar:');
                    console.log('rm -rf sesion_whatsapp');
                    console.log('node bot.js\n');
                }
            }
        });

        // Guardar credenciales cuando se actualicen
        sock.ev.on('creds.update', saveCreds);

        // Mensajes recibidos (para debug)
        sock.ev.on('messages.upsert', async (m) => {
            const mensaje = m.messages[0];
            if (mensaje.key && !mensaje.key.fromMe && mensaje.message) {
                const remitente = mensaje.key.remoteJid;
                // Solo mostrar si es mensaje directo (no de grupos para no saturar)
                if (remitente && !remitente.includes('@g.us')) {
                    console.log(`📩 Mensaje privado de: ${remitente.split('@')[0]}`);
                }
            }
        });

        // ============================================
        // PROGRAMAR TAREAS
        // ============================================
        // Ejecutar cada minuto (segundo 0 de cada minuto)
        cron.schedule('0 * * * * *', async () => {
            const ahora = new Date();
            console.log(`\n🕐 Verificando: ${ahora.getHours()}:${ahora.getMinutes().toString().padStart(2,'0')}`);
            await procesarMensajes(sock, url_sheets);
        });

        console.log('\n⏰ Programador iniciado - Revisando cada minuto');
        console.log('📝 Logs guardados en carpeta: logs/\n');

    } catch (error) {
        console.error('❌ Error fatal:', error);
        guardarLogLocal(`ERROR FATAL: ${error.message}`);
        console.log('\n🔄 Reiniciando en 10 segundos...');
        setTimeout(() => iniciarWhatsApp(), 10000);
    }
}

// ============================================
// MANEJAR CIERRE DEL PROGRAMA
// ============================================
process.on('SIGINT', () => {
    console.log('\n\n👋 Cerrando bot...');
    guardarLogLocal('BOT CERRADO MANUALMENTE');
    process.exit(0);
});

// ============================================
// INICIAR EL BOT
// ============================================
console.log('====================================');
console.log('🚀 SISTEMA DE MENSAJES WHATSAPP');
console.log('====================================');
console.log('Iniciando...\n');

iniciarWhatsApp().catch(error => {
    console.error('❌ Error fatal al iniciar:', error);
    guardarLogLocal(`ERROR FATAL AL INICIAR: ${error.message}`);
});
