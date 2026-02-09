import React from "react";
import { APP_CONFIG } from "../../../constants";

interface ModeTabProps {
    isUserTeacher: boolean;
    isTeacherMode: boolean;
    onModeToggle: () => void;
}

const ModeTab: React.FC<ModeTabProps> = ({ isUserTeacher, isTeacherMode, onModeToggle }) => {
    if (!isUserTeacher) {
        return (
            <div className="alert alert-info" role="alert">
                <h5 className="alert-heading">
                    <i className="bi bi-info-circle me-2"></i>
                    Student Mode
                </h5>
                <p>You are currently using {APP_CONFIG.NAME} in student mode. Only teachers can switch modes.</p>
            </div>
        );
    }

    return (
        <div className="d-flex flex-column gap-3">
            {/* Selector de modo */}
            <div className="card">
                <div className="card-body">
                    <h5 className="card-title mb-3">
                        <i className="bi bi-gear me-2"></i>
                        Mode Selection
                    </h5>
                    <div className="d-flex flex-column gap-2">
                        <div className="form-check">
                            <input
                                className="form-check-input"
                                type="radio"
                                name="modeSelector"
                                id="modeTeacher"
                                checked={isTeacherMode}
                                onChange={() => isTeacherMode || onModeToggle()}
                            />
                            <label className="form-check-label fw-bold" htmlFor="modeTeacher">
                                Teacher Mode
                            </label>
                        </div>
                        <div className="form-check">
                            <input
                                className="form-check-input"
                                type="radio"
                                name="modeSelector"
                                id="modeStudent"
                                checked={!isTeacherMode}
                                onChange={() => !isTeacherMode || onModeToggle()}
                            />
                            <label className="form-check-label fw-bold" htmlFor="modeStudent">
                                Student Mode
                            </label>
                        </div>
                    </div>
                </div>
            </div>

            {/* Descripción del modo activo */}
            {isTeacherMode ? (
                <div className="card border-primary">
                    <div className="card-header bg-primary text-white">
                        <h6 className="mb-0">
                            <i className="bi bi-mortarboard-fill me-2"></i>
                            Teacher mode features
                        </h6>
                    </div>
                    <div className="card-body">
                        <p className="card-text mb-3">
                            In teacher mode, you have access to advanced configuration and management tools:
                        </p>
                        <ul className="list-unstyled mb-0">
                            <li className="mb-2">
                                <i className="bi bi-check-circle-fill text-success me-2"></i>
                                <strong>Configure Course:</strong> Set up course-wide settings, lab sequences, and
                                progress requirements
                            </li>
                            <li className="mb-2">
                                <i className="bi bi-check-circle-fill text-success me-2"></i>
                                <strong>Configure Labs:</strong> Customize exercises, enable/disable them, and mark
                                challenge exercises
                            </li>
                            <li className="mb-2">
                                <i className="bi bi-check-circle-fill text-success me-2"></i>
                                <strong>Full Lab Access:</strong> No labs are blocked, allowing you to test and preview
                                all content
                            </li>
                            <li className="mb-2">
                                <i className="bi bi-check-circle-fill text-success me-2"></i>
                                <strong>Agent Configuration:</strong> Access to LLM settings and agent behavior
                                customization
                            </li>
                            <li className="mb-0">
                                <i className="bi bi-check-circle-fill text-success me-2"></i>
                                <strong>Course Chat:</strong> Ask questions about course structure and content without
                                exercise context
                            </li>
                        </ul>
                    </div>
                </div>
            ) : (
                <div className="card border-primary">
                    <div className="card-header bg-primary text-white">
                        <h6 className="mb-0">
                            <i className="bi bi-mortarboard-fill me-2"></i>
                            Student mode features
                        </h6>
                    </div>
                    <div className="card-body">
                        <p className="card-text mb-3">
                            In student mode, the extension helps you learn and practice with the following features:
                        </p>
                        <ul className="list-unstyled mb-0">
                            <li className="mb-2">
                                <i className="bi bi-check-circle-fill text-primary me-2"></i>
                                <strong>Exercises Tab:</strong> View all your saved explanations and evaluations for
                                quick access
                            </li>
                            <li className="mb-2">
                                <i className="bi bi-check-circle-fill text-primary me-2"></i>
                                <strong>Chat Agent:</strong> Ask for explanations, request solution evaluations, and get
                                help with exercises
                            </li>
                            <li className="mb-2">
                                <i className="bi bi-check-circle-fill text-primary me-2"></i>
                                <strong>Progress Tracking:</strong> View your progress through labs and completed
                                exercises
                            </li>
                            <li className="mb-2">
                                <i className="bi bi-check-circle-fill text-primary me-2"></i>
                                <strong>Lab Sequencing:</strong> Labs are unlocked progressively as you complete
                                required challenge exercises
                            </li>
                            <li className="mb-0">
                                <i className="bi bi-check-circle-fill text-primary me-2"></i>
                                <strong>Exercise Context:</strong> The agent is aware of the current lab's exercises and
                                can provide targeted help
                            </li>
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ModeTab;
