import React, { useEffect, useRef, useState } from "react";
import { LabConfigTabStateStorageManager } from "../util/storage/LabConfigTabStateStorageManager";
import "./LabConfigTab.css";

type VerbosityLevel = "low" | "medium" | "high";
type ReasoningEffort = "minimal" | "low" | "medium" | "high";

type ContextGenerationStatus = "idle" | "generating" | "completed" | "error";

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

interface LabContextState {
    hasContext: boolean;
    generateContext: boolean; // Current checkbox state
    originalGenerateContext: boolean; // Original state to detect changes
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
    const contentRef = useRef<HTMLDivElement>(null);

    // Context generation states
    const [labContextState, setLabContextState] = useState<Map<string, LabContextState>>(new Map());
    const [contextGenerationStatus, setContextGenerationStatus] = useState<Map<string, ContextGenerationStatus>>(
        new Map()
    );
    const [hasContextChanges, setHasContextChanges] = useState(false);

    // Restaurar estado guardado (scroll y accordion) al montar
    useEffect(() => {
        if (isActive && courseId) {
            const savedState = LabConfigTabStateStorageManager.getState();
            if (savedState) {
                setExpandedLab(savedState.expandedLab);
                setTimeout(() => {
                    if (contentRef.current) {
                        contentRef.current.scrollTop = savedState.scrollTop;
                    }
                }, 0);
            }
            loadConfigFromStorage();
        }
    }, [isActive, courseId]);

    // Detect if there are context changes
    useEffect(() => {
        let hasChanges = false;
        for (const [, state] of labContextState) {
            if (state.generateContext !== state.originalGenerateContext) {
                hasChanges = true;
                break;
            }
        }
        setHasContextChanges(hasChanges);
    }, [labContextState]);

    const loadConfigFromStorage = async () => {
        setIsLoading(true);
        try {
            // Obtener datos de labs
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
                const contextState = new Map<string, LabContextState>();
                const generationStatus = new Map<string, ContextGenerationStatus>();

                // Check context status for each lab
                for (const lab of response.data.labs) {
                    config.set(lab.id, {
                        required: lab.required ?? false,
                        verbosity: lab.verbosity ?? "medium",
                        reasoningEffort: lab.reasoningEffort ?? "medium",
                    });

                    // Check if lab has exercise data (context)
                    const exerciseDataResponse = await chrome.runtime.sendMessage({
                        action: "getExerciseData",
                        pageId: lab.id,
                    });

                    const hasContext =
                        exerciseDataResponse.success &&
                        exerciseDataResponse.data &&
                        exerciseDataResponse.data.exercises !== undefined;

                    contextState.set(lab.id, {
                        hasContext,
                        generateContext: hasContext,
                        originalGenerateContext: hasContext,
                    });
                    generationStatus.set(lab.id, "idle");
                }

                setLabConfig(config);
                setLabContextState(contextState);
                setContextGenerationStatus(generationStatus);
                setPendingChanges(new Map());
                setHasUnsavedChanges(false);
            }
        } catch (error) {
            console.error("Error loading lab config from storage:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleGenerateContext = (labId: string) => {
        setLabContextState(prev => {
            const newState = new Map(prev);
            const current = newState.get(labId);
            if (current) {
                newState.set(labId, {
                    ...current,
                    generateContext: !current.generateContext,
                });
            }
            return newState;
        });
        setHasUnsavedChanges(true);
    };

    const handleToggleRequired = (labId: string) => {
        const currentConfig = labConfig.get(labId);
        const newValue = !(currentConfig?.required ?? false);

        setLabConfig(prev => {
            const newConfig = new Map(prev);
            const current = newConfig.get(labId);
            if (current) {
                newConfig.set(labId, { ...current, required: newValue });
            }
            return newConfig;
        });

        setPendingChanges(prev => {
            const newChanges = new Map(prev);
            const current = newChanges.get(labId) || {};
            newChanges.set(labId, { ...current, required: newValue });
            return newChanges;
        });

        setHasUnsavedChanges(true);
    };

    const handleVerbosityChange = (labId: string, verbosity: VerbosityLevel) => {
        setLabConfig(prev => {
            const newConfig = new Map(prev);
            const current = newConfig.get(labId);
            if (current) {
                newConfig.set(labId, { ...current, verbosity });
            }
            return newConfig;
        });

        setPendingChanges(prev => {
            const newChanges = new Map(prev);
            const current = newChanges.get(labId) || {};
            newChanges.set(labId, { ...current, verbosity });
            return newChanges;
        });

        setHasUnsavedChanges(true);
    };

    const handleReasoningChange = (labId: string, reasoningEffort: ReasoningEffort) => {
        setLabConfig(prev => {
            const newConfig = new Map(prev);
            const current = newConfig.get(labId);
            if (current) {
                newConfig.set(labId, { ...current, reasoningEffort });
            }
            return newConfig;
        });

        setPendingChanges(prev => {
            const newChanges = new Map(prev);
            const current = newChanges.get(labId) || {};
            newChanges.set(labId, { ...current, reasoningEffort });
            return newChanges;
        });

        setHasUnsavedChanges(true);
    };

    const toggleExpand = (labId: string) => {
        setExpandedLab(prev => {
            const newExpanded = prev === labId ? null : labId;
            // Guardar el estado del accordion y scroll
            LabConfigTabStateStorageManager.saveState({
                expandedLab: newExpanded,
                scrollTop: contentRef.current?.scrollTop || 0,
            });
            if (newExpanded && contentRef.current) {
                const element = document.getElementById(`lab-${labId}`);
                if (element) {
                    const offsetTop = element.offsetTop;
                    contentRef.current.scrollTo({ top: offsetTop, behavior: "smooth" });
                }
            }
            return newExpanded;
        });
    };

    const handleSaveChanges = async () => {
        if (!hasUnsavedChanges && !hasContextChanges) return;

        setIsSaving(true);
        try {
            // First, handle context generation changes
            const labsToGenerate: string[] = [];
            const labsToRemove: string[] = [];

            for (const [labId, state] of labContextState) {
                if (state.generateContext !== state.originalGenerateContext) {
                    if (state.generateContext) {
                        labsToGenerate.push(labId);
                    } else {
                        labsToRemove.push(labId);
                    }
                }
            }

            // Generate context for labs that need it (in parallel)
            if (labsToGenerate.length > 0) {
                // Set all to generating status
                setContextGenerationStatus(prev => {
                    const newStatus = new Map(prev);
                    for (const labId of labsToGenerate) {
                        newStatus.set(labId, "generating");
                    }
                    return newStatus;
                });

                // Create promises for parallel generation
                const generationPromises = labsToGenerate.map(async labId => {
                    try {
                        const response = await chrome.runtime.sendMessage({
                            action: "generateLabContext",
                            pageId: labId,
                        });

                        if (response.success) {
                            setContextGenerationStatus(prev => {
                                const newStatus = new Map(prev);
                                newStatus.set(labId, "completed");
                                return newStatus;
                            });
                            setLabContextState(prev => {
                                const newState = new Map(prev);
                                const current = newState.get(labId);
                                if (current) {
                                    newState.set(labId, {
                                        ...current,
                                        hasContext: true,
                                        originalGenerateContext: true,
                                    });
                                }
                                return newState;
                            });
                            return { labId, success: true };
                        } else {
                            setContextGenerationStatus(prev => {
                                const newStatus = new Map(prev);
                                newStatus.set(labId, "error");
                                return newStatus;
                            });
                            return { labId, success: false, error: response.error };
                        }
                    } catch (error) {
                        setContextGenerationStatus(prev => {
                            const newStatus = new Map(prev);
                            newStatus.set(labId, "error");
                            return newStatus;
                        });
                        return { labId, success: false, error };
                    }
                });

                // Wait for all to complete
                await Promise.all(generationPromises);
            }

            // Remove context for labs that were unchecked
            for (const labId of labsToRemove) {
                await chrome.runtime.sendMessage({
                    action: "removeExerciseData",
                    pageId: labId,
                });
                setLabContextState(prev => {
                    const newState = new Map(prev);
                    const current = newState.get(labId);
                    if (current) {
                        newState.set(labId, {
                            ...current,
                            hasContext: false,
                            originalGenerateContext: false,
                        });
                    }
                    return newState;
                });
            }

            // Save other configuration changes
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

            // Clear pending changes
            setPendingChanges(new Map());
            setHasUnsavedChanges(false);

            // Notify parent if needed
            if (onConfigUpdate) {
                onConfigUpdate();
            }

            // Reset generation status after a delay
            setTimeout(() => {
                setContextGenerationStatus(prev => {
                    const newStatus = new Map(prev);
                    for (const [labId] of newStatus) {
                        newStatus.set(labId, "idle");
                    }
                    return newStatus;
                });
            }, 3000);
        } catch (error) {
            console.error("Error saving lab config:", error);
            alert("Error saving configuration. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };

    const isAnyGenerating = Array.from(contextGenerationStatus.values()).some(s => s === "generating");
    const isDisabled = isSaving || isAnyGenerating;

    const renderVerbositySelector = (labId: string, currentVerbosity: VerbosityLevel, hasContext: boolean) => (
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
                    disabled={isDisabled || !hasContext}
                />
                <label
                    className={`btn btn-outline-primary ${!hasContext ? "disabled" : ""}`}
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
                    disabled={isDisabled || !hasContext}
                />
                <label
                    className={`btn btn-outline-primary ${!hasContext ? "disabled" : ""}`}
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
                    disabled={isDisabled || !hasContext}
                />
                <label
                    className={`btn btn-outline-primary ${!hasContext ? "disabled" : ""}`}
                    htmlFor={`verbosity-high-${labId}`}
                    title="Detailed and extensive explanations"
                >
                    High
                </label>
            </div>
        </div>
    );

    const renderReasoningSelector = (labId: string, currentReasoning: ReasoningEffort, hasContext: boolean) => (
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
                    disabled={isDisabled || !hasContext}
                />
                <label
                    className={`btn btn-outline-primary ${!hasContext ? "disabled" : ""}`}
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
                    disabled={isDisabled || !hasContext}
                />
                <label
                    className={`btn btn-outline-primary ${!hasContext ? "disabled" : ""}`}
                    htmlFor={`reasoning-low-${labId}`}
                    title="Basic reasoning"
                >
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
                    disabled={isDisabled || !hasContext}
                />
                <label
                    className={`btn btn-outline-primary ${!hasContext ? "disabled" : ""}`}
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
                    disabled={isDisabled || !hasContext}
                />
                <label
                    className={`btn btn-outline-primary ${!hasContext ? "disabled" : ""}`}
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

    // Guardar scroll al hacer scroll
    const handleScroll = () => {
        LabConfigTabStateStorageManager.saveState({
            expandedLab,
            scrollTop: contentRef.current?.scrollTop || 0,
        });
    };

    return (
        <div ref={contentRef} onScroll={handleScroll} style={{ maxHeight: "80vh", overflowY: "auto" }}>
            {/* Explicación del sistema */}
            <div className="alert alert-primary small mb-3" role="alert">
                <h6 className="alert-heading">
                    <i className="bi bi-info-circle"></i> Course configuration
                </h6>
                <p className="mb-2">
                    Configure which labs to include and their <strong>required level</strong>,{" "}
                    <strong>verbosity</strong> and <strong>reasoning</strong> options.
                </p>
                <ul className="mb-2 small">
                    <li>
                        <strong>Include lab:</strong> Enable this to analyze the lab and extract exercises. This is
                        required before other configuration options can be used.
                    </li>
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
                <p className="mb-0 small">Click on an included lab to expand its configuration options.</p>
            </div>

            <div className="accordion" id="labAccordion">
                {labs.map((lab, index) => {
                    const config = labConfig.get(lab.id);
                    const contextState = labContextState.get(lab.id);
                    const isRequired = config?.required ?? false;
                    const verbosity = config?.verbosity ?? "medium";
                    const reasoningEffort = config?.reasoningEffort ?? "medium";
                    const isExpanded = expandedLab === lab.id;
                    const hasContext = contextState?.hasContext ?? false;
                    const generateContext = contextState?.generateContext ?? false;

                    const generationStatus = contextGenerationStatus.get(lab.id);
                    const isGenerating = generationStatus === "generating";
                    const isCompleted = generationStatus === "completed";
                    const isError = generationStatus === "error";
                    const canExpand = hasContext && !isDisabled;

                    return (
                        <div className="accordion-item" key={lab.id}>
                            <div
                                className={`lab-config-item ${canExpand ? "expandable" : ""} ${
                                    isExpanded ? "expanded" : ""
                                }`}
                                onClick={() => canExpand && toggleExpand(lab.id)}
                                style={{ minHeight: "48px" }}
                            >
                                {/* Lab number */}
                                <span className="badge bg-secondary lab-number-badge">#{index + 1}</span>

                                {/* Lab name */}
                                <span className={`lab-name ${!hasContext ? "inactive" : ""}`}>{lab.name}</span>

                                {/* Switch container */}

                                <div className="lab-switch-row" onClick={e => e.stopPropagation()}>
                                    {isGenerating ? (
                                        <span className="spinner-border spinner-border-sm text-primary" role="status">
                                            <span className="visually-hidden">Generating...</span>
                                        </span>
                                    ) : (
                                        <>
                                            <div className="form-check form-switch" style={{ margin: 0, padding: 0 }}>
                                                <input
                                                    className="form-check-input"
                                                    type="checkbox"
                                                    role="switch"
                                                    id={`switch-include-${lab.id}`}
                                                    checked={generateContext}
                                                    onChange={() => handleToggleGenerateContext(lab.id)}
                                                    disabled={isDisabled}
                                                    style={{ cursor: isDisabled ? "not-allowed" : "pointer" }}
                                                />
                                            </div>
                                            {/* Label Include */}
                                            <label
                                                htmlFor={`switch-include-${lab.id}`}
                                                className="lab-include-label mb-0"
                                                style={{
                                                    fontSize: "13px",
                                                    color: isDisabled ? "#adb5bd" : "#495057",
                                                    minWidth: "52px",
                                                }}
                                            >
                                                Include
                                            </label>
                                            {/* SVG Tick verde siempre presente, visible solo si está incluido */}
                                            <span style={{ display: "flex", alignItems: "center", marginLeft: "4px" }}>
                                                <svg
                                                    width="20"
                                                    height="20"
                                                    viewBox="0 0 20 20"
                                                    fill="none"
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    style={{
                                                        visibility: hasContext && !isGenerating ? "visible" : "hidden",
                                                    }}
                                                >
                                                    <circle cx="10" cy="10" r="10" fill="#28a745" />
                                                    <path
                                                        d="M6 10.5L9 13.5L14 7.5"
                                                        stroke="white"
                                                        strokeWidth="2"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                    />
                                                </svg>
                                            </span>
                                            {/* Icono de error si falla */}
                                            {isError && (
                                                <span
                                                    style={{ display: "flex", alignItems: "center", marginLeft: "8px" }}
                                                >
                                                    <svg
                                                        width="20"
                                                        height="20"
                                                        viewBox="0 0 20 20"
                                                        fill="none"
                                                        xmlns="http://www.w3.org/2000/svg"
                                                    >
                                                        <circle cx="10" cy="10" r="10" fill="#dc3545" />
                                                        <path
                                                            d="M7 7L13 13M13 7L7 13"
                                                            stroke="white"
                                                            strokeWidth="2"
                                                            strokeLinecap="round"
                                                        />
                                                    </svg>
                                                </span>
                                            )}
                                        </>
                                    )}
                                </div>

                                {/* Expand icon */}
                                <div className="lab-expand-icon ms-2">
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="16"
                                        height="16"
                                        fill="currentColor"
                                        className={`bi bi-chevron-${
                                            canExpand ? (isExpanded ? "up" : "down") : "right"
                                        }`}
                                        viewBox="0 0 16 16"
                                        style={{
                                            position: "absolute",
                                            right: "40px",
                                            color: "#495057", // Default color for visibility
                                        }}
                                    >
                                        {isExpanded ? (
                                            <path
                                                fillRule="evenodd"
                                                d="M1.646 10.854a.5.5 0 0 0 .708 0l6-6a.5.5 0 0 0-.708-.708l-6 6a.5.5 0 0 0 0 .708zm12.708 0a.5.5 0 0 0 0-.708l-6-6a.5.5 0 1 0-.708.708l6 6a.5.5 0 0 0 .708 0z"
                                            />
                                        ) : (
                                            <path
                                                fillRule="evenodd"
                                                d="M1.646 5.146a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708zm12.708 0a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708l6-6a.5.5 0 0 1 .708 0z"
                                            />
                                        )}
                                    </svg>
                                </div>
                            </div>
                            {isExpanded && (
                                <div className="lab-config-body" id={`lab-${lab.id}`}>
                                    {/* Toggle Requerido */}
                                    <div className="mb-3 d-flex align-items-center justify-content-between">
                                        <label
                                            className={`form-label small mb-0 ${
                                                hasContext ? "text-muted" : "text-muted opacity-50"
                                            }`}
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
                                                disabled={isDisabled || !hasContext}
                                                style={{ cursor: hasContext ? "pointer" : "not-allowed" }}
                                            />
                                        </div>
                                    </div>

                                    <hr className="my-2" />

                                    <p className={`small mb-2 ${hasContext ? "text-muted" : "text-muted opacity-50"}`}>
                                        <strong>Explanation assistant configuration:</strong>
                                    </p>

                                    {/* Selector de Verbosidad */}
                                    {renderVerbositySelector(lab.id, verbosity, hasContext)}

                                    {/* Selector de Razonamiento */}
                                    {renderReasoningSelector(lab.id, reasoningEffort, hasContext)}
                                    <hr className="my-2" />
                                    <div className="d-flex align-items-center justify-content-between mt-2">
                                        <a
                                            href={`https://egela.ehu.eus/mod/page/view.php?id=${lab.id}`}
                                            rel="noopener noreferrer"
                                            className="btn btn-link p-0 ms-2"
                                            style={{ fontSize: "14px" }}
                                        >
                                            Go to lab
                                        </a>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {(hasUnsavedChanges || hasContextChanges) && (
                <div className="alert alert-warning small mb-3 mt-3" role="alert">
                    <strong>⚠️ You have unsaved changes</strong>
                    <p className="mb-0 mt-1">Click "Save changes" to apply the configuration.</p>
                    {hasContextChanges && (
                        <p className="mb-0 mt-1 small">
                            <i className="bi bi-info-circle me-1"></i>
                            Context will be generated for newly included labs.
                        </p>
                    )}
                </div>
            )}

            <div className="d-grid gap-2 mt-3">
                <button
                    className="btn btn-primary"
                    onClick={handleSaveChanges}
                    disabled={isDisabled || (!hasUnsavedChanges && !hasContextChanges)}
                >
                    {isSaving || isAnyGenerating ? (
                        <>
                            <output className="spinner-border spinner-border-sm me-2">
                                <span className="visually-hidden">Saving...</span>
                            </output>
                            {isAnyGenerating ? "Generating context..." : "Saving changes..."}
                        </>
                    ) : (
                        "Save changes"
                    )}
                </button>
            </div>
        </div>
    );
};

export default LabConfigTab;
