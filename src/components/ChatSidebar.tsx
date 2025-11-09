import React, { useState } from "react";
import { ProgressManager } from "../util/progress/ProgressManager";
import ExerciseConfigTab from "./ExerciseConfigTab";
import LabConfigTab from "./LabConfigTab";
import ProgressTab from "./ProgressTab";

interface Exercise {
    name: string;
    statement: string;
    allowed?: boolean;
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
    courseName: string;
    providerName: string;
    modelName: string;
    onClose: () => void;
    isLoadingExercises?: boolean;
    pageId?: string;
    courseId?: string; // Añadido para la configuración de laboratorios
    onOpenExplanation?: (exerciseName: string) => void;
    onExplanationGenerated?: () => void; // Callback para recargar lista cuando se genera explicación
    onOpenEvaluation?: (exerciseName: string) => void;
    onEvaluationGenerated?: () => void; // Callback para recargar lista cuando se genera evaluación
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({
    courseName,
    providerName,
    modelName,
    onClose,
    isLoadingExercises = false,
    pageId,
    courseId,
    onOpenExplanation,
    onExplanationGenerated,
    onOpenEvaluation,
    onEvaluationGenerated,
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

    // Verificar si el laboratorio está bloqueado
    React.useEffect(() => {
        const checkLabBlocked = async () => {
            if (!pageId || !courseId) {
                setIsLabBlocked(false);
                setIsCheckingBlocked(false);
                return;
            }

            setIsCheckingBlocked(true);
            try {
                const blocked = await ProgressManager.isLabBlocked(pageId, courseId);
                setIsLabBlocked(blocked);
            } catch (error) {
                console.error("[ChatSidebar] Error checking if lab is blocked:", error);
                setIsLabBlocked(false);
            } finally {
                setIsCheckingBlocked(false);
            }
        };

        checkLabBlocked();
    }, [pageId, courseId]);

    // Cargar ejercicios cuando cambie pageId
    React.useEffect(() => {
        if (pageId) {
            loadExercises();
            loadExercisesWithExplanations();
            loadExercisesWithEvaluations();
        }
    }, [pageId]);

    // Cargar historial del chat al inicio
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
                        }))
                    );
                }
            } catch (error) {
                console.error("Error loading updated exercises:", error);
            }
        }

        // Recargar lista de explicaciones
        await loadExercisesWithExplanations();

        // Limpiar el historial del chat para forzar regeneración con nuevo prompt
        setMessages([]);

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
                <h3 className="h5 mb-2">Asistente IA</h3>
                <p className="small text-muted mb-1">
                    <strong>Curso:</strong> {courseName}
                </p>
                <p className="small text-muted mb-0">
                    <strong>Proveedor:</strong> {providerName} | <strong>Modelo:</strong> {modelName}
                </p>

                {/* Pestañas */}
                <ul className="nav nav-tabs mt-3 mb-0" role="tablist">
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
                                    title={isLabBlocked ? "No disponible mientras el laboratorio esté bloqueado" : ""}
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
                                    title={isLabBlocked ? "No disponible mientras el laboratorio esté bloqueado" : ""}
                                >
                                    Evaluaciones guardadas
                                    {exercisesWithEvaluations.length > 0 && (
                                        <span className="badge bg-success ms-2">{exercisesWithEvaluations.length}</span>
                                    )}
                                </button>
                            </li>
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
                        </>
                    )}
                    {/* Pestaña de laboratorios siempre visible si hay courseId */}
                    {courseId && (
                        <>
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
                        </>
                    )}
                </ul>
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
                {activeTab === "chat" ? (
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
                                    <li>Completa todos los ejercicios de reto del laboratorio anterior</li>
                                    <li>Obtén una calificación mínima de 5.0 en cada ejercicio de reto</li>
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
                        ) : messages.length === 0 ? (
                            <div className="alert alert-info" role="alert">
                                ¡Hola! Pregúntame sobre el curso y te ayudaré.
                            </div>
                        ) : (
                            messages.map(message => {
                                // Mensaje de tipo tool (resultado de herramienta) - recuadro amarillo sin título
                                if (message.role === "tool") {
                                    return (
                                        <div key={message.id} className="card bg-warning bg-opacity-25 border-warning">
                                            <div className="card-body p-2">
                                                <div className="small" style={{ whiteSpace: "pre-wrap" }}>
                                                    {message.content}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }

                                // Ignorar mensajes del asistente con tool_calls (no mostrarlos)
                                if (
                                    message.role === "assistant" &&
                                    message.tool_calls &&
                                    message.tool_calls.length > 0
                                ) {
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
                            placeholder={
                                isLabBlocked
                                    ? "Laboratorio bloqueado..."
                                    : isLoadingExercises
                                    ? "Cargando ejercicios..."
                                    : "Escribe tu pregunta..."
                            }
                            value={inputValue}
                            onChange={e => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={isGenerating || isLoadingExercises || isLabBlocked}
                            rows={4}
                            style={{ resize: "none", overflow: "auto", flex: 1 }}
                        />
                        <button
                            className="btn btn-primary"
                            type="button"
                            onClick={handleSendMessage}
                            disabled={isGenerating || !inputValue.trim() || isLoadingExercises || isLabBlocked}
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
                            style={{
                                background: "transparent",
                                border: "none",
                                padding: "8px",
                                cursor: "pointer",
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
