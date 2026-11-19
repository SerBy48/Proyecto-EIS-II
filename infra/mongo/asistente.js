// ============================================================================
// asistente_db - Asistente virtual (Trabajo Final, Fase 3).
//
// IDEMPOTENTE: se ejecuta solo al crear el volumen (montado como
// /docker-entrypoint-initdb.d/z-asistente.js, despues de init-mongo.js) y
// tambien a mano sobre un volumen que ya existe:
//
//   npm run infra:asistente
//
// Crea la base con su propio usuario. Las colecciones, los indices y los datos iniciales (intenciones
// y preguntas frecuentes) los prepara el propio servicio al arrancar: viven
// versionados en services/asistente-service/src/datos/.
// ============================================================================

const asistente = db.getSiblingDB('asistente_db');
if (!asistente.getUser('asistente_user')) {
  asistente.createUser({
    user: 'asistente_user',
    pwd: 'asistente_pass',
    roles: [{ role: 'readWrite', db: 'asistente_db' }]
  });
  print('asistente_db: usuario creado');
} else {
  print('asistente_db: el usuario ya existia');
}

// La plantilla asistente.escalamiento (F3) avisaba al personal cuando un
// visitante pedia un asesor; ese aviso no tenia cliente a quien responder y se
// retiro en F5e: ahora el chat pide iniciar sesion. Se borra de los volumenes
// creados antes.
const notificaciones = db.getSiblingDB('notificaciones_db');
notificaciones.plantillas.deleteOne({ clave: 'asistente.escalamiento' });
