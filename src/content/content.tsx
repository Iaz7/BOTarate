import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

import ChatSidebar from '../components/ChatSidebar';
import ExerciseList from '../components/ExerciseList';
import LoadingMessage from '../components/LoadingMessage';
import NoExercisesMessage from '../components/NoExercisesMessage';
import { ConfigManager } from '../util/config/ConfigManager';
import { Course } from '../util/egela/Course';
// @ts-ignore: allow importing CSS as a side-effect in this content script
import "./bootstrap.css";

const PAGE_VIEW_HREF = "https://egela.ehu.eus/mod/page/view.php";

interface Exercise {
    name: string;
    statement: string;
}

type ViewState = 'loading' | 'exercises' | 'no-exercises' | 'chat' | 'hidden';

const ExtensionContent: React.FC = () => {
    const [viewState, setViewState] = useState<ViewState>('chat');
    const [course, setCourse] = useState<Course | null>(null);
    const [courseName, setCourseName] = useState<string>('Cargando...');
    const [providerName, setProviderName] = useState<string>('');
    const [modelName, setModelName] = useState<string>('');
    const [exercises, setExercises] = useState<Exercise[]>([]);

    useEffect(() => {
        const loadCourseData = async () => {
            try {
                // Serializar sessionStorage completo a un objeto
                const sessionStorageData: Record<string, string> = {};
                for (let i = 0; i < sessionStorage.length; i++) {
                    const key = sessionStorage.key(i);
                    if (key) {
                        sessionStorageData[key] = sessionStorage.getItem(key) || '';
                    }
                }

                // Enviar href y sessionStorage al background
                const response = await chrome.runtime.sendMessage({ 
                    action: "getCourseData",
                    href: globalThis.location.href,
                    sessionStorageData: sessionStorageData
                });

                if (response.success && response.course) {
                    setCourse(response.course);
                    
                    // Obtener el nombre del curso desde la página
                    const courseTitle = document.querySelector('.page-header-headings h1')?.textContent || 'Curso sin nombre';
                    setCourseName(courseTitle);
                    
                    console.log('[content] Datos del curso cargados:', response.course);

                    // Detectar si estamos en una página de ejercicios
                    if (globalThis.location.href.includes(PAGE_VIEW_HREF)) {
                        const urlParams = new URLSearchParams(globalThis.location.search);
                        const pageId = urlParams.get('id');
                        
                        if (pageId) {
                            console.log(`[content] Detectada página de Egela, ID: ${pageId}`);
                            setViewState('loading');
                            await identifyExercisesInPage(pageId);
                        }
                    }
                } else {
                    console.error('[content] No se pudo cargar el curso:', response.error);
                    setCourseName('Error al cargar curso');
                }

            } catch (error) {
                console.error('[content] Error loading course data:', error);
                setCourseName('Error al cargar curso');
            }
        };

        const loadConfig = async () => {
            try {
                await ConfigManager.loadConfig();
                const provider = ConfigManager.getSelectedProvider();
                const model = ConfigManager.getSelectedModel();
                setProviderName(provider.name);
                setModelName(model || 'No seleccionado');
            } catch (error) {
                console.error('[content] Error loading config:', error);
            }
        };

        loadCourseData();
        loadConfig();
    }, []);

    const identifyExercisesInPage = async (pageId: string) => {
        try {
            console.log('[content] Enviando solicitud para identificar ejercicios...');
            const response = await chrome.runtime.sendMessage({ 
                action: "getExerciseList",
                pageId: pageId
            });

            if (response.success) {
                console.log(`[content] Se han identificado ${response.exercises.length} ejercicios:`, response.exercises);
                
                if (response.exercises.length > 0) {
                    setExercises(response.exercises);
                    setViewState('exercises');
                } else {
                    setViewState('no-exercises');
                }
            } else {
                console.error('[content] Error al identificar ejercicios:', response.error);
                setViewState('chat');
            }
        } catch (error) {
            console.error('[content] Error al solicitar identificación de ejercicios:', error);
            setViewState('chat');
        }
    };

    const handleCloseExtension = () => {
        setViewState('hidden');
    };

    const handleNoExercisesTimeout = () => {
        setViewState('chat');
    };

    // No mostrar nada si está oculto o si no hay curso
    if (viewState === 'hidden' || !course) return null;

    // Renderizar según el estado
    switch (viewState) {
        case 'loading':
            return <LoadingMessage />;
        
        case 'exercises':
            return (
                <ExerciseList 
                    exercises={exercises}
                    onClose={handleCloseExtension}
                />
            );
        
        case 'no-exercises':
            return (
                <NoExercisesMessage 
                    onTimeout={handleNoExercisesTimeout}
                    duration={3000}
                />
            );
        
        case 'chat':
        default:
            return (
                <ChatSidebar
                    courseName={courseName}
                    providerName={providerName}
                    modelName={modelName}
                    onClose={handleCloseExtension}
                />
            );
    }
};

// Componente principal que maneja la inyección
const ContentApp: React.FC = () => {
    useEffect(() => {
        console.log('Extensión de Chrome cargada en:', globalThis.location.href);

        return () => {
            console.log('Extensión de Chrome descargada');
        };
    }, []);

    return <ExtensionContent />;
};

// Crear el punto de montaje para la extensión
const mountPoint = document.createElement('div');
mountPoint.id = 'chrome-extension-react-root';
document.body.appendChild(mountPoint);

// Renderizar la extensión usando React 18
const root = createRoot(mountPoint);
root.render(<ContentApp />);