import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ExerciseCardProps {
    name: string;
    statement: string;
}

const ExerciseCard: React.FC<ExerciseCardProps> = ({ name, statement }) => {
    return (
        <div className="card mb-3 shadow-sm">
            <div className="card-header bg-primary text-white">
                <h5 className="card-title mb-0">{name}</h5>
            </div>
            <div className="card-body">
                <div className="exercise-statement">
                    <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        components={{
                            table: ({node, ...props}) => (
                                <table className="table table-bordered table-sm mt-2 mb-2" {...props} />
                            ),
                            thead: ({node, ...props}) => (
                                <thead className="table-light" {...props} />
                            ),
                            p: ({node, ...props}) => (
                                <p className="mb-2" {...props} />
                            ),
                            h1: ({node, ...props}) => (
                                <h4 className="mt-3 mb-2" {...props} />
                            ),
                            h2: ({node, ...props}) => (
                                <h5 className="mt-3 mb-2" {...props} />
                            ),
                            h3: ({node, ...props}) => (
                                <h6 className="mt-2 mb-2" {...props} />
                            ),
                        }}
                    >
                        {statement}
                    </ReactMarkdown>
                </div>
            </div>
        </div>
    );
};

export default ExerciseCard;
