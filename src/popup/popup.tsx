import React, { useEffect, useState } from "react";
import { APP_CONFIG } from "../constants";
import "../content/bootstrap.css";

const Popup: React.FC = () => {
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Simular una pequeña carga para mantener consistencia
        setTimeout(() => setIsLoading(false), 100);
    }, []);

    const openOptionsPage = () => {
        chrome.runtime.openOptionsPage();
    };

    if (isLoading) {
        return (
            <div className="p-4 text-center" style={{ width: "300px" }}>
                <div className="spinner-border spinner-border-sm" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="p-3" style={{ width: "300px" }}>
            <div className="d-flex align-items-center justify-content-center mb-3">
                <h5 className="mb-0">{APP_CONFIG.NAME}</h5>
            </div>

            <div className="alert alert-info small mb-3" role="alert">
                Welcome to {APP_CONFIG.NAME}. Configure the extension to start using it.
            </div>

            <div className="d-grid gap-2">
                <button className="btn btn-primary" onClick={openOptionsPage}>
                    <i className="bi bi-gear me-2" />
                    {" Open settings"}
                </button>
            </div>

            <hr className="my-3" />

            <div className="text-center">
                <small className="text-muted">{APP_CONFIG.DESCRIPTION}</small>
            </div>
        </div>
    );
};

export default Popup;
