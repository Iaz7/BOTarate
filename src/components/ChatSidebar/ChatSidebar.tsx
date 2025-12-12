import React from "react";
import { APP_CONFIG } from "../../constants";
import { ConfigurationRequired } from "../ConfigurationRequired";
import ExerciseConfigTab from "../ExerciseConfigTab";
import LabConfigTab from "../LabConfigTab";
import ProgressTab from "../ProgressTab";
import { ChatSidebarProps, useChatSidebar } from "./ChatSidebar";
import "./ChatSidebar.css";
import ChatTab from "./tabs/ChatTab";
import ExercisesTab from "./tabs/ExercisesTab";

const ChatSidebar: React.FC<ChatSidebarProps> = props => {
    const {
        isCollapsed,
        setIsCollapsed,
        messages,
        inputValue,
        setInputValue,
        isGenerating,
        activeTab,
        setActiveTab,
        enableTransition,
        exercisesWithExplanations,
        exercisesWithEvaluations,
        isLoadingExplanations,
        isLoadingEvaluations,
        exercises,
        isLabBlocked,
        isCheckingBlocked,
        isTeacherMode,
        isUserTeacher,
        needsConfiguration,
        missingLLMConfig,
        isCheckingConfig,
        reloadKey,
        messagesEndRef,
        isChatDisabled,
        inputRef,
        handleConfigLoaded,
        handleModeToggle,
        handleExplanationClick,
        handleEvaluationClick,
        handleConfigUpdate,
        handleSendMessage,
        handleResetChat,
        handleKeyDown,
    } = useChatSidebar(props);

    return (
        <div
            className={`extension-sidebar ${isCollapsed ? "collapsed" : ""} ${
                !enableTransition ? "no-transition" : ""
            }`}
        >
            {/* Botón para colapsar/expandir */}
            <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="collapse-button"
                title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
                {isCollapsed ? "◀" : "▶"}
            </button>

            {/* Header */}
            <div className="card-header bg-light border-bottom">
                <div className="d-flex align-items-start mb-2">
                    <div className="d-flex align-items-center">
                        <img
                            src={chrome.runtime.getURL("icons/icon128.png")}
                            alt="Moodlia Icon"
                            className="header-icon"
                        />
                        <h2 className="h2 mb-0">{APP_CONFIG.NAME}</h2>
                    </div>
                    {isUserTeacher && (
                        <div className="d-flex align-items-center ms-auto mode-switch">
                            <span className={`${!isTeacherMode ? "fw-bold" : "text-muted"}`}>Student</span>
                            <div className="form-check form-switch mb-0">
                                <input
                                    className="form-check-input"
                                    type="checkbox"
                                    id="modeSwitch"
                                    checked={isTeacherMode}
                                    onChange={handleModeToggle}
                                    role="switch"
                                />
                            </div>
                            <span className={`${isTeacherMode ? "fw-bold" : "text-muted"}`}>Teacher</span>
                        </div>
                    )}
                </div>

                {/* Pestañas */}
                <ul className="nav nav-tabs mt-3 mb-0" role="tablist" key={`tabs-${isTeacherMode}-${reloadKey}`}>
                    {!needsConfiguration && (
                        <>
                            {/* Chat - siempre primero */}
                            <li className="nav-item" role="presentation">
                                <button
                                    className={`nav-link ${activeTab === "chat" ? "active" : ""}`}
                                    onClick={() => setActiveTab("chat")}
                                    type="button"
                                    role="tab"
                                >
                                    Chat
                                </button>
                            </li>

                            {/* Pestañas solo para modo alumno */}
                            {!isTeacherMode && exercises.length > 0 && (
                                <li className="nav-item" role="presentation">
                                    <button
                                        className={`nav-link ${activeTab === "exercises" ? "active" : ""}`}
                                        onClick={() => setActiveTab("exercises")}
                                        type="button"
                                        role="tab"
                                        disabled={isLabBlocked}
                                        title={isLabBlocked ? "Not available while lab is blocked" : ""}
                                    >
                                        Exercises
                                        {(exercisesWithExplanations.length > 0 ||
                                            exercisesWithEvaluations.length > 0) && (
                                            <span className="badge bg-primary ms-2">
                                                {Math.max(
                                                    exercisesWithExplanations.length,
                                                    exercisesWithEvaluations.length
                                                )}
                                            </span>
                                        )}
                                    </button>
                                </li>
                            )}

                            {/* Pestaña de progreso - para alumnos cuando hay courseId */}
                            {!isTeacherMode && props.courseId && (
                                <li className="nav-item" role="presentation">
                                    <button
                                        className={`nav-link ${activeTab === "progress" ? "active" : ""}`}
                                        onClick={() => setActiveTab("progress")}
                                        type="button"
                                        role="tab"
                                    >
                                        My progress
                                    </button>
                                </li>
                            )}

                            {/* Pestañas solo para modo profesor */}
                            {isTeacherMode && (
                                <>
                                    {props.courseId && (
                                        <li className="nav-item" role="presentation">
                                            <button
                                                className={`nav-link ${activeTab === "labs" ? "active" : ""}`}
                                                onClick={() => setActiveTab("labs")}
                                                type="button"
                                                role="tab"
                                            >
                                                Configure course
                                            </button>
                                        </li>
                                    )}
                                    <li className="nav-item" role="presentation">
                                        <button
                                            className={`nav-link ${activeTab === "config" ? "active" : ""}`}
                                            onClick={() => setActiveTab("config")}
                                            type="button"
                                            role="tab"
                                        >
                                            Configure lab
                                        </button>
                                    </li>
                                </>
                            )}
                        </>
                    )}
                </ul>
            </div>

            {/* Área de contenido */}
            <div className="content-area">
                {isCheckingConfig ? (
                    <div className="d-flex align-items-center justify-content-center loading-container">
                        <div className="text-center">
                            <div className="spinner-border text-primary mb-3" role="status">
                                <span className="visually-hidden">Checking configuration...</span>
                            </div>
                            <p className="text-muted">Checking configuration...</p>
                        </div>
                    </div>
                ) : needsConfiguration || missingLLMConfig ? (
                    <ConfigurationRequired
                        onConfigLoaded={handleConfigLoaded}
                        missingExerciseConfig={needsConfiguration}
                        missingLLMConfig={missingLLMConfig}
                    />
                ) : activeTab === "chat" ? (
                    <ChatTab
                        messages={messages}
                        inputValue={inputValue}
                        isGenerating={isGenerating}
                        isChatDisabled={isChatDisabled}
                        isCheckingBlocked={isCheckingBlocked}
                        isLabBlocked={isLabBlocked}
                        isLoadingExercises={props.isLoadingExercises || false}
                        pageId={props.pageId}
                        hasExercisesLoaded={props.hasExercisesLoaded}
                        exercises={exercises}
                        isAnyModalOpen={props.isAnyModalOpen || false}
                        isTeacherMode={isTeacherMode}
                        onSendMessage={handleSendMessage}
                        onResetChat={handleResetChat}
                        onInputChange={setInputValue}
                        onKeyDown={handleKeyDown}
                        messagesEndRef={messagesEndRef}
                        inputRef={inputRef}
                    />
                ) : activeTab === "exercises" ? (
                    <ExercisesTab
                        isLoadingExplanations={isLoadingExplanations}
                        isLoadingEvaluations={isLoadingEvaluations}
                        exercises={exercises}
                        exercisesWithExplanations={exercisesWithExplanations}
                        exercisesWithEvaluations={exercisesWithEvaluations}
                        onExplanationClick={handleExplanationClick}
                        onEvaluationClick={handleEvaluationClick}
                    />
                ) : activeTab === "config" ? (
                    <ExerciseConfigTab
                        exercises={exercises}
                        pageId={props.pageId || ""}
                        onConfigUpdate={handleConfigUpdate}
                        isActive={activeTab === "config"}
                    />
                ) : activeTab === "labs" ? (
                    <LabConfigTab
                        courseId={props.courseId || ""}
                        onConfigUpdate={handleConfigUpdate}
                        isActive={activeTab === "labs"}
                    />
                ) : activeTab === "progress" ? (
                    <ProgressTab courseId={props.courseId || ""} />
                ) : null}
            </div>
        </div>
    );
};

export default ChatSidebar;
