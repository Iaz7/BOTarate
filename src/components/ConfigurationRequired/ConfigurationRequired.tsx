import React from "react";
import { useTranslation } from "react-i18next";
import { useConfigurationImport } from "./useConfigurationImport";

interface ConfigurationRequiredProps {
    onConfigLoaded: () => void;
    missingExerciseConfig?: boolean;
    missingLLMConfig?: boolean;
}

export const ConfigurationRequired: React.FC<ConfigurationRequiredProps> = ({
    onConfigLoaded,
    missingExerciseConfig = true,
    missingLLMConfig = false,
}) => {
    const { t } = useTranslation();
    const { fileInputRef, isLoading, error, handleFileSelect, handleButtonClick } = useConfigurationImport({
        onConfigLoaded,
    });

    const renderHTML = (html: string) => <span dangerouslySetInnerHTML={{ __html: html }} />;

    return (
        <div className="d-flex align-items-center justify-content-center" style={{ minHeight: "400px" }}>
            <div className="text-center px-4" style={{ maxWidth: "500px" }}>
                <div className="mb-4">
                    <svg
                        width="80"
                        height="80"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-warning"
                    >
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                </div>

                <h4 className="mb-3">{t("configurationRequired.title")}</h4>

                {missingExerciseConfig && missingLLMConfig ? (
                    <div className="text-muted mb-4">
                        <p className="mb-2">{t("configurationRequired.requiredBoth.text")}</p>
                        <ul className="text-start" style={{ display: "inline-block" }}>
                            <li className="mb-2">
                                {renderHTML(t("configurationRequired.requiredBoth.assistantConfig"))}
                            </li>
                            <li>{renderHTML(t("configurationRequired.requiredBoth.llmConfig"))}</li>
                        </ul>
                    </div>
                ) : missingExerciseConfig ? (
                    <p className="text-muted mb-4">{t("configurationRequired.requiredExercise")}</p>
                ) : missingLLMConfig ? (
                    <div className="text-muted mb-4">
                        <p className="mb-2">{t("configurationRequired.requiredLLM.text")}</p>
                        <ul className="text-start" style={{ display: "inline-block" }}>
                            <li>{t("configurationRequired.requiredLLM.key")}</li>
                            <li>{t("configurationRequired.requiredLLM.model")}</li>
                        </ul>
                    </div>
                ) : null}

                {error && (
                    <div className="alert alert-danger mb-3" role="alert">
                        {error}
                    </div>
                )}

                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleFileSelect}
                    style={{ display: "none" }}
                    disabled={isLoading}
                />

                <div className="d-flex flex-column gap-2 align-items-center">
                    {missingExerciseConfig && (
                        <button className="btn btn-primary btn-lg" onClick={handleButtonClick} disabled={isLoading}>
                            {isLoading ? (
                                <>
                                    <span
                                        className="spinner-border spinner-border-sm me-2"
                                        role="status"
                                        aria-hidden="true"
                                    />
                                    {t("configurationRequired.importLoading")}
                                </>
                            ) : (
                                <>
                                    <i className="bi bi-upload me-2" />
                                    {t("configurationRequired.importButton")}
                                </>
                            )}
                        </button>
                    )}
                </div>

                {missingLLMConfig && (
                    <div className="alert alert-warning mt-3" role="alert">
                        <i className="bi bi-gear me-2" />
                        {t("configurationRequired.llmWarning")}
                    </div>
                )}
            </div>
        </div>
    );
};
