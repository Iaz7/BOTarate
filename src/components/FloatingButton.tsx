import React from 'react';

interface FloatingButtonProps {
    onClick: () => void;
    exerciseCount: number;
}

const FloatingButton: React.FC<FloatingButtonProps> = ({ onClick, exerciseCount }) => {
    return (
        <button
            onClick={onClick}
            className="btn btn-primary shadow position-fixed d-flex align-items-center gap-2"
            style={{
                top: '100px',
                right: '30px',
                zIndex: 9999,
                padding: '10px 20px'
            }}
            title={`Ver ${exerciseCount} ${exerciseCount === 1 ? 'ejercicio' : 'ejercicios'}`}
        >
            <span>📝 Ver Ejercicios</span>
            {exerciseCount > 0 && (
                <span className="badge bg-danger">
                    {exerciseCount}
                </span>
            )}
        </button>
    );
};

export default FloatingButton;
