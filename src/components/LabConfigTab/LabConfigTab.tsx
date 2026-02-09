import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import LabContextModal from "../LabContextModal";
import { createHandlers } from "./handlers";
import { useLabConfigState } from "./hooks";
import "./LabConfigTab.css";
import { ReasoningSelector, VerbositySelector } from "./selectors";
import { LabConfigTabProps } from "./types";
import { handleSaveChanges } from "./utils";

const LabConfigTab: React.FC<LabConfigTabProps> = ({ courseId, onConfigUpdate, isActive }) => {
    const { t } = useTranslation();

    // Función auxiliar para renderizar HTML seguro
    const renderHTML = (html: string) => <span dangerouslySetInnerHTML={{ __html: html }} />;

    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Limpiar mensaje de error después de 5 segundos
    useEffect(() => {
        if (errorMessage) {
            const timer = setTimeout(() => setErrorMessage(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [errorMessage]);

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
        contextModalLabId,
        setContextModalLabId,
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
        onConfigUpdate,
    );

    const isAnyGenerating = Array.from(contextGenerationStatus.values()).some(s => s === "generating");
    const isDisabled = isSaving || isAnyGenerating;

    const onSaveChanges = useCallback(() => {
        setErrorMessage(null);
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
            onConfigUpdate,
            setErrorMessage,
        );
    }, [
        hasUnsavedChanges,
        hasContextChanges,
        labContextState,
        contextGenerationStatus,
        pendingChanges,
        courseId,
        onConfigUpdate,
        setLabContextState,
        setContextGenerationStatus,
        setPendingChanges,
        setHasUnsavedChanges,
        setIsSaving,
        setErrorMessage,
    ]);

    if (isLoading) {
        return (
            <div className="text-center py-4">
                <output className="spinner-border">
                    <span className="visually-hidden">{t("common.loading")}</span>
                </output>
                <p className="mt-2 text-muted small">{t("options.labConfig.loading")}</p>
            </div>
        );
    }

    if (labs.length === 0) {
        return (
            <div className="alert alert-info" role="alert">
                <strong>{t("options.labConfig.noLabsTitle")}</strong>
                <p className="mb-0 mt-2 small">{t("options.labConfig.noLabsDesc")}</p>
            </div>
        );
    }

    return (
        <div ref={contentRef} onScroll={handleScroll} style={{ maxHeight: "80vh", overflowY: "auto" }}>
            {/* Explicación del sistema */}
            <div className="alert alert-primary small mb-3" role="alert">
                <h6 className="alert-heading">
                    <i className="bi bi-info-circle"></i> {t("options.labConfig.infoTitle")}
                </h6>
                <p className="mb-2">{renderHTML(t("options.labConfig.infoDesc"))}</p>
                <ul className="mb-2 small">
                    <li>{renderHTML(t("options.labConfig.infoList.include"))}</li>
                    <li>{renderHTML(t("options.labConfig.infoList.required"))}</li>
                    <li>{renderHTML(t("options.labConfig.infoList.verbosity"))}</li>
                    <li>{renderHTML(t("options.labConfig.infoList.reasoning"))}</li>
                </ul>
                <p className="mb-0 small">{t("options.labConfig.infoFooter")}</p>
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
                                            <span className="visually-hidden">{t("options.labConfig.generating")}</span>
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
                                                {t("options.labConfig.includeLabel")}
                                            </label>
                                            <span style={{ display: "flex", alignItems: "center", marginLeft: "8px" }}>
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
                                            {t("options.labConfig.requiredLabel")}
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
                                        <strong>{t("options.labConfig.explanationConfig")}</strong>
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

                                    {/* Edit Context Button */}
                                    <div className="mb-2">
                                        <button
                                            className="btn btn-outline-secondary btn-sm w-100"
                                            onClick={e => {
                                                e.stopPropagation();
                                                setContextModalLabId(lab.id);
                                            }}
                                            disabled={isDisabled || !hasContext}
                                        >
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                width="14"
                                                height="14"
                                                fill="currentColor"
                                                viewBox="0 0 16 16"
                                                className="me-1"
                                            >
                                                <path d="M12.854.146a.5.5 0 0 0-.707 0L10.5 1.793 14.207 5.5l1.647-1.646a.5.5 0 0 0 0-.708l-3-3zm.646 6.061L9.793 2.5 3.293 9H3.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.207l6.5-6.5zm-7.468 7.468A.5.5 0 0 1 6 13.5V13h-.5a.5.5 0 0 1-.5-.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.5-.5V10h-.5a.499.499 0 0 1-.175-.032l-.179.178a.5.5 0 0 0-.11.168l-2 5a.5.5 0 0 0 .65.65l5-2a.5.5 0 0 0 .168-.11l.178-.178z" />
                                            </svg>
                                            {t("options.labConfig.editContext")}
                                        </button>
                                    </div>

                                    <hr className="my-2" />
                                    <div className="d-flex align-items-center justify-content-between mt-2">
                                        <a
                                            href={`https://egela.ehu.eus/mod/page/view.php?id=${lab.id}`}
                                            rel="noopener noreferrer"
                                            className="btn btn-link p-0 ms-2"
                                            style={{ fontSize: "14px" }}
                                        >
                                            {t("options.labConfig.goToLab")}
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
                    <strong>{t("options.labConfig.unsavedTitle")}</strong>
                    <p className="mb-0 mt-1">{t("options.labConfig.unsavedDesc")}</p>
                    {hasContextChanges && (
                        <p className="mb-0 mt-1 small">
                            <i className="bi bi-info-circle me-1"></i>
                            {t("options.labConfig.unsavedContext")}
                        </p>
                    )}
                </div>
            )}

            {errorMessage && (
                <div className="alert alert-danger mt-3" role="alert">
                    <h6 className="alert-heading d-flex align-items-center">
                        <i className="bi bi-exclamation-triangle me-2"></i>
                        {t("common.error")}
                    </h6>
                    <hr />
                    <p className="mb-0">{errorMessage}</p>
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
                                <span className="visually-hidden">{t("options.labConfig.saving")}</span>
                            </output>
                            {isAnyGenerating ? t("options.labConfig.generatingContext") : t("options.labConfig.saving")}
                        </>
                    ) : (
                        t("options.labConfig.save")
                    )}
                </button>
            </div>

            {/* Lab Context Modal */}
            {contextModalLabId && (
                <LabContextModal
                    isOpen={!!contextModalLabId}
                    onClose={() => setContextModalLabId(null)}
                    labId={contextModalLabId}
                    labName={labs.find(l => l.id === contextModalLabId)?.name ?? ""}
                />
            )}
        </div>
    );
};

export default React.memo(LabConfigTab);