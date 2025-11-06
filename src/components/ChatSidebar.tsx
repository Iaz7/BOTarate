import React, { useState } from "react";

interface Exercise {
    name: string;
    statement: string;
}

interface ChatMessage {
    role: "user" | "assistant";
    content: string;
    id: string;
}

interface ChatSidebarProps {
    courseName: string;
    providerName: string;
    modelName: string;
    onClose: () => void;
    isLoadingExercises?: boolean;
    exercises?: Exercise[];
    pageId?: string;
    onOpenExplanation?: (exerciseName: string) => void;
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({
    courseName,
    providerName,
    modelName,
    onClose,
    isLoadingExercises = false,
    exercises = [],
    pageId,
    onOpenExplanation,
}) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState<string>("");
    const [isGenerating, setIsGenerating] = useState<boolean>(false);
    const [activeTab, setActiveTab] = useState<"chat" | "explanations">("chat");
    const [exercisesWithExplanations, setExercisesWithExplanations] = useState<string[]>([]);
    const [isLoadingExplanations, setIsLoadingExplanations] = useState(false);

    // Cargar ejercicios con explicaciones cuando haya pageId y ejercicios
    React.useEffect(() => {
        if (pageId && exercises.length > 0) {
            loadExercisesWithExplanations();
        }
    }, [pageId, exercises]);

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

    const handleExplanationClick = (exerciseName: string) => {
        if (onOpenExplanation) {
            onOpenExplanation(exerciseName);
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
                resetHistory: messages.length === 0,
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

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
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

                {/* Pestañas (solo mostrar si hay ejercicios) */}
                {exercises.length > 0 && (
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
                        <li className="nav-item" role="presentation">
                            <button
                                className={`nav-link ${activeTab === "explanations" ? "active" : ""}`}
                                onClick={() => setActiveTab("explanations")}
                                type="button"
                                role="tab"
                            >
                                Explicaciones guardadas
                                {exercisesWithExplanations.length > 0 && (
                                    <span className="badge bg-primary ms-2">{exercisesWithExplanations.length}</span>
                                )}
                            </button>
                        </li>
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
                {activeTab === "chat" ? (
                    <>
                        {isLoadingExercises ? (
                            <div className="card border-primary">
                                <div className="card-body p-3">
                                    <div className="d-flex align-items-center mb-2">
                                        <div
                                            className="spinner-border spinner-border-sm text-primary me-2"
                                            role="status"
                                        >
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
                            messages.map(message => (
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
                            ))
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
                ) : (
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
                )}
            </div>

            {/* Input de chat */}
            <div className="card-footer bg-light border-top">
                <div className="input-group">
                    <input
                        type="text"
                        className="form-control"
                        placeholder={isLoadingExercises ? "Cargando ejercicios..." : "Escribe tu pregunta..."}
                        value={inputValue}
                        onChange={e => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={isGenerating || isLoadingExercises}
                    />
                    <button
                        className="btn btn-primary"
                        type="button"
                        onClick={handleSendMessage}
                        disabled={isGenerating || !inputValue.trim() || isLoadingExercises}
                    >
                        Enviar
                    </button>
                </div>
                <button onClick={onClose} className="btn btn-outline-danger btn-sm w-100 mt-2">
                    Cerrar extensión
                </button>
            </div>
        </div>
    );
};

export default ChatSidebar;
