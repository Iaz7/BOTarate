import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import ChatSidebar from "../components/ChatSidebar";
import EvaluationListModal from "../components/EvaluationListModal";
import ExerciseModal from "../components/ExerciseModal";
import SolutionModal from "../components/SolutionModal";
import "../i18n"; // Inicializar i18n
import { ConfigManager } from "../util/config/ConfigManager";
import { Course } from "../util/egela/Course";
import { extractPdfTextFromBase64 } from "../util/pdf/PdfExtractor";
// @ts-ignore: allow importing CSS as a side-effect in this content script
import "./bootstrap.css";

const PAGE_VIEW_HREF = "https://egela.ehu.eus/mod/page/view.php";

interface Exercise {
    name: string;
    statement: string;
    allowed?: boolean;
    isTiquismiqui?: boolean;
}

type ViewState = "loading" | "chat" | "hidden";

// Helper para obtener el pageId de la URL actual
const getPageIdFromUrl = (): string | null => {
    if (!globalThis.location.href.includes(PAGE_VIEW_HREF)) {
        return null;
    }
    const urlParams = new URLSearchParams(globalThis.location.search);
    return urlParams.get("id");
};

const ExtensionContent: React.FC = () => {
    const [viewState, setViewState] = useState<ViewState>("chat");
    const [course, setCourse] = useState<Course | null>(null);
    const [courseName, setCourseName] = useState<string>("Cargando...");
    const [courseId, setCourseId] = useState<string | null>(null);
    const [providerName, setProviderName] = useState<string>("");
    const [modelName, setModelName] = useState<string>("");
    const [exercises, setExercises] = useState<Exercise[]>([]);
    const [exerciseContext, setExerciseContext] = useState<string | undefined>(undefined);
    const [concepts, setConcepts] = useState<string[] | undefined>(undefined);
    const [learningObjectives, setLearningObjectives] = useState<string | undefined>(undefined);
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [isSolutionModalOpen, setIsSolutionModalOpen] = useState<boolean>(false);
    const [isEvaluationListModalOpen, setIsEvaluationListModalOpen] = useState<boolean>(false);
    const [selectedExerciseIndex, setSelectedExerciseIndex] = useState<number>(0);
    const [selectedEvaluationExerciseName, setSelectedEvaluationExerciseName] = useState<string>("");
    const [currentPageId, setCurrentPageId] = useState<string | null>(null);
    const [isLoadingExercises, setIsLoadingExercises] = useState<boolean>(false);
    const [modalLoadFromCache, setModalLoadFromCache] = useState<boolean>(false);
    const [reloadExplanationsKey, setReloadExplanationsKey] = useState<number>(0);
    const [reloadEvaluationsKey, setReloadEvaluationsKey] = useState<number>(0);
    const [reloadSidebarKey, setReloadSidebarKey] = useState<number>(0);
    const [pendingModalOpen, setPendingModalOpen] = useState<{ index: number; fromCache: boolean } | null>(null);
    const [pendingSolutionModalOpen, setPendingSolutionModalOpen] = useState<number | null>(null);
    const identifyingExercisesRef = React.useRef<boolean>(false);

    const openExerciseModalForIndex = (exerciseIndex: number, fromCache: boolean): boolean => {
        const exercise = exercises[exerciseIndex];
        if (!exercise) {
            return false;
        }

        setSelectedExerciseIndex(exerciseIndex);
        setModalLoadFromCache(fromCache);
        setIsModalOpen(true);
        return true;
    };

    // Efecto para abrir modales pendientes cuando los ejercicios se cargan
    useEffect(() => {
        if (exercises.length > 0 && pendingModalOpen !== null) {
            console.log("[content] Abriendo modal pendiente, ejercicio:", pendingModalOpen.index);
            openExerciseModalForIndex(pendingModalOpen.index, pendingModalOpen.fromCache);
            setPendingModalOpen(null);
        }

        if (exercises.length > 0 && pendingSolutionModalOpen !== null) {
            console.log("[content] Abriendo modal de solución pendiente, ejercicio:", pendingSolutionModalOpen);
            setSelectedExerciseIndex(pendingSolutionModalOpen);
            setIsSolutionModalOpen(true);
            setPendingSolutionModalOpen(null);
        }
    }, [exercises, pendingModalOpen, pendingSolutionModalOpen, openExerciseModalForIndex]);

    useEffect(() => {
        const waitForSessionStorage = (timeoutMs: number = 5000, intervalMs: number = 200) => {
            return new Promise<void>(resolve => {
                const start = Date.now();
                console.log("[content] Starting wait for sessionStorage...");
                const check = () => {
                    const elapsed = Date.now() - start;
                    const keysCount = sessionStorage.length;

                    // Esperar hasta que haya más de 1 clave O se alcance el timeout
                    if (keysCount > 1) {
                        console.log(`[content] SessionStorage ready with ${keysCount} keys`);
                        resolve();
                    } else if (elapsed >= timeoutMs) {
                        console.warn(`[content] Timeout reached (${timeoutMs}ms) with ${keysCount} keys`);
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
                console.log(`[content] Serializing sessionStorage with ${sessionStorage.length} keys`);

                // Serializar sessionStorage completo a un objeto (después de esperar a que esté disponible)
                const sessionStorageData: Record<string, string> = {};
                for (let i = 0; i < sessionStorage.length; i++) {
                    const key = sessionStorage.key(i);
                    if (key) {
                        sessionStorageData[key] = sessionStorage.getItem(key) || "";
                    }
                }

                console.log(`[content] SessionStorage keys:`, Object.keys(sessionStorageData));

                // Enviar href y sessionStorage al background
                const response = await chrome.runtime.sendMessage({
                    action: "getCourseData",
                    href: globalThis.location.href,
                    sessionStorageData: sessionStorageData,
                });

                if (response.success && response.course) {
                    setCourse(response.course);
                    setCourseId(response.course.id); // Guardar el ID del curso

                    // Obtener el nombre del curso desde la página
                    const courseTitle =
                        document.querySelector(".page-header-headings h1")?.textContent || "Unnamed Course";
                    setCourseName(courseTitle);

                    console.log("[content] Course data loaded:", response.course);

                    // Detectar si estamos en una página de ejercicios
                    const pageId = getPageIdFromUrl();
                    if (pageId) {
                        console.log(`[content] Egela page detected, ID: ${pageId}`);
                        setCurrentPageId(pageId);
                        setViewState("chat");
                        // Cargar ejercicios desde cache al detectar la página
                        await loadExercisesFromCache(pageId);
                    }
                } else {
                    console.log("[content] Could not load course:", response.error);
                    setCourseName("Error loading course");
                }
            } catch (error) {
                console.error("[content] Error loading course data:", error);
                setCourseName("Error loading course");
            }
        };

        const loadConfig = async () => {
            try {
                await ConfigManager.loadConfig();
                const provider = ConfigManager.getSelectedProvider();
                const model = ConfigManager.getSelectedModel();
                setProviderName(provider.name);
                setModelName(model || "Not selected");
            } catch (error) {
                console.error("[content] Error loading config:", error);
            }
        };

        // Listener para mensajes del background (para abrir el modal y extraer PDFs)
        const messageListener = (
            message: any,
            _sender: chrome.runtime.MessageSender,
            sendResponse: (response?: any) => void,
        ) => {
            if (message.action === "openExerciseModal") {
                console.log("[content] Received message to open exercise modal:", message.exerciseIndex);
                handleOpenExerciseModal(message.exerciseIndex).catch(err => {
                    console.error("[content] Error opening exercise modal:", err);
                });
                return false;
            }
            if (message.action === "openSolutionModal") {
                console.log("[content] Received message to open solution modal:", message.exerciseIndex);
                handleOpenSolutionModal(message.exerciseIndex).catch(err => {
                    console.error("[content] Error opening solution modal:", err);
                });
                return false;
            }
            if (message.action === "extractPdfText") {
                console.log("[content] Received message to extract PDF text:", message.filename);
                extractPdfTextFromBase64(message.pdfBase64, message.filename, message.resourceName, message.size)
                    .then(result => {
                        sendResponse(result);
                    })
                    .catch(err => {
                        sendResponse({ success: false, error: err.message });
                    });
                return true; // Indica que sendResponse se llamará de forma asíncrona
            }
            if (message.action === "toolCallsUpdate") {
                // Este mensaje se maneja en ChatSidebar, no aquí
                return false;
            }
            return false;
        };

        chrome.runtime.onMessage.addListener(messageListener);

        loadCourseData();
        loadConfig();

        // Cleanup
        return () => {
            chrome.runtime.onMessage.removeListener(messageListener);
        };
    }, []);

    // Detectar cambios en la URL para actualizar el contexto cuando se cambia de página
    useEffect(() => {
        let lastPageId = currentPageId;

        const checkUrlChange = async () => {
            const newPageId = getPageIdFromUrl();

            // Si hay un cambio de página
            if (newPageId !== lastPageId) {
                if (newPageId) {
                    console.log(`[content] Page change detected: ${lastPageId} -> ${newPageId}`);
                    setCurrentPageId(newPageId);
                    setExercises([]);
                    setIsLoadingExercises(false);
                    // Cargar ejercicios desde cache al cambiar de página
                    await loadExercisesFromCache(newPageId);
                    setReloadSidebarKey(prev => prev + 1);
                } else if (lastPageId !== null) {
                    // Ya no estamos en una página de ejercicios
                    console.log(`[content] Leaving exercises page`);
                    setCurrentPageId(null);
                    setExercises([]);
                    setReloadSidebarKey(prev => prev + 1);
                }
                lastPageId = newPageId;
            }
        };

        // Verificar inmediatamente
        checkUrlChange();

        // Monitorear cambios de URL usando popstate y pushstate
        const handleUrlChange = () => checkUrlChange();

        window.addEventListener("popstate", handleUrlChange);
        window.addEventListener("pushstate", handleUrlChange);
        window.addEventListener("replacestate", handleUrlChange);

        // Fallback con interval por si los eventos no se disparan
        const intervalId = setInterval(checkUrlChange, 1000);

        return () => {
            window.removeEventListener("popstate", handleUrlChange);
            window.removeEventListener("pushstate", handleUrlChange);
            window.removeEventListener("replacestate", handleUrlChange);
            clearInterval(intervalId);
        };
    }, [currentPageId]);

    // Función para generar ejercicios con LLM (llamada manualmente con botones)
    const generateExercises = async (pageId: string) => {
        // Prevenir múltiples identificaciones simultáneas
        if (identifyingExercisesRef.current) {
            console.log("[content] Identification already in progress, ignoring request");
            return;
        }

        identifyingExercisesRef.current = true;

        try {
            // Extraer el resourceId de la URL (parámetro 'id' es el resourceId en páginas de Egela)
            const urlParams = new URLSearchParams(globalThis.location.search);
            const resourceId = urlParams.get("id"); // El ID del recurso (página) actual

            console.log("[content] Generating exercises with LLM...");
            console.log("[content] PageId:", pageId, "ResourceId:", resourceId);

            const response = await chrome.runtime.sendMessage({
                action: "getExerciseList",
                pageId: pageId,
                resourceId: resourceId || undefined,
                forceRefresh: true, // Siempre generar nuevos, nunca usar cache
            });

            if (response.success) {
                console.log(`[content] Identified ${response.exercises.length} exercises:`, response.exercises);

                // Actualizar el contexto usando el helper
                updateExerciseContext({
                    exercises: response.exercises.length > 0 ? response.exercises : [],
                    exercise_context: response.exercise_context,
                    concepts: response.concepts,
                    learning_objectives: response.learning_objectives,
                });

                if (response.concepts) {
                    console.log("[content] Concepts:", response.concepts);
                }
                if (response.learning_objectives) {
                    console.log("[content] Learning objectives:", response.learning_objectives);
                }

                if (response.exercises.length > 0) {
                    // Forzar recarga del sidebar para que muestre las pestañas de configuración
                    setReloadSidebarKey(prev => prev + 1);
                }
                // Si no hay ejercicios, simplemente mantenemos la vista del chat sin ejercicios
            } else {
                console.error("[content] Error identifying exercises:", response.error);
            }
        } catch (error) {
            console.error("[content] Error requesting exercise identification:", error);
        } finally {
            setIsLoadingExercises(false);
            identifyingExercisesRef.current = false;
        }
    };

    const handleCloseExtension = () => {
        setViewState("hidden");
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
    };

    const handleCloseSolutionModal = () => {
        setIsSolutionModalOpen(false);
    };

    // Helper para actualizar el contexto de ejercicios (usado por ambas funciones de carga)
    const updateExerciseContext = (data: any) => {
        if (data.exercises) {
            setExercises(
                data.exercises.map((exercise: Exercise) => ({
                    ...exercise,
                    allowed: exercise.allowed ?? true,
                    isTiquismiqui: exercise.isTiquismiqui ?? false,
                })),
            );
        }
        setExerciseContext(data.exercise_context);
        setConcepts(data.concepts);
        setLearningObjectives(data.learning_objectives);
    };

    // Función para cargar ejercicios desde cache (llamada automáticamente al cargar página)
    const loadExercisesFromCache = async (pageId: string): Promise<boolean> => {
        console.log("[content] Attempting to load exercises from cache...");
        try {
            const response = await chrome.runtime.sendMessage({
                action: "getExerciseData",
                pageId: pageId,
            });

            if (response.success && response.data && response.data.exercises && response.data.exercises.length > 0) {
                console.log("[content] Exercises loaded from cache:", response.data.exercises.length);
                updateExerciseContext(response.data);
                return true;
            } else {
                console.log("[content] No exercises in cache for this page");
            }
        } catch (error) {
            console.error("[content] Error loading exercises from cache:", error);
        }
        return false;
    };

    const handleOpenExerciseModal = async (exerciseIndex: number, fromCache: boolean = false) => {
        console.log("[content] handleOpenExerciseModal - Index:", exerciseIndex, "Ejercicios:", exercises.length);

        // Si no hay ejercicios, intentar cargarlos desde cache y marcar como pendiente
        if (exercises.length === 0) {
            const pageId = currentPageId || getPageIdFromUrl();
            if (pageId) {
                const loaded = await loadExercisesFromCache(pageId);
                if (loaded) {
                    setPendingModalOpen({ index: exerciseIndex, fromCache });
                    return;
                }
            }
        }

        openExerciseModalForIndex(exerciseIndex, fromCache);
    };

    const handleOpenSolutionModal = async (exerciseIndex: number) => {
        console.log("[content] handleOpenSolutionModal - Index:", exerciseIndex, "Ejercicios:", exercises.length);

        // Si no hay ejercicios, intentar cargarlos desde cache y marcar como pendiente
        if (exercises.length === 0) {
            const pageId = currentPageId || getPageIdFromUrl();
            if (pageId) {
                const loaded = await loadExercisesFromCache(pageId);
                if (loaded) {
                    setPendingSolutionModalOpen(exerciseIndex);
                    return;
                }
            }
        }

        // Abrir modal directamente
        setSelectedExerciseIndex(exerciseIndex);
        setIsSolutionModalOpen(true);
    };

    const handleOpenExplanationFromCache = async (exerciseName: string) => {
        // Buscar el ejercicio por nombre
        const exerciseIndex = exercises.findIndex(ex => ex.name === exerciseName);

        if (exerciseIndex >= 0) {
            // Si encontramos el ejercicio, abrir el modal con ese ejercicio y carga del cache
            handleOpenExerciseModal(exerciseIndex, true);
        } else {
            console.warn(`[content] Exercise not found: ${exerciseName}`);
        }
    };

    const handleExplanationGenerated = () => {
        // Incrementar el trigger para forzar recarga en ChatSidebar
        setReloadExplanationsKey(prev => prev + 1);
    };

    const handleOpenEvaluationList = (exerciseName: string) => {
        setSelectedEvaluationExerciseName(exerciseName);
        setIsEvaluationListModalOpen(true);
    };

    const handleCloseEvaluationListModal = () => {
        setIsEvaluationListModalOpen(false);
    };

    const handleEvaluationGenerated = () => {
        // Incrementar el trigger para forzar recarga en ChatSidebar
        setReloadEvaluationsKey(prev => prev + 1);
    };

    const handleIdentifyExercises = async () => {
        const pageId = currentPageId || getPageIdFromUrl();
        if (!pageId) {
            console.warn("[content] No pageId to identify exercises");
            return;
        }

        setIsLoadingExercises(true);
        await generateExercises(pageId);
    };

    // No mostrar nada si está oculto o si no hay curso
    if (viewState === "hidden" || !course) return null;

    // Renderizar según el estado
    return (
        <>
            {/* El chat se muestra si el estado es "chat" */}
            {viewState === "chat" && (
                <ChatSidebar
                    courseId={courseId || undefined}
                    onClose={handleCloseExtension}
                    isLoadingExercises={isLoadingExercises}
                    pageId={currentPageId || undefined}
                    onOpenExplanation={handleOpenExplanationFromCache}
                    onExplanationGenerated={handleExplanationGenerated}
                    onOpenEvaluation={handleOpenEvaluationList}
                    onEvaluationGenerated={handleEvaluationGenerated}
                    isAnyModalOpen={isModalOpen || isSolutionModalOpen || isEvaluationListModalOpen}
                    hasExercisesLoaded={exercises.length > 0}
                    key={`${reloadExplanationsKey}-${reloadEvaluationsKey}-${reloadSidebarKey}`} // Re-renderizar cuando cambie cualquier trigger
                />
            )}

            {/* El modal se muestra sobre el chat cuando se selecciona un ejercicio */}
            {isModalOpen && exercises.length > 0 && exercises[selectedExerciseIndex] && (
                <ExerciseModal
                    exercise={exercises[selectedExerciseIndex]}
                    isOpen={isModalOpen}
                    onClose={handleCloseModal}
                    pageId={currentPageId || undefined}
                    courseId={courseId || undefined}
                    loadFromCache={modalLoadFromCache}
                    onExplanationGenerated={handleExplanationGenerated}
                />
            )}

            {/* El modal de solución se muestra cuando el estudiante quiere resolver un ejercicio */}
            {isSolutionModalOpen && exercises.length > 0 && exercises[selectedExerciseIndex] && (
                <SolutionModal
                    exercise={exercises[selectedExerciseIndex]}
                    exerciseContext={exerciseContext}
                    concepts={concepts}
                    learningObjectives={learningObjectives}
                    isOpen={isSolutionModalOpen}
                    onClose={handleCloseSolutionModal}
                    pageId={currentPageId || undefined}
                    courseId={courseId || undefined}
                    onEvaluationGenerated={handleEvaluationGenerated}
                />
            )}

            {/* El modal de lista de evaluaciones muestra el historial de evaluaciones de un ejercicio */}
            {isEvaluationListModalOpen && (
                <EvaluationListModal
                    exerciseName={selectedEvaluationExerciseName}
                    isOpen={isEvaluationListModalOpen}
                    onClose={handleCloseEvaluationListModal}
                    pageId={currentPageId || undefined}
                />
            )}
        </>
    );
};

// Componente principal que maneja la inyección
const ContentApp: React.FC = () => {
    useEffect(() => {
        console.log("Chrome extension loaded at:", globalThis.location.href);

        return () => {
            console.log("Chrome extension unloaded");
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
