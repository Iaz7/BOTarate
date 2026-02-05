import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import es from './locales/es.json';
import eu from './locales/eu.json';

// Idiomas disponibles
export const AVAILABLE_LANGUAGES = [
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'es', name: 'Spanish', nativeName: 'Español' },
    { code: 'eu', name: 'Basque', nativeName: 'Euskara' },
] as const;

export type LanguageCode = typeof AVAILABLE_LANGUAGES[number]['code'];

// Mapa de idiomas para el LLM (nombres completos que el modelo entiende)
export const LLM_LANGUAGE_NAMES: Record<LanguageCode, string> = {
    en: 'English',
    es: 'Spanish',
    eu: 'Basque (Euskara)',
};

// Función para obtener el idioma guardado de forma síncrona desde storage
const getSavedLanguage = async (): Promise<LanguageCode> => {
    try {
        const result = await chrome.storage.local.get(['botarate_language']);
        if (result.botarate_language && ['en', 'es', 'eu'].includes(result.botarate_language)) {
            console.log('[i18n] Found saved language:', result.botarate_language);
            return result.botarate_language as LanguageCode;
        }
    } catch (error) {
        console.warn('[i18n] Error loading language from storage:', error);
    }
    console.log('[i18n] No saved language, using fallback: en');
    return 'en';
};

// Inicializar i18next con el idioma guardado
const initializeI18n = async () => {
    const savedLang = await getSavedLanguage();

    await i18n
        .use(initReactI18next)
        .init({
            resources: {
                en: { translation: en },
                es: { translation: es },
                eu: { translation: eu },
            },
            lng: savedLang, // Usar el idioma guardado directamente
            fallbackLng: 'en',
            supportedLngs: ['en', 'es', 'eu'],
            interpolation: {
                escapeValue: false, // React ya escapa por defecto
            },
            react: {
                useSuspense: false, // No usar Suspense en extensiones de Chrome
            },
        });

    console.log('[i18n] Initialized with language:', i18n.language);
};

// Exportar promesa de inicialización para que los componentes puedan esperar
export const i18nInitialized = initializeI18n();

// Escuchar cambios en storage para sincronizar pestañas/ventanas
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.botarate_language) {
        const newLang = changes.botarate_language.newValue;
        if (newLang && newLang !== i18n.language) {
            i18n.changeLanguage(newLang);
        }
    }
});

// Helper para cambiar idioma y persistir
export const changeLanguage = async (lng: LanguageCode): Promise<void> => {
    await i18n.changeLanguage(lng);

    try {
        await chrome.storage.local.set({ botarate_language: lng });
    } catch (error) {
        console.warn('Error saving language to storage:', error);
    }

    // Notificar al background script del cambio de idioma
    try {
        await chrome.runtime.sendMessage({
            action: 'setLanguage',
            language: lng
        });
    } catch (error) {
        console.warn('No se pudo notificar al background del cambio de idioma:', error);
    }
};

// Obtener idioma actual
export const getCurrentLanguage = (): LanguageCode => {
    return (i18n.language?.split('-')[0] as LanguageCode) || 'en';
};

// Obtener nombre del idioma para el LLM
export const getLLMLanguageName = (): string => {
    return LLM_LANGUAGE_NAMES[getCurrentLanguage()];
};

export default i18n;
