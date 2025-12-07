import React, { useRef } from "react";
import { ImportExportManager } from "../util/storage/ImportExportManager";

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
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.name.endsWith(".json")) {
            setError("Please select a valid JSON file.");
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const result = await ImportExportManager.importFromFile(file);

            if (result.success) {
                // Notificar que la configuración ha sido cargada
                setTimeout(() => {
                    onConfigLoaded();
                }, 500);
            } else {
                setError(result.message);
            }
        } catch (error) {
            console.error("Error loading configuration:", error);
            setError(`Unexpected error: ${error instanceof Error ? error.message : "Unknown error"}`);
        } finally {
            setIsLoading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    const handleButtonClick = () => {
        fileInputRef.current?.click();
    };

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

                <h4 className="mb-3">Configuration required</h4>

                {missingExerciseConfig && missingLLMConfig ? (
                    <div className="text-muted mb-4">
                        <p className="mb-2">Configuration is required to use the extension:</p>
                        <ul className="text-start" style={{ display: "inline-block" }}>
                            <li className="mb-2">
                                <strong>Assistant configuration:</strong> Import a configuration file provided by your
                                teacher with the course exercises and labs.
                            </li>
                            <li>
                                <strong>LLM configuration:</strong> Configure the API key and AI provider model from the
                                extension options page.
                            </li>
                        </ul>
                    </div>
                ) : missingExerciseConfig ? (
                    <p className="text-muted mb-4">
                        No assistant configuration found. Please import a configuration file provided by your teacher to
                        start using the extension.
                    </p>
                ) : missingLLMConfig ? (
                    <div className="text-muted mb-4">
                        <p className="mb-2">LLM is not configured. To use the extension you need to:</p>
                        <ul className="text-start" style={{ display: "inline-block" }}>
                            <li>Configure the AI provider API key (OpenAI, Google, etc.)</li>
                            <li>Select a compatible model</li>
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
                                    {" Loading..."}
                                </>
                            ) : (
                                <>
                                    <i className="bi bi-upload me-2" />
                                    {" Import Configuration"}
                                </>
                            )}
                        </button>
                    )}
                </div>

                {missingLLMConfig && (
                    <div className="alert alert-warning mt-3" role="alert">
                        <i className="bi bi-gear me-2" />
                        To configure the LLM, go to the extension options page, set your API key and a compatible model,
                        save the configuration and reload this page.
                    </div>
                )}
            </div>
        </div>
    );
};
