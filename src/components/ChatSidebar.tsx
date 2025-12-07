import React, { useEffect, useState } from "react";
import { APP_CONFIG } from "../constants";
import { AppMode, ModeManager } from "../util/config/ModeManager";
import { ProgressManager } from "../util/progress/ProgressManager";
import { SidebarStateStorageManager } from "../util/storage/SidebarStateStorageManager";
import { ConfigurationRequired } from "./ConfigurationRequired";
import ExerciseConfigTab from "./ExerciseConfigTab";
import LabConfigTab from "./LabConfigTab";
import ProgressTab from "./ProgressTab";

interface Exercise {
    name: string;
    statement: string;
    allowed?: boolean;
    isTiquismiqui?: boolean;
}

interface ChatMessage {
    role: "user" | "assistant" | "tool";
    content: string | null;
    id: string;
    tool_calls?: Array<{
        function: {
            name: string;
            arguments: string;
        };
        id: string;
        type: string;
    }>;
    name?: string;
}

interface ChatSidebarProps {
    onClose: () => void;
    isLoadingExercises?: boolean;
    pageId?: string;
    courseId?: string; // Añadido para la configuración del curso
    onOpenExplanation?: (exerciseName: string) => void;
    onExplanationGenerated?: () => void; // Callback para recargar lista cuando se genera explicación
    onOpenEvaluation?: (exerciseName: string) => void;
    onEvaluationGenerated?: () => void; // Callback para recargar lista cuando se genera evaluación
    isAnyModalOpen?: boolean; // Indica si hay algún modal abierto
    hasExercisesLoaded?: boolean; // Indica si hay ejercicios cargados
    onIdentifyExercises?: () => void; // Callback para generar ejercicios manualmente
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({
    onClose,
    isLoadingExercises = false,
    pageId,
    courseId,
    onOpenExplanation,
    onExplanationGenerated,
    onOpenEvaluation,
    onEvaluationGenerated,
    isAnyModalOpen = false,
    hasExercisesLoaded = false,
    onIdentifyExercises,
}) => {
    const savedState = SidebarStateStorageManager.getSidebarState();
    const [isCollapsed, setIsCollapsed] = useState(savedState?.isCollapsed ?? false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState<string>("");
    const [isGenerating, setIsGenerating] = useState<boolean>(false);
    const [activeTab, setActiveTab] = useState<"chat" | "exercises" | "config" | "labs" | "progress">(
        savedState?.activeTab ?? "chat"
    );
    const [enableTransition, setEnableTransition] = useState(false);
    const [exercisesWithExplanations, setExercisesWithExplanations] = useState<string[]>([]);
    const [exercisesWithEvaluations, setExercisesWithEvaluations] = useState<string[]>([]);
    const [isLoadingExplanations, setIsLoadingExplanations] = useState(false);
    const [isLoadingEvaluations, setIsLoadingEvaluations] = useState(false);
    const [exercises, setExercises] = useState<Exercise[]>([]);
    const [isLabBlocked, setIsLabBlocked] = useState<boolean>(false);
    const [isCheckingBlocked, setIsCheckingBlocked] = useState<boolean>(true);
    const [isTeacherMode, setIsTeacherMode] = useState<boolean>(false);
    const [isUserTeacher, setIsUserTeacher] = useState<boolean>(false);
    const [needsConfiguration, setNeedsConfiguration] = useState<boolean>(false);
    const [missingLLMConfig, setMissingLLMConfig] = useState<boolean>(false);
    const [isCheckingConfig, setIsCheckingConfig] = useState<boolean>(true);
    const [reloadKey, setReloadKey] = useState<number>(0);
    const messagesEndRef = React.useRef<HTMLDivElement>(null);

    // Calcular si el chat debe estar deshabilitado
    const isChatDisabled =
        isAnyModalOpen || isGenerating || isLoadingExercises || isLabBlocked || (!!pageId && !hasExercisesLoaded);
    const getChatPlaceholder = () => {
        if (isAnyModalOpen) return "Chat disabled (modal open)...";
        if (isLabBlocked) return "Lab blocked...";
        if (isLoadingExercises) return "Loading exercises...";
        if (pageId && !hasExercisesLoaded) return "No exercises loaded. Press 'Identify' to analyze them...";
        return "Type your question...";
    };
    const getWelcomeMessage = () => {
        if (!pageId) {
            return "You can ask me about the course content. If you want to work on exercises, open a lab first.";
        }

        if (exercises.length > 0) {
            return "The exercises on this page are ready. Ask me for an explanation or tell me if you want to check your solution for any of them. If you want, I can also give you the list of available exercises.";
        }

        if (pageId && !hasExercisesLoaded) {
            return "As soon as you identify the exercises, I will be able to help you with them.";
        }

        return "I am here to help you with the course.";
    };

    React.useEffect(() => {
        const checkModeAndConfiguration = async () => {
            setIsCheckingConfig(true);
            try {
                ModeManager.clearCache();

                // Verificar si el usuario es profesor en Egela comunicándose con el background
                const response = await chrome.runtime.sendMessage({ action: "checkUserRole" });
                const userIsTeacher = response?.success ? response.isTeacher : false;
                setIsUserTeacher(userIsTeacher);

                // Si el usuario no es profesor, forzar modo alumno
                if (!userIsTeacher) {
                    await ModeManager.setMode(AppMode.STUDENT);
                    setIsTeacherMode(false);
                } else {
                    // Si es profesor, usar el modo configurado
                    const teacherMode = await ModeManager.isTeacherMode();
                    setIsTeacherMode(teacherMode);
                }

                // Verificar configuración a través del background
                const configResponse = await chrome.runtime.sendMessage({ action: "checkConfiguration" });

                if (configResponse?.success) {
                    setMissingLLMConfig(!configResponse.hasLLMConfig);

                    const currentMode = await ModeManager.getMode();
                    if (currentMode === AppMode.STUDENT) {
                        setNeedsConfiguration(!configResponse.hasStudentConfig);
                    } else {
                        setNeedsConfiguration(false);
                    }
                } else {
                    setMissingLLMConfig(false);
                    setNeedsConfiguration(false);
                }
            } catch (error) {
                console.error("[ChatSidebar] Error verificando configuración:", error);
                setNeedsConfiguration(false);
                setMissingLLMConfig(false);
            } finally {
                setIsCheckingConfig(false);
            }
        };

        checkModeAndConfiguration();
    }, [reloadKey]);

    React.useEffect(() => {
        const messageListener = (
            message: any,
            sender: chrome.runtime.MessageSender,
            sendResponse: (response?: any) => void
        ) => {
            if (message.action === "reloadSidebar") {
                setReloadKey(prev => prev + 1);
                sendResponse({ success: true });
                return true;
            }
        };

        chrome.runtime.onMessage.addListener(messageListener);

        return () => {
            chrome.runtime.onMessage.removeListener(messageListener);
        };
    }, []);

    // Habilitar transición después del primer render
    useEffect(() => {
        setEnableTransition(true);
    }, []);

    // Guardar estado del sidebar cuando cambie
    useEffect(() => {
        try {
            SidebarStateStorageManager.saveSidebarState({
                isCollapsed,
                activeTab,
            });
        } catch (error) {
            console.error("Error guardando estado del sidebar:", error);
        }
    }, [isCollapsed, activeTab]);

    const handleConfigLoaded = async () => {
        setReloadKey(prev => prev + 1);

        if (pageId) {
            await loadExercises();
            await loadExercisesWithExplanations();
            await loadExercisesWithEvaluations();
        }
    };

    const handleModeToggle = async () => {
        if (!isUserTeacher) return; // Solo los profesores pueden cambiar de modo

        try {
            const newMode = await ModeManager.toggleMode();
            const newIsTeacherMode = newMode === AppMode.TEACHER;
            setIsTeacherMode(newIsTeacherMode);

            // Cambiar pestaña si la actual no está disponible en el nuevo modo
            if (newIsTeacherMode) {
                // Modo profesor: pestañas disponibles: labs (si courseId), config, chat
                if (activeTab === "exercises" || activeTab === "progress") {
                    setActiveTab("chat");
                }
            } else {
                // Modo estudiante: pestañas disponibles: exercises (si hay ejercicios), progress (si courseId), chat
                if (activeTab === "labs" || activeTab === "config") {
                    setActiveTab("chat");
                }
            }

            // Recargar el componente
            setReloadKey(prev => prev + 1);

            // Notificar a otras tabs
            const tabs = await chrome.tabs.query({});
            for (const tab of tabs) {
                if (tab.id && tab.url && !tab.url.startsWith("chrome://")) {
                    try {
                        await chrome.tabs.sendMessage(tab.id, { action: "reloadSidebar" });
                    } catch (error) {
                        // Ignorar errores si el content script no está cargado
                    }
                }
            }

            const extensionTabs = tabs.filter(tab => tab.url?.includes("chrome-extension://"));
            for (const tab of extensionTabs) {
                if (tab.id) {
                    chrome.tabs.reload(tab.id);
                }
            }
        } catch (error) {
            console.error("[ChatSidebar] Error al cambiar el modo:", error);
        }
    };

    React.useEffect(() => {
        const checkLabBlocked = async () => {
            if (!pageId || !courseId) {
                setIsLabBlocked(false);
                setIsCheckingBlocked(false);
                return;
            }

            setIsCheckingBlocked(true);
            try {
                // En modo profesor, nunca bloquear laboratorios
                if (isTeacherMode) {
                    setIsLabBlocked(false);
                } else {
                    const blocked = await ProgressManager.isLabBlocked(pageId, courseId);
                    setIsLabBlocked(blocked);
                }
            } catch (error) {
                console.error("[ChatSidebar] Error checking if lab is blocked:", error);
                setIsLabBlocked(false);
            } finally {
                setIsCheckingBlocked(false);
            }
        };

        checkLabBlocked();
    }, [pageId, courseId, isTeacherMode]);

    React.useEffect(() => {
        if (pageId && !needsConfiguration) {
            loadExercises();
            loadExercisesWithExplanations();
            loadExercisesWithEvaluations();
        }
    }, [pageId, reloadKey, needsConfiguration]);

    React.useEffect(() => {
        const loadChatHistory = async () => {
            try {
                const response: any = await chrome.runtime.sendMessage({ action: "loadChatHistory" });

                if (response && response.success && Array.isArray(response.messages)) {
                    // Mapear los mensajes almacenados al formato de la UI
                    // Filtramos system y tool, pero incluimos assistant con tool_calls
                    const uiMessages: ChatMessage[] = response.messages
                        .filter((m: any) => m.role === "user" || m.role === "assistant" || m.role === "tool")
                        .map((m: any, idx: number) => ({
                            role: m.role as "user" | "assistant" | "tool",
                            content: m.content,
                            id: `${m.role}-${Date.now()}-${idx}`,
                            tool_calls: m.tool_calls,
                            name: m.name,
                        }));

                    setMessages(uiMessages);
                    console.log(`[ChatSidebar] Historial de chat cargado: ${uiMessages.length} mensajes`);
                } else {
                    console.log("[ChatSidebar] No hay historial de chat en background");
                }
            } catch (error) {
                console.error("[ChatSidebar] Error cargando historial de chat:", error);
            }
        };

        loadChatHistory();
    }, []);

    // Scroll automático al final cuando cambian los mensajes o el estado de generación
    React.useEffect(() => {
        if (activeTab === "chat") {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, isGenerating, activeTab]);

    const loadExercisesWithExplanations = async () => {
        if (!pageId) return;

        setIsLoadingExplanations(true);
        try {
            const response = await chrome.runtime.sendMessage({
                action: "getExercisesWithExplanations",
                pageId: pageId,
            });

            if (response.success) {
                setExercisesWithExplanations(response.exerciseNames);
            }
        } catch (error) {
            console.error("Error loading exercises with explanations:", error);
        } finally {
            setIsLoadingExplanations(false);
        }
    };

    const loadExercisesWithEvaluations = async () => {
        if (!pageId) return;

        setIsLoadingEvaluations(true);
        try {
            const response = await chrome.runtime.sendMessage({
                action: "getExercisesWithEvaluations",
                pageId: pageId,
            });

            if (response.success) {
                setExercisesWithEvaluations(response.exerciseNames);
            }
        } catch (error) {
            console.error("Error loading exercises with evaluations:", error);
        } finally {
            setIsLoadingEvaluations(false);
        }
    };

    const loadExercises = async () => {
        if (!pageId) return;

        try {
            // Cargar solo desde storage
            const resp = await chrome.runtime.sendMessage({ action: "getExerciseData", pageId });
            if (resp && resp.success && resp.data && Array.isArray(resp.data.exercises)) {
                // Asegurarse de incluir campo allowed
                const loaded = resp.data.exercises.map((ex: any) => ({
                    name: ex.name,
                    statement: ex.statement,
                    allowed: ex.allowed ?? true,
                    isTiquismiqui: ex.isTiquismiqui ?? false,
                }));
                setExercises(loaded);
            } else {
                // No hay datos en storage, lista vacía
                setExercises([]);
            }
        } catch (error) {
            console.error("Error loading exercises:", error);
            setExercises([]);
        }
    };

    const handleExplanationClick = (exerciseName: string) => {
        if (onOpenExplanation) {
            onOpenExplanation(exerciseName);
        }
    };

    const handleEvaluationClick = (exerciseName: string) => {
        if (onOpenEvaluation) {
            onOpenEvaluation(exerciseName);
        }
    };

    const handleConfigUpdate = async () => {
        // Recargar ejercicios desde el storage con la configuración actualizada
        if (pageId) {
            try {
                const response = await chrome.runtime.sendMessage({
                    action: "getExerciseData",
                    pageId: pageId,
                });

                if (response.success && response.data) {
                    setExercises(
                        response.data.exercises.map((ex: any) => ({
                            name: ex.name,
                            statement: ex.statement,
                            allowed: ex.allowed ?? true,
                            isTiquismiqui: ex.isTiquismiqui ?? false,
                        }))
                    );
                }
            } catch (error) {
                console.error("Error loading updated exercises:", error);
            }
        }

        // Recargar lista de explicaciones
        await loadExercisesWithExplanations();

        // Notificar al padre si es necesario
        if (onExplanationGenerated) {
            onExplanationGenerated();
        }
    };

    const handleSendMessage = async () => {
        if (!inputValue.trim() || isGenerating) return;

        const userMessage: ChatMessage = {
            role: "user",
            content: inputValue,
            id: `user-${Date.now()}`,
        };

        setMessages(prev => [...prev, userMessage]);
        setInputValue("");
        setIsGenerating(true);

        try {
            const response = await chrome.runtime.sendMessage({
                action: "generateResponse",
                userMessage: inputValue,
                resetHistory: false, // Nunca resetear automáticamente, se hace manualmente con el botón
                exercises: exercises.length > 0 ? exercises : undefined,
            });

            const assistantMessage: ChatMessage = {
                role: "assistant",
                content: response,
                id: `assistant-${Date.now()}`,
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            console.error("Error generating response:", error);
            const errorMessage: ChatMessage = {
                role: "assistant",
                content: "Error generating response. Please try again.",
                id: `error-${Date.now()}`,
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleResetChat = async () => {
        try {
            await chrome.runtime.sendMessage({ action: "resetChatHistory" });
            setMessages([]);
            console.log("[ChatSidebar] Chat reiniciado");
        } catch (error) {
            console.error("[ChatSidebar] Error reiniciando chat:", error);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    return (
        <div
            className="extension-sidebar"
            style={{
                position: "fixed",
                top: "0",
                right: isCollapsed ? "-580px" : "0",
                width: "600px",
                height: "100vh",
                backgroundColor: "#ffffff",
                borderLeft: "1px solid #dee2e6",
                boxShadow: "-2px 0 8px rgba(0,0,0,0.1)",
                zIndex: "9999",
                transition: enableTransition ? "right 0.3s ease-in-out" : "none",
                display: "flex",
                flexDirection: "column",
                fontFamily: "Inter, sans-serif",
            }}
        >
            {/* Botón para colapsar/expandir */}
            <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                style={{
                    position: "absolute",
                    left: "-40px",
                    top: "0",
                    width: "40px",
                    height: "80px",
                    backgroundColor: "#0f47ad",
                    color: "white",
                    border: "none",
                    borderRadius: "0 0 0 8px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "16px",
                    boxShadow: "-4px 0 16px rgba(0,0,0,0.6)",
                }}
                title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
                {isCollapsed ? "◀" : "▶"}
            </button>

            {/* Header */}
            <div className="card-header bg-light border-bottom">
                <div className="d-flex justify-content-between align-items-start mb-2">
                    <div className="d-flex align-items-center">
                        <img
                            src={chrome.runtime.getURL("icons/icon128.png")}
                            alt="Moodlia Icon"
                            style={{ width: "48px", height: "48px", marginRight: "16px" }}
                        />
                        <h2 className="h2 mb-0">{APP_CONFIG.NAME}</h2>
                    </div>
                    {/* Selector de modo solo visible para profesores */}
                    {isUserTeacher && (
                        <div className="d-flex flex-column bg-light p-3 rounded border">
                            <label className="form-label fw-bold mb-2">Mode</label>
                            <div className="d-flex flex-column gap-1">
                                <div className="form-check">
                                    <input
                                        className="form-check-input"
                                        type="radio"
                                        name="modeSelector"
                                        id="modeStudent"
                                        checked={!isTeacherMode}
                                        onChange={() => handleModeToggle()}
                                    />
                                    <label className="form-check-label" htmlFor="modeStudent">
                                        Student
                                    </label>
                                </div>
                                <div className="form-check">
                                    <input
                                        className="form-check-input"
                                        type="radio"
                                        name="modeSelector"
                                        id="modeTeacher"
                                        checked={isTeacherMode}
                                        onChange={() => handleModeToggle()}
                                    />
                                    <label className="form-check-label" htmlFor="modeTeacher">
                                        Teacher
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Pestañas */}
                {!needsConfiguration && (
                    <ul className="nav nav-tabs mt-3 mb-0" role="tablist" key={`tabs-${isTeacherMode}-${reloadKey}`}>
                        {/* Pestañas solo para modo profesor */}
                        {isTeacherMode && (
                            <>
                                {/* Configurar curso - primero si hay courseId */}
                                {courseId && (
                                    <li className="nav-item" role="presentation">
                                        <button
                                            className={`nav-link ${activeTab === "labs" ? "active" : ""}`}
                                            onClick={() => setActiveTab("labs")}
                                            type="button"
                                            role="tab"
                                        >
                                            Configure course
                                        </button>
                                    </li>
                                )}
                                {/* Configurar laboratorio - segundo */}
                                <li className="nav-item" role="presentation">
                                    <button
                                        className={`nav-link ${activeTab === "config" ? "active" : ""}`}
                                        onClick={() => setActiveTab("config")}
                                        type="button"
                                        role="tab"
                                    >
                                        Configure lab
                                    </button>
                                </li>
                            </>
                        )}

                        {/* Chat - tercero */}
                        <li className="nav-item" role="presentation">
                            <button
                                className={`nav-link ${activeTab === "chat" ? "active" : ""}`}
                                onClick={() => setActiveTab("chat")}
                                type="button"
                                role="tab"
                            >
                                Chat
                            </button>
                        </li>

                        {/* Pestañas solo para modo alumno */}
                        {!isTeacherMode && exercises.length > 0 && (
                            <li className="nav-item" role="presentation">
                                <button
                                    className={`nav-link ${activeTab === "exercises" ? "active" : ""}`}
                                    onClick={() => setActiveTab("exercises")}
                                    type="button"
                                    role="tab"
                                    disabled={isLabBlocked}
                                    title={isLabBlocked ? "Not available while lab is blocked" : ""}
                                >
                                    Exercises
                                    {(exercisesWithExplanations.length > 0 || exercisesWithEvaluations.length > 0) && (
                                        <span className="badge bg-primary ms-2">
                                            {Math.max(
                                                exercisesWithExplanations.length,
                                                exercisesWithEvaluations.length
                                            )}
                                        </span>
                                    )}
                                </button>
                            </li>
                        )}

                        {/* Pestaña de progreso - último para alumnos cuando hay courseId */}
                        {!isTeacherMode && courseId && (
                            <li className="nav-item" role="presentation">
                                <button
                                    className={`nav-link ${activeTab === "progress" ? "active" : ""}`}
                                    onClick={() => setActiveTab("progress")}
                                    type="button"
                                    role="tab"
                                >
                                    My progress
                                </button>
                            </li>
                        )}
                    </ul>
                )}
            </div>

            {/* Área de contenido (chat o explicaciones) */}
            <div
                style={{
                    flex: "1",
                    overflowY: "auto",
                    padding: "16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                }}
            >
                {isCheckingConfig ? (
                    <div className="d-flex align-items-center justify-content-center" style={{ minHeight: "400px" }}>
                        <div className="text-center">
                            <div className="spinner-border text-primary mb-3" role="status">
                                <span className="visually-hidden">Checking configuration...</span>
                            </div>
                            <p className="text-muted">Checking configuration...</p>
                        </div>
                    </div>
                ) : needsConfiguration || missingLLMConfig ? (
                    <ConfigurationRequired
                        onConfigLoaded={handleConfigLoaded}
                        missingExerciseConfig={needsConfiguration}
                        missingLLMConfig={missingLLMConfig}
                    />
                ) : activeTab === "chat" ? (
                    <>
                        {isCheckingBlocked ? (
                            <div className="card border-primary">
                                <div className="card-body p-3">
                                    <div className="d-flex align-items-center mb-2">
                                        <div className="spinner-border spinner-border-sm text-primary me-2">
                                            <span className="visually-hidden">Checking access...</span>
                                        </div>
                                        <strong>Checking lab access...</strong>
                                    </div>
                                </div>
                            </div>
                        ) : isLabBlocked ? (
                            <div className="alert alert-danger" role="alert">
                                <h5 className="alert-heading">
                                    <i className="bi bi-lock-fill me-2"></i>
                                    Lab blocked
                                </h5>
                                <p>
                                    This lab is blocked because it is a required lab and you have not yet completed the
                                    previous lab.
                                </p>
                                <hr />
                                <p className="mb-0">
                                    <strong>To unlock this lab:</strong>
                                </p>
                                <ul className="mb-0 mt-2">
                                    <li>Complete the required challenge exercises from the previous lab</li>
                                    <li>
                                        Meet the criteria defined by your teacher in the extension options or check the
                                        details in "My progress"
                                    </li>
                                    <li>Check your progress in the "My progress" tab</li>
                                </ul>
                            </div>
                        ) : isLoadingExercises ? (
                            <div className="card border-primary">
                                <div className="card-body p-3">
                                    <div className="d-flex align-items-center mb-2">
                                        <div className="spinner-border spinner-border-sm text-primary me-2">
                                            <span className="visually-hidden">Loading...</span>
                                        </div>
                                        <strong>Searching for exercises...</strong>
                                    </div>
                                    <p className="text-muted small mb-0">
                                        Analyzing page content to identify available exercises.
                                    </p>
                                </div>
                            </div>
                        ) : pageId && !hasExercisesLoaded && !isLoadingExercises ? (
                            <>
                                <div className="alert alert-warning" role="alert">
                                    <h6 className="alert-heading mb-2">
                                        <i className="bi bi-exclamation-triangle me-2"></i>
                                        No exercises loaded
                                    </h6>
                                    <p className="mb-3 small">
                                        To use the chat with exercise context, you must first identify them.
                                    </p>
                                    <button
                                        type="button"
                                        className="btn btn-primary btn-sm"
                                        onClick={onIdentifyExercises}
                                    >
                                        <i className="bi bi-play-circle me-1"></i>
                                        Identify exercises now
                                    </button>
                                </div>
                            </>
                        ) : messages.length === 0 ? (
                            <>
                                <div className="alert alert-info" role="alert">
                                    {getWelcomeMessage()}
                                </div>
                                {/* Botón para identificar ejercicios si estamos en una página y no hay ejercicios */}
                                {pageId && exercises.length === 0 && !isLoadingExercises && (
                                    <div className="card border-primary">
                                        <div className="card-body p-3">
                                            <h6 className="card-title mb-2">
                                                <i className="bi bi-search me-2"></i>
                                                Identify exercises
                                            </h6>
                                            <p className="card-text small text-muted mb-3">
                                                Press the button to analyze the page and identify available exercises.
                                            </p>
                                            <button
                                                type="button"
                                                className="btn btn-primary btn-sm"
                                                onClick={onIdentifyExercises}
                                            >
                                                <i className="bi bi-play-circle me-1"></i>
                                                Identify exercises
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            messages.map(message => {
                                // Ignorar mensajes de tipo tool (no mostrarlos)
                                if (message.role === "tool") {
                                    return null;
                                }

                                // Ignorar mensajes del asistente con tool_calls (no mostrarlos)
                                if (
                                    message.role === "assistant" &&
                                    message.tool_calls &&
                                    message.tool_calls.length > 0
                                ) {
                                    return null;
                                }

                                // Ignorar mensajes sin contenido o con contenido vacío
                                if (!message.content || message.content.trim() === "") {
                                    return null;
                                }

                                // Mensaje normal (usuario o asistente)
                                return (
                                    <div
                                        key={message.id}
                                        className={`card ${message.role === "user" ? "bg-primary text-white" : ""}`}
                                    >
                                        <div className="card-body p-2">
                                            <div className="small mb-1">
                                                <strong>{message.role === "user" ? "You" : "Assistant"}</strong>
                                            </div>
                                            <div style={{ whiteSpace: "pre-wrap" }}>{message.content}</div>
                                        </div>
                                    </div>
                                );
                            })
                        )}

                        {isGenerating && (
                            <div className="card border-secondary">
                                <div className="card-body p-2">
                                    <div className="d-flex align-items-center">
                                        <div
                                            className="spinner-border spinner-border-sm me-2"
                                            aria-label="Generating response"
                                        >
                                            <span className="visually-hidden">Loading...</span>
                                        </div>
                                        <span className="small">Generating response...</span>
                                    </div>
                                </div>
                            </div>
                        )}
                        {/* Elemento de referencia para scroll automático */}
                        <div ref={messagesEndRef} />
                    </>
                ) : activeTab === "exercises" ? (
                    <>
                        {/* Pestaña de ejercicios - Combina explicaciones y evaluaciones */}
                        {isLoadingExplanations || isLoadingEvaluations ? (
                            <div className="card border-primary">
                                <div className="card-body p-3">
                                    <div className="d-flex align-items-center">
                                        <div className="spinner-border spinner-border-sm text-primary me-2">
                                            <span className="visually-hidden">Loading...</span>
                                        </div>
                                        <span>Loading exercises...</span>
                                    </div>
                                </div>
                            </div>
                        ) : exercisesWithExplanations.length === 0 && exercisesWithEvaluations.length === 0 ? (
                            <div className="alert alert-info" role="alert">
                                <strong>No explanations or evaluations saved</strong>
                                <p className="mb-0 mt-2 small">
                                    Explanations and evaluations generated through the chat will be saved here so you
                                    can access them later.
                                </p>
                            </div>
                        ) : (
                            <div className="list-group">
                                {/* Crear un conjunto único de ejercicios que tienen explicaciones o evaluaciones */}
                                {Array.from(new Set([...exercisesWithExplanations, ...exercisesWithEvaluations])).map(
                                    (exerciseName, index) => {
                                        const hasExplanation = exercisesWithExplanations.includes(exerciseName);
                                        const hasEvaluation = exercisesWithEvaluations.includes(exerciseName);

                                        return (
                                            <div key={index} className="list-group-item">
                                                <div className="d-flex w-100 justify-content-between align-items-center">
                                                    <h6 className="mb-0">{exerciseName}</h6>
                                                    <div className="d-flex gap-2">
                                                        {hasExplanation && (
                                                            <button
                                                                type="button"
                                                                className="btn btn-sm btn-primary"
                                                                onClick={() => handleExplanationClick(exerciseName)}
                                                            >
                                                                <i className="bi bi-book me-1"></i>
                                                                View explanation
                                                            </button>
                                                        )}
                                                        {hasEvaluation && (
                                                            <button
                                                                type="button"
                                                                className="btn btn-sm btn-success"
                                                                onClick={() => handleEvaluationClick(exerciseName)}
                                                            >
                                                                <i className="bi bi-clipboard-check me-1"></i>
                                                                View evaluations
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }
                                )}
                            </div>
                        )}
                    </>
                ) : activeTab === "config" ? (
                    <>
                        {/* Pestaña de configuración de laboratorio */}
                        <ExerciseConfigTab
                            exercises={exercises}
                            pageId={pageId || ""}
                            onConfigUpdate={handleConfigUpdate}
                            isActive={activeTab === "config"}
                            isLoadingExercises={isLoadingExercises}
                            onIdentifyExercises={onIdentifyExercises}
                        />
                    </>
                ) : activeTab === "labs" ? (
                    <>
                        {/* Pestaña de configuración del curso */}
                        <LabConfigTab
                            courseId={courseId || ""}
                            onConfigUpdate={handleConfigUpdate}
                            isActive={activeTab === "labs"}
                        />
                    </>
                ) : activeTab === "progress" ? (
                    <>
                        {/* Pestaña de progreso del estudiante */}
                        <ProgressTab courseId={courseId || ""} />
                    </>
                ) : null}
            </div>

            {/* Input de chat - solo visible en la pestaña de chat */}
            {activeTab === "chat" && (
                <div className="card-footer bg-light border-top">
                    <div className="d-flex gap-2 align-items-center">
                        <textarea
                            className="form-control"
                            placeholder={getChatPlaceholder()}
                            value={inputValue}
                            onChange={e => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={isChatDisabled}
                            rows={4}
                            style={{ resize: "none", overflow: "auto", flex: 1 }}
                        />
                        <button
                            className="btn btn-primary"
                            type="button"
                            onClick={handleSendMessage}
                            disabled={isChatDisabled || !inputValue.trim()}
                            title="Send message"
                            style={{
                                padding: "8px 12px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M22 2L11 13" />
                                <path d="M22 2L15 22L11 13L2 9L22 2Z" />
                            </svg>
                        </button>
                        <button
                            onClick={handleResetChat}
                            title="Restart conversation"
                            disabled={isAnyModalOpen}
                            style={{
                                background: "transparent",
                                border: "none",
                                padding: "8px",
                                cursor: isAnyModalOpen ? "not-allowed" : "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                opacity: isAnyModalOpen ? 0.5 : 1,
                            }}
                        >
                            <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="#6c757d"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChatSidebar;
