/**
 * Utilidades de i18n para el background script (sin React).
 * Maneja la persistencia del idioma y proporciona traducciones para el backend.
 */

import en from './locales/en.json';
import es from './locales/es.json';
import eu from './locales/eu.json';

export type LanguageCode = 'en' | 'es' | 'eu';

const translations: Record<LanguageCode, typeof es> = {
    en,
    es,
    eu,
};

// Idioma actual en memoria (se sincroniza con storage)
let currentLanguage: LanguageCode = 'es';

// Mapa de idiomas para el LLM (nombres completos que el modelo entiende)
export const LLM_LANGUAGE_NAMES: Record<LanguageCode, string> = {
    en: 'English',
    es: 'Spanish',
    eu: 'Basque (Euskara)',
};

// Instrucciones de idioma para incluir en los prompts del LLM
export const LLM_LANGUAGE_INSTRUCTIONS: Record<LanguageCode, string> = {
    en: 'You MUST respond in English. All your responses, explanations, and feedback must be in English.',
    es: 'DEBES responder en español. Todas tus respuestas, explicaciones y retroalimentación deben estar en español.',
    eu: 'Euskaraz erantzun BEHAR duzu. Zure erantzun, azalpen eta feedback guztiak euskaraz egon behar dira.',
};

/**
 * Inicializa el idioma desde chrome.storage
 */
export async function initLanguage(): Promise<void> {
    try {
        const result = await chrome.storage.local.get('botarate_language');
        if (result.botarate_language && isValidLanguage(result.botarate_language)) {
            currentLanguage = result.botarate_language;
        }
    } catch (error) {
        console.warn('Error loading language from storage:', error);
    }
}

/**
 * Establece el idioma actual y lo guarda en storage
 */
export async function setLanguage(lang: LanguageCode): Promise<void> {
    if (!isValidLanguage(lang)) {
        console.warn(`Invalid language code: ${lang}`);
        return;
    }
    currentLanguage = lang;
    try {
        await chrome.storage.local.set({ botarate_language: lang });
    } catch (error) {
        console.warn('Error saving language to storage:', error);
    }

    // Notificar a todas las pestañas activas del cambio de idioma
    try {
        const tabs = await chrome.tabs.query({});
        for (const tab of tabs) {
            if (tab.id) {
                try {
                    await chrome.tabs.sendMessage(tab.id, {
                        action: 'languageChanged',
                        language: lang
                    });
                } catch (error) {
                    // Ignorar errores de pestañas que no tienen el content script
                }
            }
        }
    } catch (error) {
        console.warn('Error notifying tabs of language change:', error);
    }
}

/**
 * Obtiene el idioma actual
 */
export function getLanguage(): LanguageCode {
    return currentLanguage;
}

/**
 * Obtiene el nombre del idioma para el LLM
 */
export function getLLMLanguageName(): string {
    return LLM_LANGUAGE_NAMES[currentLanguage];
}

/**
 * Obtiene la instrucción de idioma para incluir en prompts del LLM
 */
export function getLLMLanguageInstruction(): string {
    return LLM_LANGUAGE_INSTRUCTIONS[currentLanguage];
}

/**
 * Verifica si un código de idioma es válido
 */
function isValidLanguage(lang: string): lang is LanguageCode {
    return ['en', 'es', 'eu'].includes(lang);
}

/**
 * Obtiene una traducción por clave (soporta claves anidadas con punto)
 * Ejemplo: t('errors.exerciseBlocked', { exerciseName: 'Ejercicio 1' })
 */
export function t(key: string, params?: Record<string, string>): string {
    const keys = key.split('.');
    let value: any = translations[currentLanguage];

    for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
            value = value[k];
        } else {
            // Fallback a español si no se encuentra
            value = translations['es'];
            for (const fallbackKey of keys) {
                if (value && typeof value === 'object' && fallbackKey in value) {
                    value = value[fallbackKey];
                } else {
                    return key; // Devolver la clave si no se encuentra
                }
            }
            break;
        }
    }

    if (typeof value !== 'string') {
        return key;
    }

    // Reemplazar parámetros {{param}}
    if (params) {
        return value.replace(/\{\{(\w+)\}\}/g, (_, paramName) => {
            return params[paramName] ?? `{{${paramName}}}`;
        });
    }

    return value;
}
