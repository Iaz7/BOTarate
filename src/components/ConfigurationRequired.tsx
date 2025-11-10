import React, { useRef } from "react";
import { ImportExportManager } from "../util/storage/ImportExportManager";

interface ConfigurationRequiredProps {
    onConfigLoaded: () => void;
}

export const ConfigurationRequired: React.FC<ConfigurationRequiredProps> = ({ onConfigLoaded }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.name.endsWith(".json")) {
            setError("Por favor, selecciona un archivo JSON válido.");
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
            console.error("Error al cargar configuración:", error);
            setError(`Error inesperado: ${error instanceof Error ? error.message : "Error desconocido"}`);
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

                <h4 className="mb-3">Configuración Requerida</h4>

                <p className="text-muted mb-4">
                    No se ha encontrado configuración para el asistente. Por favor, importa un archivo de configuración
                    proporcionado por tu profesor para comenzar a usar la extensión.
                </p>

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

                <button className="btn btn-primary btn-lg" onClick={handleButtonClick} disabled={isLoading}>
                    {isLoading ? (
                        <>
                            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                            {" Cargando..."}
                        </>
                    ) : (
                        <>
                            <i className="bi bi-upload me-2" />
                            {" Importar Configuración"}
                        </>
                    )}
                </button>

                <p className="text-muted mt-3 small">
                    <strong>Modo Profesor:</strong> Si eres el profesor, activa el modo profesor desde el popup de la
                    extensión para crear una nueva configuración.
                </p>
            </div>
        </div>
    );
};
