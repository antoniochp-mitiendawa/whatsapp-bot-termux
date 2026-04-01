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
const { makeInMemoryStore } = require('baileys-store');

// NOTA: El store está desactivado por problemas de compatibilidad
// const { makeInMemoryStore } = require('baileys-store');

// ============================================
// CONFIGURACIÓN
@@ -62,23 +61,23 @@
}

// ============================================
// INICIALIZAR DATA STORE
// INICIALIZAR DATA STORE (DESACTIVADO)
// ============================================
console.log('📚 Inicializando Data Store...');
const store = makeInMemoryStore({
    logger: pino({ level: 'silent' }).child({ stream: 'store' })
});
// console.log('📚 Inicializando Data Store...');
// const store = makeInMemoryStore({
//     logger: pino({ level: 'silent' }).child({ stream: 'store' })
// });

// Si ya existe un archivo del store, lo cargamos
if (fs.existsSync(CONFIG.archivo_store)) {
    store.readFromFile(CONFIG.archivo_store);
    console.log('📚 Data Store cargado desde archivo.');
}
// // Si ya existe un archivo del store, lo cargamos
// if (fs.existsSync(CONFIG.archivo_store)) {
//     store.readFromFile(CONFIG.archivo_store);
//     console.log('📚 Data Store cargado desde archivo.');
// }

// Guardar el store cada 10 segundos
setInterval(() => {
    store.writeToFile(CONFIG.archivo_store);
}, 10_000);
// // Guardar el store cada 10 segundos
// setInterval(() => {
//     store.writeToFile(CONFIG.archivo_store);
// }, 10_000);

// ============================================
// CACHE DE GRUPOS
@@ -233,58 +232,12 @@
}

// ============================================
// FUNCIÓN PARA LIMPIAR STORE ANTIGUO
// FUNCIÓN PARA LIMPIAR STORE ANTIGUO (DESACTIVADA)
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
    // Esta función está desactivada porque el store no se usa
    guardarLogLocal('🧹 Limpieza de store desactivada (store no disponible)');
    return false;
}

// ============================================
@@ -1112,81 +1065,18 @@
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
        
        // El store está desactivado, usamos solo los grupos obtenidos por eventos
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
                
            if (sock) {
let nombreGrupo = 'Sin nombre';

if (groupCache.has(id)) {
const metadata = groupCache.get(id);
if (metadata && metadata.subject) {
nombreGrupo = metadata.subject;
                        guardarLogLocal(`   📦 Nombre obtenido del CACHÉ (evento): ${nombreGrupo}`);
                        guardarLogLocal(`   📦 Nombre obtenido del CACHÉ: ${nombreGrupo}`);
}
}

@@ -1431,7 +1321,7 @@
keepAliveIntervalMs: 25000
});

        store.bind(sock.ev);
        // store.bind(sock.ev); // DESACTIVADO

sock.ev.on('groups.update', async (updates) => {
for (const update of updates) {
@@ -1683,7 +1573,7 @@
console.log('\n\n👋 Cerrando bot...');
guardarLogLocal('BOT CERRADO MANUALMENTE');
limpiarCacheImagenes();
    store.writeToFile(CONFIG.archivo_store);
    // store.writeToFile(CONFIG.archivo_store); // DESACTIVADO
process.exit(0);
});
