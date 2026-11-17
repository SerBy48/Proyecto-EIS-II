/**
 * Departamentos de Colombia (y Bogota D.C., que es distrito capital). Es la
 * unica lista: la web la lee de GET /api/clientes/departamentos para su
 * selector y el servicio valida contra ella al guardar una direccion.
 */
export const DEPARTAMENTOS = [
  'Amazonas', 'Antioquia', 'Arauca', 'Atlántico', 'Bogotá D.C.', 'Bolívar', 'Boyacá', 'Caldas', 'Caquetá',
  'Casanare', 'Cauca', 'Cesar', 'Chocó', 'Córdoba', 'Cundinamarca', 'Guainía', 'Guaviare', 'Huila', 'La Guajira',
  'Magdalena', 'Meta', 'Nariño', 'Norte de Santander', 'Putumayo', 'Quindío', 'Risaralda',
  'San Andrés y Providencia', 'Santander', 'Sucre', 'Tolima', 'Valle del Cauca', 'Vaupés', 'Vichada'
] as const;

const clave = (texto: string) =>
  texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');

const PORCLAVE = new Map(DEPARTAMENTOS.map((d) => [clave(d), d]));

/** El nombre oficial del departamento ("bogota dc" -> "Bogotá D.C."), o null si no existe. */
export const departamentoOficial = (texto: string): string | null => PORCLAVE.get(clave(texto)) ?? null;
