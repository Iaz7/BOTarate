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

            alert("Course configuration saved successfully.");
        } catch (error) {
            console.error("Error saving lab config:", error);
            alert("Error saving configuration. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };

    const renderVerbositySelector = (labId: string, currentVerbosity: VerbosityLevel) => (
        <div className="mb-2 d-flex align-items-center">
            <div style={{ minWidth: 150 }} className="me-3">
                <label className="form-label small text-muted mb-0">Verbosity level</label>
            </div>
            <div className="btn-group" role="group" aria-label="Verbosity Level">
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
                    title="Concise and direct answers"
                >
                    Low
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
                    title="Balanced detail level"
                >
                    Medium
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
                    title="Detailed and extensive explanations"
                >
                    High
                </label>
            </div>
        </div>
    );

    const renderReasoningSelector = (labId: string, currentReasoning: ReasoningEffort) => (
        <div className="mb-2 d-flex align-items-center">
            <div style={{ minWidth: 150 }} className="me-3">
                <label className="form-label small text-muted mb-0">Reasoning effort</label>
            </div>
            <div className="btn-group" role="group" aria-label="Reasoning Effort">
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
                    title="Direct answer without reasoning"
                >
                    Minimal
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
                <label className="btn btn-outline-primary" htmlFor={`reasoning-low-${labId}`} title="Basic reasoning">
                    Low
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
                    title="Moderate reasoning"
                >
                    Medium
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
                    title="Detailed step-by-step reasoning"
                >
                    High
                </label>
            </div>
        </div>
    );

    if (isLoading) {
        return (
            <div className="text-center py-4">
                <output className="spinner-border">
                    <span className="visually-hidden">Loading labs...</span>
                </output>
                <p className="mt-2 text-muted small">Loading labs...</p>
            </div>
        );
    }

    if (labs.length === 0) {
        return (
            <div className="alert alert-info" role="alert">
                <strong>No labs available</strong>
                <p className="mb-0 mt-2 small">
                    No 'page' type resources found in the course that can be configured as labs.
                </p>
            </div>
        );
    }

    return (
        <div>
            {/* Explicación del sistema */}
            <div className="alert alert-primary small mb-3" role="alert">
                <h6 className="alert-heading">
                    <i className="bi bi-info-circle"></i> Course configuration
                </h6>
                <p className="mb-2">
                    Configure each lab with its <strong>required level</strong>, <strong>verbosity</strong> and{" "}
                    <strong>reasoning</strong> options.
                </p>
                <ul className="mb-2 small">
                    <li>
                        <strong>Required lab:</strong> Labs marked as required will unlock sequentially when the student
                        completes the challenges of the previous lab.
                    </li>
                    <li>
                        <strong>Verbosity level:</strong> Controls the level of detail in the assistant's explanations
                        (low, medium, or high).
                    </li>
                    <li>
                        <strong>Reasoning effort:</strong> Configures how much detail the assistant should put into
                        explaining its reasoning (minimal, low, medium, or high).
                    </li>
                </ul>
                <p className="mb-0 small">Click on a lab to expand its configuration options.</p>
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
                                        {isRequired && <span className="badge bg-primary ms-2">Required</span>}
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
                                            Required lab
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
                                        <strong>Explanation assistant configuration:</strong>
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
                    <strong>⚠️ You have unsaved changes</strong>
                    <p className="mb-0 mt-1">Click "Save changes" to apply the configuration.</p>
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
                                <span className="visually-hidden">Saving...</span>
                            </output>
                            Saving changes...
                        </>
                    ) : (
                        "Save changes"
                    )}
                </button>
            </div>

            {isSaving && (
                <div className="alert alert-secondary small d-flex align-items-center mt-2" role="alert">
                    <output className="spinner-border spinner-border-sm me-2">
                        <span className="visually-hidden">Saving...</span>
                    </output>
                    Applying configuration...
                </div>
            )}
        </div>
    );
};

export default LabConfigTab;
