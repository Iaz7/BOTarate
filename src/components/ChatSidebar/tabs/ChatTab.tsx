import React from "react";

interface Exercise {
    name: string;
    statement: string;
    allowed?: boolean;
    isTiquismiqui?: boolean;
}

interface ChatMessage {
    role: "user" | "assistant" | "tool";
    content: string | null;
    id: string;
    tool_calls?: Array<{
        function: {
            name: string;
            arguments: string;
        };
        id: string;
        type: string;
    }>;
    name?: string;
}

interface ChatTabProps {
    messages: ChatMessage[];
    inputValue: string;
    isGenerating: boolean;
    isChatDisabled: boolean;
    isCheckingBlocked: boolean;
    isLabBlocked: boolean;
    isLoadingExercises: boolean;
    pageId?: string;
    hasExercisesLoaded?: boolean;
    exercises: Exercise[];
    isAnyModalOpen: boolean;
    onSendMessage: () => void;
    onResetChat: () => void;
    onInputChange: (value: string) => void;
    onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
    onIdentifyExercises?: () => void;
    messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

const ChatTab: React.FC<ChatTabProps> = ({
    messages,
    inputValue,
    isGenerating,
    isChatDisabled,
    isCheckingBlocked,
    isLabBlocked,
    isLoadingExercises,
    pageId,
    hasExercisesLoaded,
    exercises,
    isAnyModalOpen,
    onSendMessage,
    onResetChat,
    onInputChange,
    onKeyDown,
    onIdentifyExercises,
    messagesEndRef,
}) => {
    const getChatPlaceholder = () => {
        if (isAnyModalOpen) return "Chat disabled (modal open)...";
        if (isLabBlocked) return "Lab blocked...";
        if (isLoadingExercises) return "Loading exercises...";
        if (pageId && !hasExercisesLoaded) return "No exercises loaded. Press 'Identify' to analyze them...";
        return "Type your question...";
    };

    const getWelcomeMessage = () => {
        if (!pageId) {
            return "You can ask me about the course content. If you want to work on exercises, open a lab first.";
        }

        if (exercises.length > 0) {
            return "The exercises on this page are ready. Ask me for an explanation or tell me if you want to check your solution for any of them. If you want, I can also give you the list of available exercises.";
        }

        if (pageId && !hasExercisesLoaded) {
            return "As soon as you identify the exercises, I will be able to help you with them.";
        }

        return "I am here to help you with the course.";
    };

    return (
        <>
            <div
                style={{
                    flex: "1",
                    overflowY: "auto",
                    padding: "16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                }}
            >
                {isCheckingBlocked ? (
                    <div className="card border-primary">
                        <div className="card-body p-3">
                            <div className="d-flex align-items-center mb-2">
                                <div className="spinner-border spinner-border-sm text-primary me-2">
                                    <span className="visually-hidden">Checking access...</span>
                                </div>
                                <strong>Checking lab access...</strong>
                            </div>
                        </div>
                    </div>
                ) : isLabBlocked ? (
                    <div className="alert alert-danger" role="alert">
                        <h5 className="alert-heading">
                            <i className="bi bi-lock-fill me-2"></i>
                            Lab blocked
                        </h5>
                        <p>
                            This lab is blocked because it is a required lab and you have not yet completed the previous
                            lab.
                        </p>
                        <hr />
                        <p className="mb-0">
                            <strong>To unlock this lab:</strong>
                        </p>
                        <ul className="mb-0 mt-2">
                            <li>Complete the required challenge exercises from the previous lab</li>
                            <li>
                                Meet the criteria defined by your teacher in the extension options or check the details
                                in "My progress"
                            </li>
                            <li>Check your progress in the "My progress" tab</li>
                        </ul>
                    </div>
                ) : isLoadingExercises ? (
                    <div className="card border-primary">
                        <div className="card-body p-3">
                            <div className="d-flex align-items-center mb-2">
                                <div className="spinner-border spinner-border-sm text-primary me-2">
                                    <span className="visually-hidden">Loading...</span>
                                </div>
                                <strong>Searching for exercises...</strong>
                            </div>
                            <p className="text-muted small mb-0">
                                Analyzing page content to identify available exercises.
                            </p>
                        </div>
                    </div>
                ) : pageId && !hasExercisesLoaded && !isLoadingExercises ? (
                    <>
                        <div className="alert alert-warning" role="alert">
                            <h6 className="alert-heading mb-2">
                                <i className="bi bi-exclamation-triangle me-2"></i>
                                No exercises loaded
                            </h6>
                            <p className="mb-3 small">
                                To use the chat with exercise context, you must first identify them.
                            </p>
                            <button type="button" className="btn btn-primary btn-sm" onClick={onIdentifyExercises}>
                                <i className="bi bi-play-circle me-1"></i>
                                Identify exercises now
                            </button>
                        </div>
                    </>
                ) : messages.length === 0 ? (
                    <>
                        <div className="alert alert-info" role="alert">
                            {getWelcomeMessage()}
                        </div>
                        {pageId && exercises.length === 0 && !isLoadingExercises && (
                            <div className="card border-primary">
                                <div className="card-body p-3">
                                    <h6 className="card-title mb-2">
                                        <i className="bi bi-search me-2"></i>
                                        Identify exercises
                                    </h6>
                                    <p className="card-text small text-muted mb-3">
                                        Press the button to analyze the page and identify available exercises.
                                    </p>
                                    <button
                                        type="button"
                                        className="btn btn-primary btn-sm"
                                        onClick={onIdentifyExercises}
                                    >
                                        <i className="bi bi-play-circle me-1"></i>
                                        Identify exercises
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    messages.map(message => {
                        if (message.role === "tool") {
                            return null;
                        }

                        if (message.role === "assistant" && message.tool_calls && message.tool_calls.length > 0) {
                            return null;
                        }

                        if (!message.content || message.content.trim() === "") {
                            return null;
                        }

                        return (
                            <div
                                key={message.id}
                                className={`card ${message.role === "user" ? "bg-primary text-white" : ""}`}
                            >
                                <div className="card-body p-2">
                                    <div className="small mb-1">
                                        <strong>{message.role === "user" ? "You" : "Assistant"}</strong>
                                    </div>
                                    <div style={{ whiteSpace: "pre-wrap" }}>{message.content}</div>
                                </div>
                            </div>
                        );
                    })
                )}

                {isGenerating && (
                    <div className="card border-secondary">
                        <div className="card-body p-2">
                            <div className="d-flex align-items-center">
                                <div className="spinner-border spinner-border-sm me-2" aria-label="Generating response">
                                    <span className="visually-hidden">Loading...</span>
                                </div>
                                <span className="small">Generating response...</span>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="card-footer bg-light border-top">
                <div className="d-flex gap-2 align-items-center">
                    <textarea
                        className="form-control"
                        placeholder={getChatPlaceholder()}
                        value={inputValue}
                        onChange={e => onInputChange(e.target.value)}
                        onKeyDown={onKeyDown}
                        disabled={isChatDisabled}
                        rows={4}
                        style={{ resize: "none", overflow: "auto", flex: 1 }}
                    />
                    <button
                        className="btn btn-primary"
                        type="button"
                        onClick={onSendMessage}
                        disabled={isChatDisabled || !inputValue.trim()}
                        title="Send message"
                        style={{
                            padding: "8px 12px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <svg
                            width="20"
                            height="20"
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
                    <button
                        onClick={onResetChat}
                        title="Restart conversation"
                        disabled={isAnyModalOpen}
                        style={{
                            background: "transparent",
                            border: "none",
                            padding: "8px",
                            cursor: isAnyModalOpen ? "not-allowed" : "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            opacity: isAnyModalOpen ? 0.5 : 1,
                        }}
                    >
                        <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#6c757d"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
                        </svg>
                    </button>
                </div>
            </div>
        </>
    );
};

export default ChatTab;
