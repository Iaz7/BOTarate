import React, { useEffect, useState } from "react";

interface Lab {
    id: string;
    name: string;
    required: boolean;
}

interface LabConfigTabProps {
    courseId: string;
    onConfigUpdate?: () => void;
    isActive: boolean;
}

const LabConfigTab: React.FC<LabConfigTabProps> = ({ courseId, onConfigUpdate, isActive }) => {
    const [labs, setLabs] = useState<Lab[]>([]);
    const [labConfig, setLabConfig] = useState<Map<string, boolean>>(new Map());
    const [pendingChanges, setPendingChanges] = useState<Map<string, boolean>>(new Map());
    const [isSaving, setIsSaving] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

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

                const config = new Map<string, boolean>();
                for (const lab of response.data.labs) {
                    config.set(lab.id, lab.required ?? false);
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

    const handleToggle = (labId: string) => {
        const currentValue = labConfig.get(labId) ?? false;
        const newValue = !currentValue;

        // Actualizar estado local
        setLabConfig(prev => {
            const newConfig = new Map(prev);
            newConfig.set(labId, newValue);
            return newConfig;
        });

        // Marcar como cambio pendiente
        setPendingChanges(prev => {
            const newChanges = new Map(prev);
            newChanges.set(labId, newValue);
            return newChanges;
        });

        setHasUnsavedChanges(true);
    };

    const handleSaveChanges = async () => {
        if (pendingChanges.size === 0) return;

        setIsSaving(true);
        try {
            // Guardar todos los cambios
            for (const [labId, required] of pendingChanges) {
                await chrome.runtime.sendMessage({
                    action: "updateLabRequired",
                    courseId: courseId,
                    labId: labId,
                    required: required,
                });
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
                <strong>Configuración de laboratorios (Sistema de Niveles)</strong>
                <p className="mb-0 mt-1">
                    Configura qué laboratorios son obligatorios en la secuencia de aprendizaje. Los laboratorios
                    marcados como "requeridos" formarán parte del sistema de niveles: los estudiantes deberán completar
                    los laboratorios requeridos en orden antes de acceder al siguiente.
                </p>
            </div>

            <div className="table-responsive">
                <table className="table table-sm table-hover">
                    <thead>
                        <tr>
                            <th scope="col" style={{ width: "70%" }}>
                                Nombre del laboratorio
                            </th>
                            <th scope="col" className="text-center" style={{ width: "30%" }}>
                                Requerido
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {labs.map((lab, index) => {
                            const isRequired = labConfig.get(lab.id) ?? false;
                            return (
                                <tr key={lab.id}>
                                    <td>
                                        <div className="d-flex align-items-center">
                                            <span className="badge bg-secondary me-2">#{index + 1}</span>
                                            <span>{lab.name}</span>
                                            {isRequired && <span className="badge bg-primary ms-2">Requerido</span>}
                                        </div>
                                    </td>
                                    <td className="text-center">
                                        <div className="form-check form-switch d-inline-block">
                                            <input
                                                className="form-check-input"
                                                type="checkbox"
                                                role="switch"
                                                id={`switch-lab-${lab.id}`}
                                                checked={isRequired}
                                                onChange={() => handleToggle(lab.id)}
                                                disabled={isSaving}
                                                style={{ cursor: "pointer" }}
                                            />
                                            <label
                                                className="form-check-label visually-hidden"
                                                htmlFor={`switch-lab-${lab.id}`}
                                            >
                                                {isRequired ? "Requerido" : "Opcional"}
                                            </label>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {hasUnsavedChanges && (
                <div className="alert alert-warning small mb-3" role="alert">
                    <strong>⚠️ Tienes cambios sin guardar</strong>
                    <p className="mb-0 mt-1">
                        Haz clic en "Guardar cambios" para aplicar la configuración del sistema de niveles.
                    </p>
                </div>
            )}

            <div className="d-grid gap-2">
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
                    Aplicando configuración del sistema de niveles...
                </div>
            )}
        </div>
    );
};

export default LabConfigTab;
