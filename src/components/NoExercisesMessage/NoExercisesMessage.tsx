import React, { useEffect } from "react";

interface NoExercisesMessageProps {
    onTimeout: () => void;
    duration?: number;
}

const NoExercisesMessage: React.FC<NoExercisesMessageProps> = ({ onTimeout, duration = 3000 }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onTimeout();
        }, duration);

        return () => clearTimeout(timer);
    }, [onTimeout, duration]);

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
            <div className="card shadow-lg border-warning" style={{ minWidth: "280px" }}>
                <div className="card-body text-center">
                    <div className="text-warning mb-2" style={{ fontSize: "3rem" }}>
                        📄
                    </div>
                    <h5 className="card-title">No exercises found</h5>
                    <p className="card-text text-muted small mb-0">This page does not seem to contain exercises</p>
                </div>
            </div>
        </div>
    );
};

export default NoExercisesMessage;
