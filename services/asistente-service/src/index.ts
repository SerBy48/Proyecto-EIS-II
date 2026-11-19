import 'dotenv/config';
import { Application, Router } from 'express';
import { BusEventos, asincrono, crearServicio, requiereRol } from '@ecommerce/shared';
import { metricasAdaptadores } from './adaptadores';
import { crearControladorConsultas } from './consultas';
import { crearControlador, identidadOpcional } from './controlador';
import { cliente, conectarMongo, verificarMongo } from './db';
import { iaActiva } from './ia';

/**
 * Asistente virtual (Trabajo Final, Fase 3; docs/adr/0007).
 * Base de datos propia: asistente_db (MongoDB): conversaciones, faq, tickets e
 * intenciones.
 *
 * Motor de reglas determinista; IA opcional apagada por defecto. Si este
 * servicio cae, la tienda sigue funcionando: nada depende de el.
 */
const bus = new BusEventos('asistente-service');
const controlador = crearControlador();
const consultas = crearControladorConsultas(bus);

const rutas = (app: Application): void => {
  const router = Router();

  // Publica (con identidad opcional): visitantes y clientes.
  router.post('/mensajes', identidadOpcional, asincrono(controlador.enviarMensaje));

  router.get('/conversaciones/:id', requiereRol(), asincrono(controlador.obtenerConversacion));
  router.get('/tickets', requiereRol('administrador', 'vendedor'), asincrono(controlador.listarTickets));

  // Consultas al vendedor (RF-53): el cliente las crea desde el chat; el
  // personal responde desde el panel. Autorizacion por dato en el controlador.
  router.post('/consultas', requiereRol('cliente'), asincrono(consultas.crearConsulta));
  router.get('/consultas', requiereRol('cliente', 'administrador', 'vendedor'), asincrono(consultas.listarConsultas));
  router.get('/consultas/:numero', requiereRol('cliente', 'administrador', 'vendedor'), asincrono(consultas.obtenerConsulta));
  router.post('/consultas/:numero/mensajes', requiereRol('cliente', 'administrador', 'vendedor'), asincrono(consultas.responderConsulta));
  router.patch('/consultas/:numero', requiereRol('administrador', 'vendedor'), asincrono(consultas.cambiarEstadoConsulta));

  // Edicion de las reglas sin desplegar.
  router.get('/intenciones', requiereRol('administrador'), asincrono(controlador.listarIntenciones));
  router.patch('/intenciones/:clave', requiereRol('administrador'), asincrono(controlador.actualizarIntencion));
  router.get('/faq', requiereRol('administrador'), asincrono(controlador.listarFaq));
  router.patch('/faq/:clave', requiereRol('administrador'), asincrono(controlador.actualizarFaq));

  app.use('/', router);
};

void crearServicio({
  nombre: 'asistente-service',
  puerto: Number(process.env.PORT || 3009),
  rutas,
  dependencias: [
    { nombre: 'mongo:asistente_db', verificar: verificarMongo },
    // No critica: sin broker, el ticket se registra igual y solo falta el aviso.
    { nombre: 'rabbitmq', verificar: async () => bus.conectado, critica: false }
  ],
  metricas: () => ({ ia: iaActiva() ? 'anthropic' : 'desactivada', ...metricasAdaptadores() }),
  alIniciar: async () => {
    await conectarMongo();
    await bus.conectar().catch(() => undefined);
  },
  alDetener: async () => {
    await bus.cerrar();
    await cliente.close();
  }
});
