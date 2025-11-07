import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import ChatSidebar from "../components/ChatSidebar";
import ExerciseModal from "../components/ExerciseModal";
import LoadingMessage from "../components/LoadingMessage";
import NoExercisesMessage from "../components/NoExercisesMessage";
import { ConfigManager } from "../util/config/ConfigManager";
import { Course } from "../util/egela/Course";
// @ts-ignore: allow importing CSS as a side-effect in this content script
import "./bootstrap.css";

const PAGE_VIEW_HREF = "https://egela.ehu.eus/mod/page/view.php";

interface Exercise {
    name: string;
    statement: string;
}

type ViewState = "loading" | "no-exercises" | "chat" | "hidden";

const ExtensionContent: React.FC = () => {
    const [viewState, setViewState] = useState<ViewState>("chat");
    const [course, setCourse] = useState<Course | null>(null);
    const [courseName, setCourseName] = useState<string>("Cargando...");
    const [providerName, setProviderName] = useState<string>("");
    const [modelName, setModelName] = useState<string>("");
    const [exercises, setExercises] = useState<Exercise[]>([]);
    const [dbSchema, setDbSchema] = useState<string | undefined>(undefined);
    const [sqlInstructions, setSqlInstructions] = useState<string[] | undefined>(undefined);
    const [learningObjectives, setLearningObjectives] = useState<string | undefined>(undefined);
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [selectedExerciseIndex, setSelectedExerciseIndex] = useState<number>(0);
    const [currentPageId, setCurrentPageId] = useState<string | null>(null);
    const [isLoadingExercises, setIsLoadingExercises] = useState<boolean>(false);
    const [modalLoadFromCache, setModalLoadFromCache] = useState<boolean>(false);
    const [reloadExplanationsKey, setReloadExplanationsKey] = useState<number>(0);

    useEffect(() => {
        const waitForSessionStorage = (timeoutMs: number = 5000, intervalMs: number = 200) => {
            return new Promise<void>(resolve => {
                const start = Date.now();
                console.log("[content] Iniciando espera de sessionStorage...");
                const check = () => {
                    const elapsed = Date.now() - start;
                    const keysCount = sessionStorage.length;

                    // Esperar hasta que haya más de 1 clave O se alcance el timeout
                    if (keysCount > 1) {
                        console.log(`[content] SessionStorage listo con ${keysCount} claves`);
                        resolve();
                    } else if (elapsed >= timeoutMs) {
                        console.warn(`[content] Timeout alcanzado (${timeoutMs}ms) con ${keysCount} claves`);
                        resolve();
                    } else {
                        setTimeout(check, intervalMs);
                    }
                };
                check();
            });
        };

        const loadCourseData = async () => {
            // Esperar a que sessionStorage tenga datos (más de 1 clave)
            await waitForSessionStorage(10000, 100);

            try {
                console.log(`[content] Serializando sessionStorage con ${sessionStorage.length} claves`);

                // Serializar sessionStorage completo a un objeto (después de esperar a que esté disponible)
                const sessionStorageData: Record<string, string> = {};
                for (let i = 0; i < sessionStorage.length; i++) {
                    const key = sessionStorage.key(i);
                    if (key) {
                        sessionStorageData[key] = sessionStorage.getItem(key) || "";
                    }
                }

                console.log(`[content] Claves de sessionStorage:`, Object.keys(sessionStorageData));

                // Enviar href y sessionStorage al background
                const response = await chrome.runtime.sendMessage({
                    action: "getCourseData",
                    href: globalThis.location.href,
                    sessionStorageData: sessionStorageData,
                });

                if (response.success && response.course) {
                    setCourse(response.course);

                    // Obtener el nombre del curso desde la página
                    const courseTitle =
                        document.querySelector(".page-header-headings h1")?.textContent || "Curso sin nombre";
                    setCourseName(courseTitle);

                    console.log("[content] Datos del curso cargados:", response.course);

                    // Detectar si estamos en una página de ejercicios
                    if (globalThis.location.href.includes(PAGE_VIEW_HREF)) {
                        const urlParams = new URLSearchParams(globalThis.location.search);
                        const pageId = urlParams.get("id");

                        if (pageId) {
                            console.log(`[content] Detectada página de Egela, ID: ${pageId}`);
                            setCurrentPageId(pageId);
                            setViewState("chat"); // Abrir el chat en lugar del loading
                            setIsLoadingExercises(true); // Activar el estado de carga
                            await identifyExercisesInPage(pageId);
                        }
                    }
                } else {
                    console.error("[content] No se pudo cargar el curso:", response.error);
                    setCourseName("Error al cargar curso");
                }
            } catch (error) {
                console.error("[content] Error loading course data:", error);
                setCourseName("Error al cargar curso");
            }
        };

        const loadConfig = async () => {
            try {
                await ConfigManager.loadConfig();
                const provider = ConfigManager.getSelectedProvider();
                const model = ConfigManager.getSelectedModel();
                setProviderName(provider.name);
                setModelName(model || "No seleccionado");
            } catch (error) {
                console.error("[content] Error loading config:", error);
            }
        };

        // Listener para mensajes del background (para abrir el modal)
        const messageListener = (message: any) => {
            if (message.action === "openExerciseModal") {
                console.log("[content] Recibido mensaje para abrir modal del ejercicio:", message.exerciseIndex);
                handleOpenExerciseModal(message.exerciseIndex);
            }
        };

        chrome.runtime.onMessage.addListener(messageListener);

        loadCourseData();
        loadConfig();

        // Cleanup
        return () => {
            chrome.runtime.onMessage.removeListener(messageListener);
        };
    }, []);

    const identifyExercisesInPage = async (pageId: string) => {
        try {
            // Extraer el resourceId de la URL (parámetro 'id' es el resourceId en páginas de Egela)
            const urlParams = new URLSearchParams(globalThis.location.search);
            const resourceId = urlParams.get("id"); // El ID del recurso (página) actual

            console.log("[content] Enviando solicitud para identificar ejercicios...");
            console.log("[content] PageId:", pageId, "ResourceId:", resourceId);

            const response = await chrome.runtime.sendMessage({
                action: "getExerciseList",
                pageId: pageId,
                resourceId: resourceId || undefined,
            });

            if (response.success) {
                console.log(
                    `[content] Se han identificado ${response.exercises.length} ejercicios:`,
                    response.exercises
                );
                if (response.db_schema) {
                    setDbSchema(response.db_schema);
                } else {
                    setDbSchema(undefined);
                }

                if (response.sql_instructions) {
                    setSqlInstructions(response.sql_instructions);
                    console.log("[content] Instrucciones SQL:", response.sql_instructions);
                } else {
                    setSqlInstructions(undefined);
                }

                if (response.learning_objectives) {
                    setLearningObjectives(response.learning_objectives);
                    console.log("[content] Objetivos de aprendizaje:", response.learning_objectives);
                } else {
                    setLearningObjectives(undefined);
                }

                if (response.exercises.length > 0) {
                    setExercises(response.exercises);
                } else {
                    setViewState("no-exercises");
                }
            } else {
                console.error("[content] Error al identificar ejercicios:", response.error);
                setViewState("chat");
            }
        } catch (error) {
            console.error("[content] Error al solicitar identificación de ejercicios:", error);
            setViewState("chat");
        } finally {
            setIsLoadingExercises(false); // Desactivar el estado de carga
        }
    };

    const handleCloseExtension = () => {
        setViewState("hidden");
    };

    const handleNoExercisesTimeout = () => {
        setViewState("chat");
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
    };

    const handleOpenExerciseModal = (exerciseIndex: number, fromCache: boolean = false) => {
        setSelectedExerciseIndex(exerciseIndex);
        setModalLoadFromCache(fromCache);
        setIsModalOpen(true);
    };

    const handleOpenExplanationFromCache = async (exerciseName: string) => {
        // Buscar el ejercicio por nombre
        const exerciseIndex = exercises.findIndex(ex => ex.name === exerciseName);

        if (exerciseIndex >= 0) {
            // Si encontramos el ejercicio, abrir el modal con ese ejercicio y carga del cache
            handleOpenExerciseModal(exerciseIndex, true);
        } else {
            console.warn(`[content] No se encontró el ejercicio: ${exerciseName}`);
        }
    };

    const handleExplanationGenerated = () => {
        // Incrementar el trigger para forzar recarga en ChatSidebar
        setReloadExplanationsKey(prev => prev + 1);
    };

    // No mostrar nada si está oculto o si no hay curso
    if (viewState === "hidden" || !course) return null;

    // Renderizar según el estado
    return (
        <>
            {viewState === "loading" && <LoadingMessage />}

            {viewState === "no-exercises" && (
                <NoExercisesMessage onTimeout={handleNoExercisesTimeout} duration={3000} />
            )}

            {/* El chat siempre se muestra si el estado es "chat" */}
            {viewState === "chat" && (
                <ChatSidebar
                    courseName={courseName}
                    providerName={providerName}
                    modelName={modelName}
                    onClose={handleCloseExtension}
                    isLoadingExercises={isLoadingExercises}
                    pageId={currentPageId || undefined}
                    onOpenExplanation={handleOpenExplanationFromCache}
                    onExplanationGenerated={handleExplanationGenerated}
                    key={reloadExplanationsKey} // Re-renderizar cuando cambie el trigger
                />
            )}

            {/* El modal se muestra sobre el chat cuando se selecciona un ejercicio */}
            {isModalOpen && exercises.length > 0 && (
                <ExerciseModal
                    exercise={exercises[selectedExerciseIndex]}
                    dbSchema={dbSchema}
                    sqlInstructions={sqlInstructions}
                    learningObjectives={learningObjectives}
                    isOpen={isModalOpen}
                    onClose={handleCloseModal}
                    pageId={currentPageId || undefined}
                    loadFromCache={modalLoadFromCache}
                    onExplanationGenerated={handleExplanationGenerated}
                />
            )}
        </>
    );
};

// Componente principal que maneja la inyección
const ContentApp: React.FC = () => {
    useEffect(() => {
        console.log("Extensión de Chrome cargada en:", globalThis.location.href);

        return () => {
            console.log("Extensión de Chrome descargada");
        };
    }, []);

    return <ExtensionContent />;
};

// Crear el punto de montaje para la extensión
const mountPoint = document.createElement("div");
mountPoint.id = "chrome-extension-react-root";
document.body.appendChild(mountPoint);

// Renderizar la extensión usando React 18
const root = createRoot(mountPoint);
root.render(<ContentApp />);
