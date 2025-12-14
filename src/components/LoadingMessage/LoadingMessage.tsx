import React from "react";

const LoadingMessage: React.FC = () => {
    return (
        <div
            style={{
                position: "fixed",
                top: "50%",
                right: "20px",
                transform: "translateY(-50%)",
                zIndex: "9999",
            }}
        >
            <div className="card shadow-lg" style={{ minWidth: "250px" }}>
                <div className="card-body text-center">
                    <div className="spinner-border text-primary mb-3" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                    <h5 className="card-title">Searching for exercises...</h5>
                    <p className="card-text text-muted small mb-0">Analyzing page content</p>
                </div>
            </div>
        </div>
    );
};

export default LoadingMessage;
