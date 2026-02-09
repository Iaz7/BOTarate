/**
 * Constantes globales de la extensión
 */

export const APP_CONFIG = {
    /** Extension Name */
    NAME: 'BOTarate',

    /** Extension Version */
    VERSION: '1.0.0',

    /** Descripción de la extensión */
    DESCRIPTION: 'AI powered extensión for teaching and learning support',

    /** Development mode flag */
    IS_DEV: import.meta.env.DEV,
} as const;
