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
    en: 'CRITICAL - LANGUAGE REQUIREMENT: You MUST respond EXCLUSIVELY in English. ALL your text, including responses, explanations, feedback, error messages, and any other output MUST be in English. NEVER use Spanish, Basque, or any other language in your responses, regardless of the language used in the prompt, context, or previous messages. If you encounter content in other languages, translate your response to English.',
    es: 'CRÍTICO - REQUISITO DE IDIOMA: DEBES responder EXCLUSIVAMENTE en español. TODO tu texto, incluyendo respuestas, explicaciones, retroalimentación, mensajes de error y cualquier otra salida DEBE estar en español. NUNCA uses inglés, euskera u otro idioma en tus respuestas, independientemente del idioma usado en el prompt, contexto o mensajes anteriores. Si encuentras contenido en otros idiomas, traduce tu respuesta al español.',
    eu: 'KRITIKOA - HIZKUNTZAREN BALDINTZA: Euskaraz SOILIK erantzun BEHAR duzu. Zure testu GUZTIA, erantzunak, azalpenak, feedbacka, errore mezuak eta beste edozein irteera euskaraz egon BEHAR dira. INOIZ EZ erabili gaztelania, ingelesa edo beste hizkuntzarik zure erantzunetan, promptean, testuan edo aurreko mezuetan erabilitako hizkuntzak edozein izanda ere. Beste hizkuntzetan edukia aurkitzen baduzu, euskarara itzuli zure erantzuna.',
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
 * Obtiene las instrucciones de formato de respuesta para ejercicios (explainExercise/solveExercise)
 * en el idioma actual configurado
 */
export function getLLMExerciseResponseInstructions(): string {
    const instructions: Record<LanguageCode, string> = {
        en: `RESPONSE FORMAT:
In the following cases, respond as follows:
- If you call explainExercise, just respond with: "I have opened the explanation for exercise {exercise name} for you."
- If you call solveExercise, just respond with: "I have opened the solution form for exercise {exercise name}."
- If you do not need to use any tool, respond normally.`,
        es: `FORMATO DE RESPUESTA:
En los siguientes casos, responde así:
- Si llamas a explainExercise, simplemente responde con: "He abierto la explicación del ejercicio {nombre del ejercicio}."
- Si llamas a solveExercise, simplemente responde con: "He abierto el formulario de solución para el ejercicio {nombre del ejercicio}."
- Si no necesitas usar ninguna herramienta, responde normalmente.`,
        eu: `ERANTZUN FORMATUA:
Kasu hauetan, honela erantzun:
- explainExercise deitzen baduzu, erantzun soilik honekin: "{ariketa izena} ariketaren azalpena ireki dut."
- solveExercise deitzen baduzu, erantzun soilik honekin: "{ariketa izena} ariketaren soluzio formularioa ireki dut."
- Tresnarik erabili behar ez baduzu, normalean erantzun.`,
    };
    return instructions[currentLanguage];
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
