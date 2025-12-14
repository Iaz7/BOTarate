import React from "react";
import { createHandlers } from "./handlers";
import { useLabConfigState } from "./hooks";
import "./LabConfigTab.css";
import { ReasoningSelector, VerbositySelector } from "./selectors";
import { LabConfigTabProps } from "./types";
import { handleSaveChanges } from "./utils";

const LabConfigTab: React.FC<LabConfigTabProps> = ({ courseId, onConfigUpdate, isActive }) => {
    const {
        labs,
        labConfig,
        setLabConfig,
        pendingChanges,
        setPendingChanges,
        isSaving,
        setIsSaving,
        hasUnsavedChanges,
        setHasUnsavedChanges,
        isLoading,
        expandedLab,
        setExpandedLab,
        contentRef,
        labContextState,
        setLabContextState,
        contextGenerationStatus,
        setContextGenerationStatus,
        hasContextChanges,
        handleScroll,
    } = useLabConfigState(courseId, isActive);

    const {
        handleToggleGenerateContext,
        handleToggleRequired,
        handleVerbosityChange,
        handleReasoningChange,
        toggleExpand,
    } = createHandlers(
        labConfig,
        setLabConfig,
        pendingChanges,
        setPendingChanges,
        setHasUnsavedChanges,
        labContextState,
        setLabContextState,
        expandedLab,
        setExpandedLab,
        contentRef,
        courseId,
        onConfigUpdate
    );

    const isAnyGenerating = Array.from(contextGenerationStatus.values()).some(s => s === "generating");
    const isDisabled = isSaving || isAnyGenerating;

    const onSaveChanges = () =>
        handleSaveChanges(
            hasUnsavedChanges,
            hasContextChanges,
            labContextState,
            setLabContextState,
            contextGenerationStatus,
            setContextGenerationStatus,
            pendingChanges,
            setPendingChanges,
            setHasUnsavedChanges,
            setIsSaving,
            courseId,
            onConfigUpdate
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
                                <div className="lab-expand-icon ms-2" style={{ display: "flex", alignItems: "center" }}>
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
                                    <VerbositySelector
                                        labId={lab.id}
                                        currentVerbosity={verbosity}
                                        hasContext={hasContext}
                                        isDisabled={isDisabled}
                                        onChange={handleVerbosityChange}
                                    />

                                    {/* Selector de Razonamiento */}
                                    <ReasoningSelector
                                        labId={lab.id}
                                        currentReasoning={reasoningEffort}
                                        hasContext={hasContext}
                                        isDisabled={isDisabled}
                                        onChange={handleReasoningChange}
                                    />
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
                    onClick={onSaveChanges}
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
