// ============================================================================
// asistente_db - Asistente virtual (Trabajo Final, Fase 3).
//
// IDEMPOTENTE: se ejecuta solo al crear el volumen (montado como
// /docker-entrypoint-initdb.d/z-asistente.js, despues de init-mongo.js) y
// tambien a mano sobre un volumen que ya existe:
//
//   npm run infra:asistente
//
// Crea la base con su propio usuario y agrega la plantilla de notificacion del
// escalamiento. Las colecciones, los indices y los datos iniciales (intenciones
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

// Aviso a operaciones cuando alguien pide hablar con un asesor. Sin destinatario
// en el evento, notificaciones lo envia a CORREO_OPERACIONES.
const notificaciones = db.getSiblingDB('notificaciones_db');
notificaciones.plantillas.updateOne(
  { clave: 'asistente.escalamiento' },
  {
    $setOnInsert: {
      clave: 'asistente.escalamiento',
      canal: 'email',
      asunto: 'Nueva solicitud de asesor {{ticket}}',
      cuerpo:
        'Un cliente pidio hablar con un asesor desde el asistente virtual. Ticket: {{ticket}}. Contacto: {{contacto}}. Conversacion: {{conversacion_id}}.',
      activo: true
    }
  },
  { upsert: true }
);
print('notificaciones_db: plantilla asistente.escalamiento lista');
