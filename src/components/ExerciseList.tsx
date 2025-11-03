import React from 'react';
import ExerciseCard from './ExerciseCard';

interface Exercise {
    name: string;
    statement: string;
}

interface ExerciseListProps {
    exercises: Exercise[];
    onClose: () => void;
}

const ExerciseList: React.FC<ExerciseListProps> = ({ exercises, onClose }) => {
    return (
        <div
            className="extension-sidebar"
            style={{
                position: 'fixed',
                top: '0',
                right: '0',
                width: '600px',
                height: '100vh',
                backgroundColor: '#ffffff',
                borderLeft: '1px solid #dee2e6',
                boxShadow: '-2px 0 8px rgba(0,0,0,0.1)',
                zIndex: '9999',
                display: 'flex',
                flexDirection: 'column',
                fontFamily: 'Inter, sans-serif'
            }}
        >
            {/* Header */}
            <div className="card-header bg-light border-bottom d-flex justify-content-between align-items-center">
                <div>
                    <h3 className="h5 mb-1">📝 Ejercicios Identificados</h3>
                    <p className="small text-muted mb-0">
                        {exercises.length} ejercicio{exercises.length !== 1 ? 's' : ''} encontrado{exercises.length !== 1 ? 's' : ''}
                    </p>
                </div>
                <button
                    onClick={onClose}
                    className="btn btn-sm btn-outline-secondary"
                    title="Cerrar"
                >
                    ✕
                </button>
            </div>

            {/* Lista de ejercicios con scroll */}
            <div
                style={{
                    flex: '1',
                    overflowY: 'auto',
                    padding: '16px'
                }}
            >
                {exercises.map((exercise, index) => (
                    <ExerciseCard
                        key={index}
                        name={exercise.name}
                        statement={exercise.statement}
                    />
                ))}
            </div>
        </div>
    );
};

export default ExerciseList;
