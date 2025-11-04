import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
    exercises: Exercise[];
    isOpen: boolean;
    onClose: () => void;
    dbSchema?: string | null;
    sqlInstructions?: string[];
    learningObjectives?: string;
}

const ExerciseModal: React.FC<ExerciseModalProps> = ({ 
    exercises, 
    isOpen, 
    onClose, 
    dbSchema,
    sqlInstructions,
    learningObjectives
}) => {
    const [selectedExerciseIndex, setSelectedExerciseIndex] = useState<number>(0);
    const [explanation, setExplanation] = useState<Explanation | null>(null);
    const [isLoadingExplanation, setIsLoadingExplanation] = useState<boolean>(false);
    const [explanationError, setExplanationError] = useState<string | null>(null);

    if (!isOpen) return null;

    const selectedExercise = exercises[selectedExerciseIndex];

    const handleExerciseChange = (index: number) => {
        setSelectedExerciseIndex(index);
        setExplanation(null);
        setExplanationError(null);
    };

    const handleGenerateExplanation = async () => {
        setIsLoadingExplanation(true);
        setExplanationError(null);

        try {
            const response = await chrome.runtime.sendMessage({
                action: 'generateExplanation',
                exerciseName: selectedExercise.name,
                exerciseStatement: selectedExercise.statement,
                db_schema: dbSchema || undefined,
                sql_instructions: sqlInstructions || undefined,
                learning_objectives: learningObjectives || undefined
            });

            if (response.success) {
                setExplanation(response.explanation);
            } else {
                setExplanationError(response.error || 'Error al generar la explicación');
            }
        } catch (error) {
            console.error('Error al generar explicación:', error);
            setExplanationError('Error de comunicación con el asistente');
        } finally {
            setIsLoadingExplanation(false);
        }
    };

    return (
        <div
            className="card shadow-lg border-primary"
            style={{
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '90%',
                maxWidth: '1400px',
                height: '85vh',
                zIndex: 10000,
                overflow: 'hidden'
            }}
        >
            {/* Header */}
            <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
                <h3 className="h5 mb-0">📝 Ejercicios ({exercises.length})</h3>
                <button
                    onClick={onClose}
                    className="btn btn-sm btn-light"
                    title="Cerrar"
                >
                    ✕
                </button>
            </div>

            {/* Content */}
            <div className="d-flex" style={{ flex: 1, overflow: 'hidden', height: 'calc(85vh - 60px)' }}>
                {/* Columna izquierda - Lista de ejercicios */}
                <div className="bg-light border-end p-3" style={{ width: '280px', overflowY: 'auto' }}>
                    <h4 className="h6 text-muted mb-3">EJERCICIOS</h4>
                    <div className="d-flex flex-column gap-2">
                        {exercises.map((exercise, index) => (
                            <button
                                key={`exercise-${exercise.name}-${index}`}
                                onClick={() => handleExerciseChange(index)}
                                className={`btn btn-sm text-start ${
                                    selectedExerciseIndex === index ? 'btn-primary' : 'btn-outline-secondary'
                                }`}
                                style={{
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                }}
                                title={exercise.name}
                            >
                                {exercise.name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Título del ejercicio seleccionado */}
                <div className="d-flex flex-column" style={{ flex: 1, overflow: 'hidden' }}>
                    <div className="bg-light border-bottom p-3">
                        <h2 className="h5 mb-0">{selectedExercise.name}</h2>
                    </div>

                    {/* Columnas de Enunciado y Explicación */}
                    <div className="d-flex" style={{ flex: 1, overflow: 'hidden' }}>
                        {/* Columna de Enunciado */}
                        <div className="d-flex flex-column border-end" style={{ flex: 1, overflow: 'hidden' }}>
                            <div className="bg-light border-bottom px-4 py-2">
                                <h3 className="h6 text-muted mb-0">ENUNCIADO</h3>
                            </div>
                            <div className="p-4" style={{ flex: 1, overflowY: 'auto' }}>
                                <div className="exercise-statement">
                                    <ReactMarkdown 
                                        remarkPlugins={[remarkGfm]}
                                        components={{
                                            table: ({node, ...props}) => (
                                                <table className="table table-bordered table-sm mt-2 mb-2" {...props} />
                                            ),
                                            thead: ({node, ...props}) => (
                                                <thead className="table-light" {...props} />
                                            ),
                                            p: ({node, ...props}) => (
                                                <p className="mb-2" {...props} />
                                            ),
                                            h1: ({node, ...props}) => (
                                                <h4 className="mt-3 mb-2" {...props} />
                                            ),
                                            h2: ({node, ...props}) => (
                                                <h5 className="mt-3 mb-2" {...props} />
                                            ),
                                            h3: ({node, ...props}) => (
                                                <h6 className="mt-2 mb-2" {...props} />
                                            ),
                                        }}
                                    >
                                        {selectedExercise.statement}
                                    </ReactMarkdown>
                                </div>
                            </div>
                        </div>

                        {/* Columna de Explicación */}
                        <div className="d-flex flex-column" style={{ flex: 1, overflow: 'hidden' }}>
                            <div className="bg-light border-bottom px-4 py-2">
                                <h3 className="h6 text-muted mb-0">EXPLICACIÓN</h3>
                            </div>
                            <div className="p-4" style={{ flex: 1, overflowY: 'auto' }}>
                                {!explanation && !isLoadingExplanation && !explanationError && (
                                    <div className="d-flex flex-column align-items-center justify-content-center" style={{ minHeight: '200px' }}>
                                        <p className="text-muted mb-3">
                                            Genera una explicación paso a paso para resolver este ejercicio
                                        </p>
                                        <button
                                            onClick={handleGenerateExplanation}
                                            className="btn btn-primary"
                                        >
                                            <span className="me-2">🧑‍🏫</span>
                                            Generar Explicación
                                        </button>
                                    </div>
                                )}

                                {isLoadingExplanation && (
                                    <div className="d-flex flex-column align-items-center justify-content-center" style={{ minHeight: '200px' }}>
                                        <div className="spinner-border text-primary mb-3" role="status">
                                            <span className="visually-hidden">Cargando...</span>
                                        </div>
                                        <p className="text-muted">Generando explicación...</p>
                                    </div>
                                )}

                                {explanationError && (
                                    <div className="alert alert-danger">
                                        <strong>Error:</strong> {explanationError}
                                        <button
                                            onClick={handleGenerateExplanation}
                                            className="btn btn-sm btn-danger mt-2"
                                        >
                                            Reintentar
                                        </button>
                                    </div>
                                )}

                                {explanation && explanation.steps && (
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
                                                            table: ({node, ...props}) => (
                                                                <table className="table table-bordered table-sm mt-2 mb-2" {...props} />
                                                            ),
                                                            thead: ({node, ...props}) => (
                                                                <thead className="table-light" {...props} />
                                                            ),
                                                            p: ({node, ...props}) => (
                                                                <p className="mb-2" {...props} />
                                                            ),
                                                            code: ({node, ...props}) => {
                                                                const inline = (props as any).inline;
                                                                return inline
                                                                    ? <code className="bg-light px-1" {...props} />
                                                                    : <code className="d-block bg-light p-2 rounded" {...props} />;
                                                            },
                                                            pre: ({node, ...props}) => (
                                                                <pre className="bg-light p-3 rounded overflow-auto" {...props} />
                                                            ),
                                                        }}
                                                    >
                                                        {step.explanation}
                                                    </ReactMarkdown>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExerciseModal;
