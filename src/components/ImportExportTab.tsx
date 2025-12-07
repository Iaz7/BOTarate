import React, { useRef, useState } from "react";
import { ImportExportManager } from "../util/storage/ImportExportManager";

export const ImportExportTab: React.FC = () => {
    const [message, setMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    /**
     * Exporta la configuración a un archivo JSON
     */
    const handleExport = async () => {
        setIsProcessing(true);
        setMessage(null);

        try {
            const result = await ImportExportManager.exportToFile();
            setMessage({
                text: result.message,
                type: result.success ? "success" : "error",
            });
        } catch (error) {
            console.error("Error exporting configuration:", error);
            setMessage({
                text: `Unexpected error exporting: ${error instanceof Error ? error.message : "Unknown error"}`,
                type: "error",
            });
        } finally {
            setIsProcessing(false);
        }
    };

    /**
     * Importa la configuración desde un archivo JSON
     */
    const handleImport = async (file: File) => {
        setIsProcessing(true);
        setMessage(null);

        try {
            const result = await ImportExportManager.importFromFile(file);
            setMessage({
                text: result.message,
                type: result.success ? "success" : "error",
            });
        } catch (error) {
            console.error("Error importing configuration:", error);
            setMessage({
                text: `Unexpected error importing: ${error instanceof Error ? error.message : "Unknown error"}`,
                type: "error",
            });
        } finally {
            setIsProcessing(false);
            // Limpiar el input
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    /**
     * Limpia todos los datos del storage
     */
    const handleClearAll = async () => {
        const confirmed = confirm(
            "⚠️ WARNING: This action will delete ALL saved configuration, including:\n\n" +
                "- Assistant configuration\n" +
                "- Identified exercise data\n" +
                "- Configured lab data\n\n" +
                "This action CANNOT be undone. Are you sure you want to continue?"
        );

        if (!confirmed) return;

        setIsProcessing(true);
        setMessage(null);

        try {
            const result = await ImportExportManager.clearAllData();
            setMessage({
                text: result.message,
                type: result.success ? "info" : "error",
            });
        } catch (error) {
            console.error("Error clearing data:", error);
            setMessage({
                text: `Unexpected error clearing: ${error instanceof Error ? error.message : "Unknown error"}`,
                type: "error",
            });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            if (!file.name.endsWith(".json")) {
                setMessage({
                    text: "Please select a valid JSON file.",
                    type: "error",
                });
                return;
            }
            handleImport(file);
        }
    };

    const getAlertClass = () => {
        if (!message) return "";
        if (message.type === "error") return "alert-danger";
        if (message.type === "success") return "alert-success";
        return "alert-info";
    };

    return (
        <div>
            {message && (
                <div className={`alert ${getAlertClass()} alert-dismissible fade show`} role="alert">
                    {message.text}
                    <button
                        type="button"
                        className="btn-close"
                        onClick={() => setMessage(null)}
                        aria-label="Close"
                    ></button>
                </div>
            )}

            <div className="card mb-4">
                <div className="card-header">
                    <h5 className="card-title mb-0">Export configuration</h5>
                </div>
                <div className="card-body">
                    <p className="text-muted">
                        Export all your configuration (assistants, exercises, and labs) to a JSON file. You can use this
                        file to make backups or transfer the configuration to another browser.
                    </p>
                    <button type="button" className="btn btn-primary" onClick={handleExport} disabled={isProcessing}>
                        {isProcessing ? (
                            <>
                                <span
                                    className="spinner-border spinner-border-sm me-2"
                                    role="status"
                                    aria-hidden="true"
                                />
                                {" Exporting..."}
                            </>
                        ) : (
                            <>
                                <i className="bi bi-download me-2" />
                                {" Export configuration"}
                            </>
                        )}
                    </button>
                </div>
            </div>

            <div className="card mb-4">
                <div className="card-header">
                    <h5 className="card-title mb-0">Import configuration</h5>
                </div>
                <div className="card-body">
                    <p className="text-muted">
                        Import a configuration from a previously exported JSON file. This will overwrite existing data
                        with the file's data.
                    </p>
                    <div className="mb-3">
                        <input
                            ref={fileInputRef}
                            type="file"
                            className="form-control"
                            accept=".json"
                            onChange={handleFileSelect}
                            disabled={isProcessing}
                        />
                    </div>
                    <div className="alert alert-warning" role="alert">
                        <strong>⚠️ Attention:</strong> Importing will overwrite existing data. It is recommended to
                        export first as a backup.
                    </div>
                </div>
            </div>

            <div className="card border-danger">
                <div className="card-header bg-danger text-white">
                    <h5 className="card-title mb-0">Danger zone</h5>
                </div>
                <div className="card-body">
                    <p className="text-muted">
                        Permanently delete all data stored by the extension. This action cannot be undone.
                    </p>
                    <button type="button" className="btn btn-danger" onClick={handleClearAll} disabled={isProcessing}>
                        {isProcessing ? (
                            <>
                                <span
                                    className="spinner-border spinner-border-sm me-2"
                                    role="status"
                                    aria-hidden="true"
                                />
                                {" Deleting..."}
                            </>
                        ) : (
                            <>
                                <i className="bi bi-trash me-2" />
                                {" Delete all data"}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
