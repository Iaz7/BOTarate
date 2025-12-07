import React, { useEffect } from "react";

interface BaseModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
}

const BaseModal: React.FC<BaseModalProps> = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;

    const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onClose();
            }
        };

        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen, onClose]);

    return (
        <div
            className="modal show d-block"
            style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 10003 }}
            tabIndex={-1}
            role="dialog"
            onClick={handleOverlayClick}
        >
            <div
                className="modal-dialog modal-xl modal-dialog-scrollable"
                style={{ width: "80vw", maxWidth: "none" }}
                role="document"
            >
                <div className="modal-content">
                    <div className="modal-header bg-primary text-white d-flex align-items-center">
                        <h5 className="modal-title mb-0 d-flex align-items-center">
                            <img
                                src={chrome.runtime.getURL("icons/icon128.png")}
                                alt="DBot"
                                style={{ width: "32px", height: "32px", marginRight: "16px", marginLeft: "24px" }}
                            />
                            {title}
                        </h5>
                        <button
                            type="button"
                            className="btn-close btn-close-white ms-auto"
                            onClick={onClose}
                            aria-label="Close"
                            style={{ fontSize: "1.2rem", fontWeight: "bold" }}
                        ></button>
                    </div>
                    <div className="modal-body" style={{ minHeight: "600px" }}>
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BaseModal;
