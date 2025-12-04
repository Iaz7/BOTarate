import React, { useEffect, useState } from "react";

type VerbosityLevel = "low" | "medium" | "high";
type ReasoningEffort = "minimal" | "low" | "medium" | "high";

interface Lab {
    id: string;
    name: string;
    required: boolean;
    verbosity?: VerbosityLevel;
    reasoningEffort?: ReasoningEffort;
}

interface LabConfigTabProps {
    courseId: string;
    onConfigUpdate?: () => void;
    isActive: boolean;
}

interface PendingChanges {
    required?: boolean;
    verbosity?: VerbosityLevel;
    reasoningEffort?: ReasoningEffort;
}

const LabConfigTab: React.FC<LabConfigTabProps> = ({ courseId, onConfigUpdate, isActive }) => {
    const [labs, setLabs] = useState<Lab[]>([]);
    const [labConfig, setLabConfig] = useState<
        Map<string, { required: boolean; verbosity: VerbosityLevel; reasoningEffort: ReasoningEffort }>
    >(new Map());
    const [pendingChanges, setPendingChanges] = useState<Map<string, PendingChanges>>(new Map());
    const [isSaving, setIsSaving] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedLab, setExpandedLab] = useState<string | null>(null);

    // Cargar configuración inicial desde el storage cuando se activa la pestaña
    useEffect(() => {
        if (isActive && courseId) {
            loadConfigFromStorage();
        }
    }, [isActive, courseId]);

    const loadConfigFromStorage = async () => {
        setIsLoading(true);
        try {
            // Obtener datos actualizados del storage
            const response = await chrome.runtime.sendMessage({
                action: "getLabData",
                courseId: courseId,
            });

            if (response.success && response.data?.labs) {
                setLabs(response.data.labs);

                const config = new Map<
                    string,
                    { required: boolean; verbosity: VerbosityLevel; reasoningEffort: ReasoningEffort }
                >();
                for (const lab of response.data.labs) {
                    config.set(lab.id, {
                        required: lab.required ?? false,
                        verbosity: lab.verbosity ?? "medium",
                        reasoningEffort: lab.reasoningEffort ?? "medium",
                    });
                }
                setLabConfig(config);
                setPendingChanges(new Map());
                setHasUnsavedChanges(false);
            }
        } catch (error) {
            console.error("Error loading lab config from storage:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleRequired = (labId: string) => {
        const currentConfig = labConfig.get(labId);
        const newValue = !(currentConfig?.required ?? false);

        // Actualizar estado local
        setLabConfig(prev => {
            const newConfig = new Map(prev);
            const current = newConfig.get(labId);
            if (current) {
                newConfig.set(labId, { ...current, required: newValue });
            }
            return newConfig;
        });

        // Marcar como cambio pendiente
        setPendingChanges(prev => {
            const newChanges = new Map(prev);
            const current = newChanges.get(labId) || {};
            newChanges.set(labId, { ...current, required: newValue });
            return newChanges;
        });

        setHasUnsavedChanges(true);
    };

    const handleVerbosityChange = (labId: string, verbosity: VerbosityLevel) => {
        // Actualizar estado local
        setLabConfig(prev => {
            const newConfig = new Map(prev);
            const current = newConfig.get(labId);
            if (current) {
                newConfig.set(labId, { ...current, verbosity });
            }
            return newConfig;
        });

        // Marcar como cambio pendiente
        setPendingChanges(prev => {
            const newChanges = new Map(prev);
            const current = newChanges.get(labId) || {};
            newChanges.set(labId, { ...current, verbosity });
            return newChanges;
        });

        setHasUnsavedChanges(true);
    };

    const handleReasoningChange = (labId: string, reasoningEffort: ReasoningEffort) => {
        // Actualizar estado local
        setLabConfig(prev => {
            const newConfig = new Map(prev);
            const current = newConfig.get(labId);
            if (current) {
                newConfig.set(labId, { ...current, reasoningEffort });
            }
            return newConfig;
        });

        // Marcar como cambio pendiente
        setPendingChanges(prev => {
            const newChanges = new Map(prev);
            const current = newChanges.get(labId) || {};
            newChanges.set(labId, { ...current, reasoningEffort });
            return newChanges;
        });

        setHasUnsavedChanges(true);
    };

    const toggleExpand = (labId: string) => {
        setExpandedLab(prev => (prev === labId ? null : labId));
    };

    const handleSaveChanges = async () => {
        if (pendingChanges.size === 0) return;

        setIsSaving(true);
        try {
            // Guardar todos los cambios
            for (const [labId, changes] of pendingChanges) {
                if (changes.required !== undefined) {
                    await chrome.runtime.sendMessage({
                        action: "updateLabRequired",
                        courseId: courseId,
                        labId: labId,
                        required: changes.required,
                    });
                }
                if (changes.verbosity !== undefined) {
                    await chrome.runtime.sendMessage({
                        action: "updateLabVerbosity",
                        courseId: courseId,
                        labId: labId,
                        verbosity: changes.verbosity,
                    });
                }
                if (changes.reasoningEffort !== undefined) {
                    await chrome.runtime.sendMessage({
                        action: "updateLabReasoningEffort",
                        courseId: courseId,
                        labId: labId,
                        reasoningEffort: changes.reasoningEffort,
                    });
                }
            }

            // Limpiar cambios pendientes
            setPendingChanges(new Map());
            setHasUnsavedChanges(false);

            // Notificar al padre si es necesario
            if (onConfigUpdate) {
                onConfigUpdate();
            }

            alert("Configuración de laboratorios guardada correctamente.");
        } catch (error) {
            console.error("Error saving lab config:", error);
            alert("Error al guardar la configuración. Por favor, inténtalo de nuevo.");
        } finally {
            setIsSaving(false);
        }
    };

    const renderVerbositySelector = (labId: string, currentVerbosity: VerbosityLevel) => (
        <div className="mb-2">
            <label className="form-label small text-muted mb-1">Verbosidad</label>
            <div className="btn-group" role="group" aria-label="Nivel de verbosidad">
                <input
                    type="radio"
                    className="btn-check"
                    name={`verbosity-${labId}`}
                    id={`verbosity-low-${labId}`}
                    autoComplete="off"
                    checked={currentVerbosity === "low"}
                    onChange={() => handleVerbosityChange(labId, "low")}
                    disabled={isSaving}
                />
                <label
                    className="btn btn-outline-primary"
                    htmlFor={`verbosity-low-${labId}`}
                    title="Respuestas concisas y directas"
                >
                    Bajo
                </label>
                <input
                    type="radio"
                    className="btn-check"
                    name={`verbosity-${labId}`}
                    id={`verbosity-medium-${labId}`}
                    autoComplete="off"
                    checked={currentVerbosity === "medium"}
                    onChange={() => handleVerbosityChange(labId, "medium")}
                    disabled={isSaving}
                />
                <label
                    className="btn btn-outline-primary"
                    htmlFor={`verbosity-medium-${labId}`}
                    title="Nivel de detalle equilibrado"
                >
                    Medio
                </label>
                <input
                    type="radio"
                    className="btn-check"
                    name={`verbosity-${labId}`}
                    id={`verbosity-high-${labId}`}
                    autoComplete="off"
                    checked={currentVerbosity === "high"}
                    onChange={() => handleVerbosityChange(labId, "high")}
                    disabled={isSaving}
                />
                <label
                    className="btn btn-outline-primary"
                    htmlFor={`verbosity-high-${labId}`}
                    title="Explicaciones detalladas y extensas"
                >
                    Alto
                </label>
            </div>
        </div>
    );

    const renderReasoningSelector = (labId: string, currentReasoning: ReasoningEffort) => (
        <div className="mb-2">
            <label className="form-label small text-muted mb-1">Esfuerzo de razonamiento</label>
            <div className="btn-group" role="group" aria-label="Esfuerzo de razonamiento">
                <input
                    type="radio"
                    className="btn-check"
                    name={`reasoning-${labId}`}
                    id={`reasoning-minimal-${labId}`}
                    autoComplete="off"
                    checked={currentReasoning === "minimal"}
                    onChange={() => handleReasoningChange(labId, "minimal")}
                    disabled={isSaving}
                />
                <label
                    className="btn btn-outline-primary"
                    htmlFor={`reasoning-minimal-${labId}`}
                    title="Respuesta directa sin razonamiento"
                >
                    Mínimo
                </label>
                <input
                    type="radio"
                    className="btn-check"
                    name={`reasoning-${labId}`}
                    id={`reasoning-low-${labId}`}
                    autoComplete="off"
                    checked={currentReasoning === "low"}
                    onChange={() => handleReasoningChange(labId, "low")}
                    disabled={isSaving}
                />
                <label
                    className="btn btn-outline-primary"
                    htmlFor={`reasoning-low-${labId}`}
                    title="Razonamiento básico"
                >
                    Bajo
                </label>
                <input
                    type="radio"
                    className="btn-check"
                    name={`reasoning-${labId}`}
                    id={`reasoning-medium-${labId}`}
                    autoComplete="off"
                    checked={currentReasoning === "medium"}
                    onChange={() => handleReasoningChange(labId, "medium")}
                    disabled={isSaving}
                />
                <label
                    className="btn btn-outline-primary"
                    htmlFor={`reasoning-medium-${labId}`}
                    title="Razonamiento moderado"
                >
                    Medio
                </label>
                <input
                    type="radio"
                    className="btn-check"
                    name={`reasoning-${labId}`}
                    id={`reasoning-high-${labId}`}
                    autoComplete="off"
                    checked={currentReasoning === "high"}
                    onChange={() => handleReasoningChange(labId, "high")}
                    disabled={isSaving}
                />
                <label
                    className="btn btn-outline-primary"
                    htmlFor={`reasoning-high-${labId}`}
                    title="Razonamiento detallado paso a paso"
                >
                    Alto
                </label>
            </div>
        </div>
    );

    if (isLoading) {
        return (
            <div className="text-center py-4">
                <output className="spinner-border">
                    <span className="visually-hidden">Cargando laboratorios...</span>
                </output>
                <p className="mt-2 text-muted small">Cargando laboratorios...</p>
            </div>
        );
    }

    if (labs.length === 0) {
        return (
            <div className="alert alert-info" role="alert">
                <strong>No hay laboratorios disponibles</strong>
                <p className="mb-0 mt-2 small">
                    No se encontraron recursos de tipo "página" en el curso que puedan ser configurados como
                    laboratorios.
                </p>
            </div>
        );
    }

    return (
        <div>
            <div className="alert alert-info small mb-3" role="alert">
                <strong>Configuración de laboratorios</strong>
                <p className="mb-0 mt-1">
                    Configura cada laboratorio con sus opciones de nivel requerido, verbosidad y razonamiento. Haz clic
                    en un laboratorio para expandir sus opciones de configuración del asistente de explicaciones.
                </p>
            </div>

            <div className="accordion" id="labAccordion">
                {labs.map((lab, index) => {
                    const config = labConfig.get(lab.id);
                    const isRequired = config?.required ?? false;
                    const verbosity = config?.verbosity ?? "medium";
                    const reasoningEffort = config?.reasoningEffort ?? "medium";
                    const isExpanded = expandedLab === lab.id;

                    return (
                        <div className="accordion-item" key={lab.id}>
                            <h2 className="accordion-header">
                                <button
                                    className={`accordion-button ${isExpanded ? "" : "collapsed"} py-2`}
                                    type="button"
                                    onClick={() => toggleExpand(lab.id)}
                                    aria-expanded={isExpanded}
                                >
                                    <div className="d-flex align-items-center flex-grow-1 me-2">
                                        <span className="badge bg-secondary me-2">#{index + 1}</span>
                                        <span className="text-truncate">{lab.name}</span>
                                        {isRequired && <span className="badge bg-primary ms-2">Requerido</span>}
                                    </div>
                                </button>
                            </h2>
                            <div className={`accordion-collapse collapse ${isExpanded ? "show" : ""}`}>
                                <div className="accordion-body py-2">
                                    {/* Toggle Requerido */}
                                    <div className="mb-3 d-flex align-items-center justify-content-between">
                                        <label
                                            className="form-label small text-muted mb-0"
                                            htmlFor={`switch-lab-${lab.id}`}
                                        >
                                            Laboratorio requerido
                                        </label>
                                        <div className="form-check form-switch">
                                            <input
                                                className="form-check-input"
                                                type="checkbox"
                                                role="switch"
                                                id={`switch-lab-${lab.id}`}
                                                checked={isRequired}
                                                onChange={() => handleToggleRequired(lab.id)}
                                                disabled={isSaving}
                                                style={{ cursor: "pointer" }}
                                            />
                                        </div>
                                    </div>

                                    <hr className="my-2" />

                                    <p className="small text-muted mb-2">
                                        <strong>Configuración del asistente de explicaciones:</strong>
                                    </p>

                                    {/* Selector de Verbosidad */}
                                    {renderVerbositySelector(lab.id, verbosity)}

                                    {/* Selector de Razonamiento */}
                                    {renderReasoningSelector(lab.id, reasoningEffort)}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {hasUnsavedChanges && (
                <div className="alert alert-warning small mb-3 mt-3" role="alert">
                    <strong>⚠️ Tienes cambios sin guardar</strong>
                    <p className="mb-0 mt-1">Haz clic en "Guardar cambios" para aplicar la configuración.</p>
                </div>
            )}

            <div className="d-grid gap-2 mt-3">
                <button
                    className="btn btn-primary"
                    onClick={handleSaveChanges}
                    disabled={isSaving || !hasUnsavedChanges}
                >
                    {isSaving ? (
                        <>
                            <output className="spinner-border spinner-border-sm me-2">
                                <span className="visually-hidden">Guardando...</span>
                            </output>
                            Guardando cambios...
                        </>
                    ) : (
                        "Guardar cambios"
                    )}
                </button>
            </div>

            {isSaving && (
                <div className="alert alert-secondary small d-flex align-items-center mt-2" role="alert">
                    <output className="spinner-border spinner-border-sm me-2">
                        <span className="visually-hidden">Guardando...</span>
                    </output>
                    Aplicando configuración...
                </div>
            )}
        </div>
    );
};

export default LabConfigTab;
