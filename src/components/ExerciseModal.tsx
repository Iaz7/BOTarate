import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Exercise {
    name: string;
    statement: string;
    isTiquismiqui?: boolean;
}

interface Step {
    content: string;
    title: string;
}

interface Explanation {
    steps: Step[];
}

interface ExerciseModalProps {
    exercise: Exercise;
    isOpen: boolean;
    onClose: () => void;
    pageId?: string;
    courseId?: string;
    loadFromCache?: boolean; // Si es true, carga del cache. Si es false/undefined, genera nueva
    onExplanationGenerated?: () => void; // Callback cuando se genera una nueva explicación
}

interface ChatMessage {
    role: "user" | "assistant";
    content: string;
    id: string;
}

const ExerciseModal: React.FC<ExerciseModalProps> = ({
    exercise,
    isOpen,
    onClose,
    pageId,
    courseId,
    loadFromCache = false,
    onExplanationGenerated,
}) => {
    const [explanation, setExplanation] = useState<Explanation | null>(null);
    const [isLoadingExplanation, setIsLoadingExplanation] = useState<boolean>(false);
    const [explanationError, setExplanationError] = useState<string | null>(null);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState<string>("");
    const [isSendingMessage, setIsSendingMessage] = useState<boolean>(false);
    const [isChatInitialized, setIsChatInitialized] = useState<boolean>(false);

    // Generar automáticamente la explicación al abrir el modal
    React.useEffect(() => {
        if (isOpen) {
            // Resetear el estado al abrir
            setExplanation(null);
            setExplanationError(null);
            setChatMessages([]);
            setChatInput("");
            setIsChatInitialized(false);

            // Decidir si cargar del cache o generar nueva
            if (loadFromCache) {
                handleLoadCachedExplanation();
            } else {
                handleGenerateExplanation();
            }
        }
    }, [isOpen, exercise.name, loadFromCache]); // Regenerar si cambia el ejercicio o el modo

    if (!isOpen) return null;

    const initializeChatContext = async (fromCache: boolean) => {
        if (!pageId) return;

        try {
            const response = await chrome.runtime.sendMessage({
                action: "initializeExplanationChat",
                pageId: pageId,
                exerciseName: exercise.name,
                courseId: courseId,
                fromCache: fromCache,
            });

            if (response.success) {
                setIsChatInitialized(true);
                console.log("Contexto de chat inicializado");
            } else {
                console.error("Error al inicializar chat:", response.error);
            }
        } catch (error) {
            console.error("Error al inicializar chat:", error);
        }
    };

    const handleLoadCachedExplanation = async () => {
        if (!pageId) {
            setExplanationError("No se puede cargar la explicación: falta el ID de página");
            return;
        }

        setIsLoadingExplanation(true);
        setExplanationError(null);

        try {
            const response = await chrome.runtime.sendMessage({
                action: "getCachedExplanation",
                pageId: pageId,
                exerciseName: exercise.name,
            });

            if (response.success) {
                setExplanation(response.explanation);
                console.log("Explicación cargada del cache");

                // Cargar el historial del chat si existe
                if (response.explanation.chatHistory && Array.isArray(response.explanation.chatHistory)) {
                    setChatMessages(response.explanation.chatHistory);
                }

                // Inicializar el contexto del chat para explicaciones cargadas del cache
                await initializeChatContext(true);
            } else {
                const errorMessage = response.error || "No se encontró explicación guardada";
                console.error("Error al cargar explicación del cache:", errorMessage);
                setExplanationError(errorMessage);
            }
        } catch (error) {
            console.error("Error al cargar explicación del cache:", error);
            setExplanationError("Error de comunicación al cargar la explicación");
        } finally {
            setIsLoadingExplanation(false);
        }
    };

    const handleGenerateExplanation = async () => {
        setIsLoadingExplanation(true);
        setExplanationError(null);

        try {
            const response = await chrome.runtime.sendMessage({
                action: "generateExplanation",
                exerciseName: exercise.name,
                pageId: pageId,
                courseId: courseId,
            });

            if (response.success) {
                setExplanation(response.explanation);
                console.log("Explicación generada exitosamente");

                // El contexto ya está en explanationAssistant, no necesitamos inicializar
                setIsChatInitialized(true);

                // Notificar que se generó una nueva explicación
                if (onExplanationGenerated) {
                    onExplanationGenerated();
                }
            } else {
                const errorMessage = response.error || "Error desconocido al generar la explicación";
                console.error("Error al generar explicación:", errorMessage);
                setExplanationError(errorMessage);
            }
        } catch (error) {
            console.error("Error al generar explicación:", error);
            const errorMessage =
                error instanceof Error
                    ? `Error de comunicación: ${error.message}`
                    : "Error de comunicación con el asistente de IA";
            setExplanationError(errorMessage);
        } finally {
            setIsLoadingExplanation(false);
        }
    };

    const handleSendChatMessage = async () => {
        if (!chatInput.trim() || isSendingMessage || !isChatInitialized) return;

        const userMessage: ChatMessage = {
            role: "user",
            content: chatInput,
            id: `user-${Date.now()}`,
        };

        const newMessages = [...chatMessages, userMessage];
        setChatMessages(newMessages);
        setChatInput("");
        setIsSendingMessage(true);

        try {
            const response = await chrome.runtime.sendMessage({
                action: "sendExplanationChatMessage",
                message: chatInput,
            });

            if (response.success) {
                const assistantMessage: ChatMessage = {
                    role: "assistant",
                    content: response.response,
                    id: `assistant-${Date.now()}`,
                };

                const updatedMessages = [...newMessages, assistantMessage];
                setChatMessages(updatedMessages);

                // Guardar el historial actualizado en el storage
                if (pageId) {
                    await chrome.runtime.sendMessage({
                        action: "saveChatHistory",
                        pageId: pageId,
                        exerciseName: exercise.name,
                        chatHistory: updatedMessages,
                    });
                }
            } else {
                const errorMessage: ChatMessage = {
                    role: "assistant",
                    content: `Error: ${response.error || "Error desconocido"}`,
                    id: `error-${Date.now()}`,
                };

                setChatMessages([...newMessages, errorMessage]);
            }
        } catch (error) {
            console.error("Error al enviar mensaje:", error);
            const errorMessage: ChatMessage = {
                role: "assistant",
                content: "Error de comunicación con el asistente de IA",
                id: `error-${Date.now()}`,
            };

            setChatMessages([...newMessages, errorMessage]);
        } finally {
            setIsSendingMessage(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSendChatMessage();
        }
    };

    return (
        <div
            className="card shadow-lg border-primary"
            style={{
                position: "fixed",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: "80vw",
                height: "80vh",
                zIndex: 10000,
                overflow: "hidden",
            }}
        >
            {/* Header */}
            <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
                <h3 className="h5 mb-0">{exercise.name}</h3>
                <button onClick={onClose} className="btn btn-sm btn-light" title="Cerrar">
                    ×
                </button>
            </div>

            {/* Content - Explicación y Chat */}
            <div className="d-flex" style={{ flex: 1, overflow: "hidden", height: "calc(80vh - 60px)" }}>
                {/* Columna izquierda - Explicación */}
                <div className="p-4" style={{ flex: 1, overflowY: "auto", borderRight: "1px solid #dee2e6" }}>
                    {exercise.isTiquismiqui && (
                        <div className="alert alert-warning" role="alert">
                            <strong>⚠️ Ejercicio marcado como tiquismiquis.</strong>
                            <p className="mb-0 mt-1 small">
                                Esta explicación podría no ser completamente correcta. Revisa los pasos detenidamente y
                                consulta con tu profesor si encuentras algo raro.
                            </p>
                        </div>
                    )}
                    {isLoadingExplanation && (
                        <div
                            className="d-flex flex-column align-items-center justify-content-center"
                            style={{ minHeight: "200px" }}
                        >
                            <output className="spinner-border text-primary mb-3">
                                <span className="visually-hidden">Cargando...</span>
                            </output>
                            <p className="text-muted">Generando explicación...</p>
                        </div>
                    )}

                    {explanationError && (
                        <div
                            className="d-flex flex-column align-items-center justify-content-center"
                            style={{ minHeight: "200px" }}
                        >
                            <div className="alert alert-danger w-100" role="alert">
                                <h5 className="alert-heading d-flex align-items-center">
                                    Error al generar la explicación
                                </h5>
                                <hr />
                                <p className="mb-3">{explanationError}</p>
                                <div className="d-flex gap-2">
                                    <button onClick={handleGenerateExplanation} className="btn btn-danger">
                                        Reintentar
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {explanation?.steps && !isLoadingExplanation && (
                        <div className="d-flex flex-column gap-3">
                            {explanation.steps.map((step, index) => (
                                <div key={`step-${index}`} className="card">
                                    <div className="card-header bg-primary text-white">
                                        <h4 className="h6 mb-0">{step.title}</h4>
                                    </div>
                                    <div className="card-body">
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm]}
                                            components={{
                                                table: ({ node, ...props }) => (
                                                    <table
                                                        className="table table-bordered table-sm mt-2 mb-2"
                                                        {...props}
                                                    />
                                                ),
                                                thead: ({ node, ...props }) => (
                                                    <thead className="table-light" {...props} />
                                                ),
                                                p: ({ node, ...props }) => <p className="mb-2" {...props} />,
                                                code: ({ node, ...props }) => {
                                                    const inline = (props as any).inline;
                                                    return inline ? (
                                                        <code className="bg-light px-1" {...props} />
                                                    ) : (
                                                        <code className="d-block bg-light p-2 rounded" {...props} />
                                                    );
                                                },
                                                pre: ({ node, ...props }) => (
                                                    <pre className="bg-light p-3 rounded overflow-auto" {...props} />
                                                ),
                                            }}
                                        >
                                            {step.content}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            ))}
                            <button
                                onClick={() => {
                                    setExplanation(null);
                                    setChatMessages([]);
                                    setIsChatInitialized(false);
                                    handleGenerateExplanation();
                                }}
                                className="btn btn-outline-primary"
                            >
                                Regenerar Explicación
                            </button>
                        </div>
                    )}
                </div>

                {/* Columna derecha - Chat */}
                <div
                    className="d-flex flex-column"
                    style={{ width: "35%", minWidth: "450px", backgroundColor: "#f8f9fa" }}
                >
                    <div className="p-3 border-bottom bg-white">
                        <h6 className="mb-0">💬 Preguntas sobre la explicación</h6>
                        <small className="text-muted">Haz preguntas sobre cualquier paso de la explicación</small>
                    </div>

                    {/* Mensajes del chat */}
                    <div
                        className="p-3"
                        style={{
                            flex: 1,
                            overflowY: "auto",
                            display: "flex",
                            flexDirection: "column",
                            gap: "12px",
                        }}
                    >
                        {!isChatInitialized ? (
                            <div className="alert alert-info" role="alert">
                                <small>Esperando a que se cargue la explicación...</small>
                            </div>
                        ) : chatMessages.length === 0 ? (
                            <div className="alert alert-info" role="alert">
                                <small>¿Tienes alguna duda sobre la explicación? Pregúntame lo que quieras.</small>
                            </div>
                        ) : (
                            chatMessages.map(message => (
                                <div
                                    key={message.id}
                                    className={`card ${message.role === "user" ? "bg-primary text-white" : ""}`}
                                >
                                    <div className="card-body p-2">
                                        <div className="small mb-1">
                                            <strong>{message.role === "user" ? "Tú" : "Asistente"}</strong>
                                        </div>
                                        <div style={{ fontSize: "0.9rem" }}>
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                components={{
                                                    table: ({ node, ...props }) => (
                                                        <table
                                                            className="table table-bordered table-sm mt-2 mb-2"
                                                            {...props}
                                                        />
                                                    ),
                                                    thead: ({ node, ...props }) => (
                                                        <thead className="table-light" {...props} />
                                                    ),
                                                    p: ({ node, ...props }) => <p className="mb-2" {...props} />,
                                                    code: ({ node, ...props }) => {
                                                        const inline = (props as any).inline;
                                                        return inline ? (
                                                            <code className="bg-light px-1 text-dark" {...props} />
                                                        ) : (
                                                            <code
                                                                className="d-block bg-light p-2 rounded text-dark"
                                                                {...props}
                                                            />
                                                        );
                                                    },
                                                    pre: ({ node, ...props }) => (
                                                        <pre
                                                            className="bg-light p-3 rounded overflow-auto text-dark"
                                                            {...props}
                                                        />
                                                    ),
                                                }}
                                            >
                                                {message.content}
                                            </ReactMarkdown>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}

                        {isSendingMessage && (
                            <div className="card border-secondary">
                                <div className="card-body p-2">
                                    <div className="d-flex align-items-center">
                                        <output
                                            className="spinner-border spinner-border-sm me-2"
                                            aria-label="Generando respuesta"
                                        >
                                            <span className="visually-hidden">Cargando...</span>
                                        </output>
                                        <span className="small">Generando respuesta...</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Input del chat */}
                    <div className="p-3 border-top bg-white">
                        <div className="d-flex gap-2 align-items-end">
                            <textarea
                                className="form-control"
                                placeholder={!isChatInitialized ? "Esperando explicación..." : "Escribe tu pregunta..."}
                                value={chatInput}
                                onChange={e => setChatInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                disabled={isSendingMessage || !isChatInitialized}
                                rows={2}
                                style={{ resize: "none", fontSize: "0.9rem" }}
                            />
                            <button
                                className="btn btn-primary btn-sm"
                                type="button"
                                onClick={handleSendChatMessage}
                                disabled={isSendingMessage || !chatInput.trim() || !isChatInitialized}
                                title="Enviar pregunta"
                                style={{
                                    padding: "8px 12px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <svg
                                    width="18"
                                    height="18"
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
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExerciseModal;
