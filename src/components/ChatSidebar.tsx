import React, { useState } from "react";
import { APP_CONFIG } from "../constants";
import { ModeManager } from "../util/config/ModeManager";
import { ProgressManager } from "../util/progress/ProgressManager";
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
    courseId?: string; // Añadido para la configuración de laboratorios
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
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState<string>("");
    const [isGenerating, setIsGenerating] = useState<boolean>(false);
    const [activeTab, setActiveTab] = useState<
        "chat" | "explanations" | "evaluations" | "config" | "labs" | "progress"
    >("chat");
    const [exercisesWithExplanations, setExercisesWithExplanations] = useState<string[]>([]);
    const [exercisesWithEvaluations, setExercisesWithEvaluations] = useState<string[]>([]);
    const [isLoadingExplanations, setIsLoadingExplanations] = useState(false);
    const [isLoadingEvaluations, setIsLoadingEvaluations] = useState(false);
    const [exercises, setExercises] = useState<Exercise[]>([]);
    const [isLabBlocked, setIsLabBlocked] = useState<boolean>(false);
    const [isCheckingBlocked, setIsCheckingBlocked] = useState<boolean>(true);
    const [isTeacherMode, setIsTeacherMode] = useState<boolean>(false);
    const [needsConfiguration, setNeedsConfiguration] = useState<boolean>(false);
    const [missingLLMConfig, setMissingLLMConfig] = useState<boolean>(false);
    const [isCheckingConfig, setIsCheckingConfig] = useState<boolean>(true);
    const [reloadKey, setReloadKey] = useState<number>(0);
    const messagesEndRef = React.useRef<HTMLDivElement>(null);

    // Calcular si el chat debe estar deshabilitado
    const isChatDisabled =
        isAnyModalOpen || isGenerating || isLoadingExercises || isLabBlocked || (!!pageId && !hasExercisesLoaded);
    const getChatPlaceholder = () => {
        if (isAnyModalOpen) return "Chat deshabilitado (modal abierto)...";
        if (isLabBlocked) return "Laboratorio bloqueado...";
        if (isLoadingExercises) return "Cargando ejercicios...";
        if (pageId && !hasExercisesLoaded)
            return "No hay ejercicios cargados. Presiona 'Identificar' para analizarlos...";
        return "Escribe tu pregunta...";
    };
    const getWelcomeMessage = () => {
        if (!pageId) {
            return "Puedes preguntarme sobre el contenido del curso. Si quieres trabajar ejercicios, abre un laboratorio primero.";
        }

        if (exercises.length > 0) {
            return "Los ejercicios de esta página están listos. Pídeme una explicación o dime si quieres revisar tu solución para cualquiera de ellos. Si quieres también puedo darte la lista de ejercicios disponibles.";
        }

        if (pageId && !hasExercisesLoaded) {
            return "En cuanto identifiques los ejercicios podré ayudarte con ellos.";
        }

        return "Estoy aquí para ayudarte con el curso.";
    };

    React.useEffect(() => {
        const checkModeAndConfiguration = async () => {
            setIsCheckingConfig(true);
            try {
                ModeManager.clearCache();
                const teacherMode = await ModeManager.isTeacherMode();
                setIsTeacherMode(teacherMode);

                // Verificar configuración del LLM (API key y modelo)
                const allData = await chrome.storage.local.get(null);
                const configData = allData["config"];
                const hasLLMConfig =
                    configData &&
                    configData.providerKeys &&
                    configData.providerKeys.length > 0 &&
                    configData.providerKeys[configData.selectedProvider || 0] &&
                    configData.providerKeys[configData.selectedProvider || 0].trim() !== "" &&
                    configData.selectedModel &&
                    configData.selectedModel.trim() !== "";
                setMissingLLMConfig(!hasLLMConfig);

                if (!teacherMode) {
                    const hasAssistantConfig = Object.keys(allData).some(key => key.startsWith("assistant_config_"));
                    const hasExerciseData = Object.keys(allData).some(key => key.startsWith("exercise_data_"));
                    const hasLabData = Object.keys(allData).some(key => key.startsWith("lab_data_"));
                    const hasConfig = hasAssistantConfig && (hasExerciseData || hasLabData);
                    setNeedsConfiguration(!hasConfig);
                } else {
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

    const handleConfigLoaded = async () => {
        setReloadKey(prev => prev + 1);

        if (pageId) {
            await loadExercises();
            await loadExercisesWithExplanations();
            await loadExercisesWithEvaluations();
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
                content: "Error al generar la respuesta. Por favor, inténtalo de nuevo.",
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
                transition: "right 0.3s ease-in-out",
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
                    top: "20px",
                    width: "40px",
                    height: "40px",
                    backgroundColor: "#007bff",
                    color: "white",
                    border: "none",
                    borderRadius: "4px 0 0 4px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "16px",
                    boxShadow: "-2px 0 8px rgba(0,0,0,0.1)",
                }}
                title={isCollapsed ? "Expandir barra lateral" : "Colapsar barra lateral"}
            >
                {isCollapsed ? "◀" : "▶"}
            </button>

            {/* Header */}
            <div className="card-header bg-light border-bottom">
                <div className="d-flex justify-content-between align-items-start mb-2">
                    <div className="d-flex align-items-center">
                        <img
                            src={chrome.runtime.getURL("icons/icon128.png")}
                            alt="DBot Icon"
                            style={{ width: "48px", height: "48px", marginRight: "16px" }}
                        />
                        <h2 className="h2 mb-0">{APP_CONFIG.NAME}</h2>
                    </div>
                    {/* Botón para identificar/generar ejercicios - solo visible si hay pageId */}
                    {pageId && !needsConfiguration && (
                        <button
                            type="button"
                            className="btn btn-sm btn-outline-primary"
                            onClick={onIdentifyExercises}
                            disabled={isLoadingExercises}
                            title={exercises.length > 0 ? "Re-generar ejercicios" : "Identificar ejercicios"}
                        >
                            {isLoadingExercises ? (
                                <>
                                    <span
                                        className="spinner-border spinner-border-sm me-1"
                                        role="status"
                                        aria-hidden="true"
                                    ></span>
                                    Analizando...
                                </>
                            ) : (
                                <>
                                    <i className="bi bi-arrow-clockwise me-1"></i>
                                    {exercises.length > 0 ? "Re-identificar ejercicios" : "Identificar ejercicios"}
                                </>
                            )}
                        </button>
                    )}
                </div>

                {/* Pestañas */}
                {!needsConfiguration && (
                    <ul className="nav nav-tabs mt-3 mb-0" role="tablist" key={`tabs-${isTeacherMode}-${reloadKey}`}>
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
                        {/* Pestañas solo disponibles cuando hay ejercicios */}
                        {exercises.length > 0 && (
                            <>
                                <li className="nav-item" role="presentation">
                                    <button
                                        className={`nav-link ${activeTab === "explanations" ? "active" : ""}`}
                                        onClick={() => setActiveTab("explanations")}
                                        type="button"
                                        role="tab"
                                        disabled={isLabBlocked}
                                        title={
                                            isLabBlocked ? "No disponible mientras el laboratorio esté bloqueado" : ""
                                        }
                                    >
                                        Explicaciones guardadas
                                        {exercisesWithExplanations.length > 0 && (
                                            <span className="badge bg-primary ms-2">
                                                {exercisesWithExplanations.length}
                                            </span>
                                        )}
                                    </button>
                                </li>
                                <li className="nav-item" role="presentation">
                                    <button
                                        className={`nav-link ${activeTab === "evaluations" ? "active" : ""}`}
                                        onClick={() => setActiveTab("evaluations")}
                                        type="button"
                                        role="tab"
                                        disabled={isLabBlocked}
                                        title={
                                            isLabBlocked ? "No disponible mientras el laboratorio esté bloqueado" : ""
                                        }
                                    >
                                        Ejercicios solucionados
                                        {exercisesWithEvaluations.length > 0 && (
                                            <span className="badge bg-success ms-2">
                                                {exercisesWithEvaluations.length}
                                            </span>
                                        )}
                                    </button>
                                </li>
                                {/* Solo mostrar pestaña de configuración de ejercicios en modo profesor */}
                                {isTeacherMode && (
                                    <li className="nav-item" role="presentation">
                                        <button
                                            className={`nav-link ${activeTab === "config" ? "active" : ""}`}
                                            onClick={() => setActiveTab("config")}
                                            type="button"
                                            role="tab"
                                        >
                                            Configurar ejercicios
                                        </button>
                                    </li>
                                )}
                            </>
                        )}
                        {/* Pestaña de laboratorios solo visible en modo profesor */}
                        {courseId && isTeacherMode && (
                            <li className="nav-item" role="presentation">
                                <button
                                    className={`nav-link ${activeTab === "labs" ? "active" : ""}`}
                                    onClick={() => setActiveTab("labs")}
                                    type="button"
                                    role="tab"
                                >
                                    Configurar laboratorios
                                </button>
                            </li>
                        )}
                        {/* Pestaña de progreso solo para modo profesor */}
                        {/* Pestaña de progreso visible para todos si hay courseId */}
                        {courseId && (
                            <li className="nav-item" role="presentation">
                                <button
                                    className={`nav-link ${activeTab === "progress" ? "active" : ""}`}
                                    onClick={() => setActiveTab("progress")}
                                    type="button"
                                    role="tab"
                                >
                                    Mi progreso
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
                                <span className="visually-hidden">Verificando configuración...</span>
                            </div>
                            <p className="text-muted">Verificando configuración...</p>
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
                                            <span className="visually-hidden">Verificando acceso...</span>
                                        </div>
                                        <strong>Verificando acceso al laboratorio...</strong>
                                    </div>
                                </div>
                            </div>
                        ) : isLabBlocked ? (
                            <div className="alert alert-danger" role="alert">
                                <h5 className="alert-heading">
                                    <i className="bi bi-lock-fill me-2"></i>
                                    Laboratorio bloqueado
                                </h5>
                                <p>
                                    Este laboratorio está bloqueado porque es un laboratorio requerido y aún no has
                                    completado el laboratorio anterior.
                                </p>
                                <hr />
                                <p className="mb-0">
                                    <strong>Para desbloquear este laboratorio:</strong>
                                </p>
                                <ul className="mb-0 mt-2">
                                    <li>Completa los ejercicios de reto requeridos del laboratorio anterior</li>
                                    <li>
                                        Cumple los criterios definidos por tu profesor en las opciones de la extensión o
                                        consulta los detalles en "Mi progreso"
                                    </li>
                                    <li>Revisa tu progreso en la pestaña "Mi progreso"</li>
                                </ul>
                            </div>
                        ) : isLoadingExercises ? (
                            <div className="card border-primary">
                                <div className="card-body p-3">
                                    <div className="d-flex align-items-center mb-2">
                                        <div className="spinner-border spinner-border-sm text-primary me-2">
                                            <span className="visually-hidden">Cargando...</span>
                                        </div>
                                        <strong>Buscando ejercicios...</strong>
                                    </div>
                                    <p className="text-muted small mb-0">
                                        Analizando el contenido de la página para identificar los ejercicios
                                        disponibles.
                                    </p>
                                </div>
                            </div>
                        ) : pageId && !hasExercisesLoaded && !isLoadingExercises ? (
                            <>
                                <div className="alert alert-warning" role="alert">
                                    <h6 className="alert-heading mb-2">
                                        <i className="bi bi-exclamation-triangle me-2"></i>
                                        No hay ejercicios cargados
                                    </h6>
                                    <p className="mb-3 small">
                                        Para poder usar el chat con el contexto de los ejercicios, primero debes
                                        identificarlos.
                                    </p>
                                    <button
                                        type="button"
                                        className="btn btn-primary btn-sm"
                                        onClick={onIdentifyExercises}
                                    >
                                        <i className="bi bi-play-circle me-1"></i>
                                        Identificar ejercicios ahora
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
                                                Identificar ejercicios
                                            </h6>
                                            <p className="card-text small text-muted mb-3">
                                                Presiona el botón para analizar la página e identificar los ejercicios
                                                disponibles.
                                            </p>
                                            <button
                                                type="button"
                                                className="btn btn-primary btn-sm"
                                                onClick={onIdentifyExercises}
                                            >
                                                <i className="bi bi-play-circle me-1"></i>
                                                Identificar ejercicios
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
                                                <strong>{message.role === "user" ? "Tú" : "Asistente"}</strong>
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
                                            aria-label="Generando respuesta"
                                        >
                                            <span className="visually-hidden">Cargando...</span>
                                        </div>
                                        <span className="small">Generando respuesta...</span>
                                    </div>
                                </div>
                            </div>
                        )}
                        {/* Elemento de referencia para scroll automático */}
                        <div ref={messagesEndRef} />
                    </>
                ) : activeTab === "explanations" ? (
                    <>
                        {/* Pestaña de explicaciones guardadas */}
                        {isLoadingExplanations ? (
                            <div className="card border-primary">
                                <div className="card-body p-3">
                                    <div className="d-flex align-items-center">
                                        <div className="spinner-border spinner-border-sm text-primary me-2">
                                            <span className="visually-hidden">Cargando...</span>
                                        </div>
                                        <span>Cargando explicaciones...</span>
                                    </div>
                                </div>
                            </div>
                        ) : exercisesWithExplanations.length === 0 ? (
                            <div className="alert alert-info" role="alert">
                                <strong>No hay explicaciones guardadas</strong>
                                <p className="mb-0 mt-2 small">
                                    Las explicaciones generadas a través del chat se guardarán aquí para que puedas
                                    acceder a ellas más tarde.
                                </p>
                            </div>
                        ) : (
                            <div className="list-group">
                                {exercisesWithExplanations.map((exerciseName, index) => (
                                    <button
                                        key={index}
                                        type="button"
                                        className="list-group-item list-group-item-action"
                                        onClick={() => handleExplanationClick(exerciseName)}
                                    >
                                        <div className="d-flex w-100 justify-content-between align-items-center">
                                            <h6 className="mb-0">{exerciseName}</h6>
                                            <span className="badge bg-primary">Ver explicación</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </>
                ) : activeTab === "evaluations" ? (
                    <>
                        {/* Pestaña de evaluaciones guardadas */}
                        {isLoadingEvaluations ? (
                            <div className="card border-primary">
                                <div className="card-body p-3">
                                    <div className="d-flex align-items-center">
                                        <div className="spinner-border spinner-border-sm text-primary me-2">
                                            <span className="visually-hidden">Cargando...</span>
                                        </div>
                                        <span>Cargando evaluaciones...</span>
                                    </div>
                                </div>
                            </div>
                        ) : exercisesWithEvaluations.length === 0 ? (
                            <div className="alert alert-info" role="alert">
                                <strong>No hay evaluaciones guardadas</strong>
                                <p className="mb-0 mt-2 small">
                                    Las evaluaciones de tus soluciones se guardarán aquí para que puedas consultar tu
                                    progreso y revisar el feedback recibido.
                                </p>
                            </div>
                        ) : (
                            <div className="list-group">
                                {exercisesWithEvaluations.map((exerciseName, index) => (
                                    <button
                                        key={index}
                                        type="button"
                                        className="list-group-item list-group-item-action"
                                        onClick={() => handleEvaluationClick(exerciseName)}
                                    >
                                        <div className="d-flex w-100 justify-content-between align-items-center">
                                            <h6 className="mb-0">{exerciseName}</h6>
                                            <span className="badge bg-success">Ver evaluaciones</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </>
                ) : activeTab === "config" ? (
                    <>
                        {/* Pestaña de configuración de ejercicios */}
                        <ExerciseConfigTab
                            exercises={exercises}
                            pageId={pageId || ""}
                            onConfigUpdate={handleConfigUpdate}
                            isActive={activeTab === "config"}
                        />
                    </>
                ) : activeTab === "labs" ? (
                    <>
                        {/* Pestaña de configuración de laboratorios */}
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
                            title="Enviar mensaje"
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
                            title="Reiniciar conversación"
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
