import { createLocalRepositories } from "./local";
import type { Repositories } from "./types";

/**
 * Único punto de creación de la capa de datos.
 * Para migrar a un servidor (Go/PocketBase) basta con devolver aquí otra
 * implementación de las mismas interfaces: la UI no cambia.
 */
export const repos: Repositories = createLocalRepositories();
export type { Repositories };
