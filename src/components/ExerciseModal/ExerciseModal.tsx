import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import BaseModal from "../BaseModal";
import { useExerciseModal } from "./hooks";
import { ExerciseModalProps } from "./types";
import { handleKeyDown } from "./utils";

const ExerciseModal: React.FC<ExerciseModalProps> = ({
    exercise,
    isOpen,
    onClose,
    pageId,
    courseId,
    loadFromCache = false,
    onExplanationGenerated,
}) => {
    const {
        explanation,
        isLoadingExplanation,
        explanationError,
        chatMessages,
        chatInput,
        setChatInput,
        isSendingMessage,
        isChatInitialized,
        handleGenerateExplanation,
        handleSendChatMessage,
        handleRegenerateExplanation,
    } = useExerciseModal({
        exercise,
        isOpen,
        pageId,
        courseId,
        loadFromCache,
        onExplanationGenerated,
    });

    if (!isOpen) return null;

    return (
        <BaseModal isOpen={isOpen} onClose={onClose} title={exercise.name}>
            {/* Content - Explicación y Chat */}
            <div className="d-flex" style={{ flex: 1, overflow: "hidden", height: "87vh" }}>
                {/* Columna izquierda - Explicación */}
                <div className="p-4" style={{ flex: 1, overflowY: "auto", borderRight: "1px solid #dee2e6" }}>
                    {exercise.isTiquismiqui && (
                        <div className="alert alert-warning" role="alert">
                            <strong>⚠️ Exercise marked as picky.</strong>
                            <p className="mb-0 mt-1 small">
                                This explanation might not be completely correct. Review the steps carefully and consult
                                your teacher if you find anything strange.
                            </p>
                        </div>
                    )}
                    {isLoadingExplanation && (
                        <div
                            className="d-flex flex-column align-items-center justify-content-center"
                            style={{ minHeight: "200px" }}
                        >
                            <output className="spinner-border text-primary mb-3">
                                <span className="visually-hidden">Loading...</span>
                            </output>
                            <p className="text-muted">Generating explanation...</p>
                        </div>
                    )}

                    {explanationError && (
                        <div
                            className="d-flex flex-column align-items-center justify-content-center"
                            style={{ minHeight: "200px" }}
                        >
                            <div className="alert alert-danger w-100" role="alert">
                                <h5 className="alert-heading d-flex align-items-center">
                                    Error generating explanation
                                </h5>
                                <hr />
                                <p className="mb-3">{explanationError}</p>
                                <div className="d-flex gap-2">
                                    <button onClick={handleGenerateExplanation} className="btn btn-danger">
                                        Retry
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {explanation?.steps && !isLoadingExplanation && (
                        <div className="d-flex flex-column gap-3">
                            {explanation.steps.map((step, index) => (
                                <div key={`step-${index}`} className="card">
                                    <div className="card-header bg-primary text-white">
                                        <h4 className="h6 mb-0">{step.title}</h4>
                                    </div>
                                    <div className="card-body">
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm]}
                                            components={{
                                                table: ({ node, ...props }) => (
                                                    <table
                                                        className="table table-bordered table-sm mt-2 mb-2"
                                                        {...props}
                                                    />
                                                ),
                                                thead: ({ node, ...props }) => (
                                                    <thead className="table-light" {...props} />
                                                ),
                                                p: ({ node, ...props }) => <p className="mb-2" {...props} />,
                                                code: ({ node, ...props }) => {
                                                    const inline = (props as any).inline;
                                                    return inline ? (
                                                        <code className="bg-light px-1" {...props} />
                                                    ) : (
                                                        <code className="d-block bg-light p-2 rounded" {...props} />
                                                    );
                                                },
                                                pre: ({ node, ...props }) => (
                                                    <pre className="bg-light p-3 rounded overflow-auto" {...props} />
                                                ),
                                            }}
                                        >
                                            {step.content}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            ))}
                            <button onClick={handleRegenerateExplanation} className="btn btn-outline-primary">
                                Regenerate explanation
                            </button>
                        </div>
                    )}
                </div>

                {/* Columna derecha - Chat */}
                <div
                    className="d-flex flex-column"
                    style={{ width: "35%", minWidth: "450px", backgroundColor: "#f8f9fa" }}
                >
                    <div className="px-3 py-2 border-bottom bg-white">
                        <h6 className="mb-0">💬 Questions about the explanation</h6>
                        <small className="text-muted">Ask questions about any step of the explanation</small>
                    </div>

                    {/* Mensajes del chat */}
                    <div
                        className="px-3"
                        style={{
                            flex: 1,
                            overflowY: "auto",
                            display: "flex",
                            flexDirection: "column",
                            gap: "12px",
                            paddingTop: "12px",
                            paddingBottom: "12px",
                        }}
                    >
                        {!isChatInitialized ? (
                            <div className="alert alert-info" role="alert">
                                <small>Waiting for explanation to load...</small>
                            </div>
                        ) : chatMessages.length === 0 ? (
                            <div className="alert alert-info" role="alert">
                                <small>Do you have any questions about the explanation? Ask me anything.</small>
                            </div>
                        ) : (
                            chatMessages.map(message => (
                                <div
                                    key={message.id}
                                    className={`card ${message.role === "user" ? "bg-primary text-white" : ""}`}
                                >
                                    <div className="card-body p-2">
                                        <div className="small mb-1">
                                            <strong>{message.role === "user" ? "You" : "Assistant"}</strong>
                                        </div>
                                        <div style={{ fontSize: "0.9rem" }}>
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                components={{
                                                    table: ({ node, ...props }) => (
                                                        <table
                                                            className="table table-bordered table-sm mt-2 mb-2"
                                                            {...props}
                                                        />
                                                    ),
                                                    thead: ({ node, ...props }) => (
                                                        <thead className="table-light" {...props} />
                                                    ),
                                                    p: ({ node, ...props }) => <p className="mb-2" {...props} />,
                                                    code: ({ node, ...props }) => {
                                                        const inline = (props as any).inline;
                                                        return inline ? (
                                                            <code className="bg-light px-1 text-dark" {...props} />
                                                        ) : (
                                                            <code
                                                                className="d-block bg-light p-2 rounded text-dark"
                                                                {...props}
                                                            />
                                                        );
                                                    },
                                                    pre: ({ node, ...props }) => (
                                                        <pre
                                                            className="bg-light p-3 rounded overflow-auto text-dark"
                                                            {...props}
                                                        />
                                                    ),
                                                }}
                                            >
                                                {message.content}
                                            </ReactMarkdown>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}

                        {isSendingMessage && (
                            <div className="card border-secondary">
                                <div className="card-body p-2">
                                    <div className="d-flex align-items-center">
                                        <output
                                            className="spinner-border spinner-border-sm me-2"
                                            aria-label="Generating response"
                                        >
                                            <span className="visually-hidden">Loading...</span>
                                        </output>
                                        <span className="small">Generating response...</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Input del chat */}
                    <div className="px-3 py-2 border-top bg-white">
                        <div className="d-flex gap-2 align-items-end">
                            <textarea
                                className="form-control"
                                placeholder={
                                    !isChatInitialized ? "Waiting for explanation..." : "Type your question..."
                                }
                                value={chatInput}
                                onChange={e => setChatInput(e.target.value)}
                                onKeyDown={e => handleKeyDown(e, handleSendChatMessage)}
                                disabled={isSendingMessage || !isChatInitialized}
                                rows={4}
                                style={{ resize: "none", fontSize: "0.9rem" }}
                            />
                            <button
                                className="btn btn-primary btn-sm"
                                type="button"
                                onClick={handleSendChatMessage}
                                disabled={isSendingMessage || !chatInput.trim() || !isChatInitialized}
                                title="Send question"
                                style={{
                                    padding: "8px 12px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <svg
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <path d="M22 2L11 13" />
                                    <path d="M22 2L15 22L11 13L2 9L22 2Z" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </BaseModal>
    );
};

export default ExerciseModal;
