import React, { useEffect, useState } from "react";
import "../content/bootstrap.css";
import { AppMode, ModeManager } from "../util/config/ModeManager";

const Popup: React.FC = () => {
    const [mode, setMode] = useState<AppMode>(AppMode.STUDENT);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadMode();
    }, []);

    const loadMode = async () => {
        try {
            const currentMode = await ModeManager.getMode();
            setMode(currentMode);
        } catch (error) {
            console.error("Error al cargar el modo:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleModeToggle = async () => {
        try {
            const newMode = await ModeManager.toggleMode();
            setMode(newMode);

            // Recargar las páginas abiertas para aplicar el cambio
            const tabs = await chrome.tabs.query({});
            for (const tab of tabs) {
                if (tab.id && tab.url?.includes("chrome-extension://")) {
                    chrome.tabs.reload(tab.id);
                }
            }
        } catch (error) {
            console.error("Error al cambiar el modo:", error);
        }
    };

    const openOptionsPage = () => {
        chrome.runtime.openOptionsPage();
    };

    if (isLoading) {
        return (
            <div className="p-4 text-center" style={{ width: "300px" }}>
                <div className="spinner-border spinner-border-sm" role="status">
                    <span className="visually-hidden">Cargando...</span>
                </div>
            </div>
        );
    }

    const isTeacher = mode === AppMode.TEACHER;

    return (
        <div className="p-3" style={{ width: "300px" }}>
            <div className="d-flex align-items-center justify-content-between mb-3">
                <h5 className="mb-0">Egela Assistant</h5>
                <span className={`badge ${isTeacher ? "bg-primary" : "bg-secondary"}`}>
                    {isTeacher ? "Profesor" : "Alumno"}
                </span>
            </div>

            <div className="card mb-3">
                <div className="card-body">
                    <div className="d-flex align-items-center justify-content-between">
                        <div>
                            <h6 className="mb-1">Modo de Operación</h6>
                            <small className="text-muted">
                                {isTeacher ? "Todas las funciones disponibles" : "Funciones limitadas"}
                            </small>
                        </div>
                        <div className="form-check form-switch">
                            <input
                                className="form-check-input"
                                type="checkbox"
                                role="switch"
                                id="modeSwitch"
                                checked={isTeacher}
                                onChange={handleModeToggle}
                                style={{ width: "48px", height: "24px", cursor: "pointer" }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {isTeacher && (
                <div className="alert alert-info small mb-3" role="alert">
                    <strong>Modo Profesor:</strong> Puedes configurar el asistente, laboratorios y ejercicios. Luego
                    exporta la configuración para compartirla con los alumnos.
                </div>
            )}

            <div className="d-grid gap-2">
                <button className="btn btn-primary" onClick={openOptionsPage}>
                    <i className="bi bi-gear me-2" />
                    {" Abrir Configuración"}
                </button>
            </div>

            <hr className="my-3" />

            <div className="text-center">
                <small className="text-muted">Extensión del asistente educativo para Egela</small>
            </div>
        </div>
    );
};

export default Popup;
