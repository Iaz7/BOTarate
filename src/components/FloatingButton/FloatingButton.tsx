import React from "react";
import { useTranslation } from "react-i18next";

interface FloatingButtonProps {
    onClick: () => void;
    exerciseCount: number;
}

const FloatingButton: React.FC<FloatingButtonProps> = ({ onClick, exerciseCount }) => {
    const { t } = useTranslation();
    return (
        <button
            onClick={onClick}
            className="btn btn-primary shadow position-fixed d-flex align-items-center gap-2"
            style={{
                top: "100px",
                right: "30px",
                zIndex: 9999,
                padding: "10px 20px",
            }}
            title={t("floatingButton.title", { count: exerciseCount })}
        >
            <span>📝 {t("floatingButton.label")}</span>
            {exerciseCount > 0 && <span className="badge bg-danger">{exerciseCount}</span>}
        </button>
    );
};

export default FloatingButton;
