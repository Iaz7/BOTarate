import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Exercise {
    name: string;
    statement: string;
}

interface Step {
    explanation: string;
}

interface Explanation {
    steps: Step[];
}

interface ExerciseModalProps {
    exercise: Exercise;
    isOpen: boolean;
    onClose: () => void;
    dbSchema?: string | null;
    sqlInstructions?: string[];
    learningObjectives?: string;
    pageId?: string;
    loadFromCache?: boolean; // Si es true, carga del cache. Si es false/undefined, genera nueva
    onExplanationGenerated?: () => void; // Callback cuando se genera una nueva explicación
}

const ExerciseModal: React.FC<ExerciseModalProps> = ({
    exercise,
    isOpen,
    onClose,
    dbSchema,
    sqlInstructions,
    learningObjectives,
    pageId,
    loadFromCache = false,
    onExplanationGenerated,
}) => {
    const [explanation, setExplanation] = useState<Explanation | null>(null);
    const [isLoadingExplanation, setIsLoadingExplanation] = useState<boolean>(false);
    const [explanationError, setExplanationError] = useState<string | null>(null);

    // Generar automáticamente la explicación al abrir el modal
    React.useEffect(() => {
        if (isOpen) {
            // Resetear el estado al abrir
            setExplanation(null);
            setExplanationError(null);

            // Decidir si cargar del cache o generar nueva
            if (loadFromCache) {
                handleLoadCachedExplanation();
            } else {
                handleGenerateExplanation();
            }
        }
    }, [isOpen, exercise.name, loadFromCache]); // Regenerar si cambia el ejercicio o el modo

    if (!isOpen) return null;

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
                exerciseStatement: exercise.statement,
                db_schema: dbSchema || undefined,
                sql_instructions: sqlInstructions || undefined,
                learning_objectives: learningObjectives || undefined,
                pageId: pageId || undefined,
            });

            if (response.success) {
                setExplanation(response.explanation);
                console.log("Explicación generada exitosamente");

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

    return (
        <div
            className="card shadow-lg border-primary"
            style={{
                position: "fixed",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: "90%",
                maxWidth: "900px",
                height: "85vh",
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

            {/* Content - Solo la explicación */}
            <div className="d-flex flex-column" style={{ flex: 1, overflow: "hidden", height: "calc(85vh - 60px)" }}>
                <div className="p-4" style={{ flex: 1, overflowY: "auto" }}>
                    {isLoadingExplanation && (
                        <div
                            className="d-flex flex-column align-items-center justify-content-center"
                            style={{ minHeight: "200px" }}
                        >
                            <div className="spinner-border text-primary mb-3" role="status">
                                <span className="visually-hidden">Cargando...</span>
                            </div>
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

                    {explanation && explanation.steps && !isLoadingExplanation && (
                        <div className="d-flex flex-column gap-3">
                            {explanation.steps.map((step, index) => (
                                <div key={`step-${index}`} className="card">
                                    <div className="card-header bg-primary text-white">
                                        <h4 className="h6 mb-0">Paso {index + 1}</h4>
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
                                            {step.explanation}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            ))}
                            <button
                                onClick={() => {
                                    setExplanation(null);
                                    handleGenerateExplanation();
                                }}
                                className="btn btn-outline-primary"
                            >
                                Regenerar Explicación
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ExerciseModal;
