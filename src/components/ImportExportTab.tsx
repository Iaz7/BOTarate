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
            console.error("Error al exportar configuración:", error);
            setMessage({
                text: `Error inesperado al exportar: ${error instanceof Error ? error.message : "Error desconocido"}`,
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
            console.error("Error al importar configuración:", error);
            setMessage({
                text: `Error inesperado al importar: ${error instanceof Error ? error.message : "Error desconocido"}`,
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
            "⚠️ ADVERTENCIA: Esta acción eliminará TODA la configuración guardada, incluyendo:\n\n" +
                "- Configuración de asistentes\n" +
                "- Datos de ejercicios identificados\n" +
                "- Datos de laboratorios configurados\n\n" +
                "Esta acción NO se puede deshacer. ¿Estás seguro de que deseas continuar?"
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
            console.error("Error al limpiar datos:", error);
            setMessage({
                text: `Error inesperado al limpiar: ${error instanceof Error ? error.message : "Error desconocido"}`,
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
                    text: "Por favor, selecciona un archivo JSON válido.",
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
                    <h5 className="card-title mb-0">Exportar Configuración</h5>
                </div>
                <div className="card-body">
                    <p className="text-muted">
                        Exporta toda tu configuración (asistentes, ejercicios y laboratorios) a un archivo JSON. Puedes
                        usar este archivo para hacer copias de seguridad o transferir la configuración a otro navegador.
                    </p>
                    <button type="button" className="btn btn-primary" onClick={handleExport} disabled={isProcessing}>
                        {isProcessing ? (
                            <>
                                <span
                                    className="spinner-border spinner-border-sm me-2"
                                    role="status"
                                    aria-hidden="true"
                                />
                                {" Exportando..."}
                            </>
                        ) : (
                            <>
                                <i className="bi bi-download me-2" />
                                {" Exportar Configuración"}
                            </>
                        )}
                    </button>
                </div>
            </div>

            <div className="card mb-4">
                <div className="card-header">
                    <h5 className="card-title mb-0">Importar Configuración</h5>
                </div>
                <div className="card-body">
                    <p className="text-muted">
                        Importa una configuración desde un archivo JSON previamente exportado. Esto sobrescribirá los
                        datos existentes con los del archivo.
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
                        <strong>⚠️ Atención:</strong> Al importar, se sobrescribirán los datos existentes. Se recomienda
                        hacer una exportación previa como backup.
                    </div>
                </div>
            </div>

            <div className="card border-danger">
                <div className="card-header bg-danger text-white">
                    <h5 className="card-title mb-0">Zona Peligrosa</h5>
                </div>
                <div className="card-body">
                    <p className="text-muted">
                        Elimina permanentemente todos los datos almacenados por la extensión. Esta acción no se puede
                        deshacer.
                    </p>
                    <button type="button" className="btn btn-danger" onClick={handleClearAll} disabled={isProcessing}>
                        {isProcessing ? (
                            <>
                                <span
                                    className="spinner-border spinner-border-sm me-2"
                                    role="status"
                                    aria-hidden="true"
                                />
                                {" Eliminando..."}
                            </>
                        ) : (
                            <>
                                <i className="bi bi-trash me-2" />
                                {" Eliminar Todos los Datos"}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
