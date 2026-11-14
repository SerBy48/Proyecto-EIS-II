/**
 * Envoltura para controladores async.
 * Sin esto, una promesa rechazada dentro de un handler de Express no llega al
 * middleware de errores y la peticion queda colgada.
 */
import { NextFunction, Request, Response } from 'express';

export const asincrono = <R extends Request = Request>(
  manejador: (req: R, res: Response, next: NextFunction) => Promise<unknown>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    void manejador(req as R, res, next).catch(next);
  };
};

/** Valida que los campos requeridos esten presentes y no vacios. */
export const exigirCampos = (
  cuerpo: Record<string, unknown>,
  campos: string[]
): string[] => {
  return campos.filter((campo) => {
    const valor = cuerpo?.[campo];
    return valor === undefined || valor === null || valor === '';
  });
};

/** Convierte un valor a entero positivo o devuelve undefined. */
export const enteroPositivo = (valor: unknown): number | undefined => {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : undefined;
};
