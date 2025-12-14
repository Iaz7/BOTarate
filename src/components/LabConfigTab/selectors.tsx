import React from "react";
import { ReasoningEffort, VerbosityLevel } from "./types";

interface VerbositySelectorProps {
    labId: string;
    currentVerbosity: VerbosityLevel;
    hasContext: boolean;
    isDisabled: boolean;
    onChange: (labId: string, verbosity: VerbosityLevel) => void;
}

export const VerbositySelector: React.FC<VerbositySelectorProps> = ({
    labId,
    currentVerbosity,
    hasContext,
    isDisabled,
    onChange,
}) => (
    <div className="mb-2 d-flex align-items-center">
        <div style={{ minWidth: 150 }} className="me-3">
            <label className="form-label small text-muted mb-0">Verbosity level</label>
        </div>
        <div className="btn-group" role="group" aria-label="Verbosity Level">
            <input
                type="radio"
                className="btn-check"
                name={`verbosity-${labId}`}
                id={`verbosity-low-${labId}`}
                autoComplete="off"
                checked={currentVerbosity === "low"}
                onChange={() => onChange(labId, "low")}
                disabled={isDisabled || !hasContext}
            />
            <label
                className={`btn btn-outline-primary ${!hasContext ? "disabled" : ""}`}
                htmlFor={`verbosity-low-${labId}`}
                title="Concise and direct answers"
            >
                Low
            </label>
            <input
                type="radio"
                className="btn-check"
                name={`verbosity-${labId}`}
                id={`verbosity-medium-${labId}`}
                autoComplete="off"
                checked={currentVerbosity === "medium"}
                onChange={() => onChange(labId, "medium")}
                disabled={isDisabled || !hasContext}
            />
            <label
                className={`btn btn-outline-primary ${!hasContext ? "disabled" : ""}`}
                htmlFor={`verbosity-medium-${labId}`}
                title="Balanced detail level"
            >
                Medium
            </label>
            <input
                type="radio"
                className="btn-check"
                name={`verbosity-${labId}`}
                id={`verbosity-high-${labId}`}
                autoComplete="off"
                checked={currentVerbosity === "high"}
                onChange={() => onChange(labId, "high")}
                disabled={isDisabled || !hasContext}
            />
            <label
                className={`btn btn-outline-primary ${!hasContext ? "disabled" : ""}`}
                htmlFor={`verbosity-high-${labId}`}
                title="Detailed and extensive explanations"
            >
                High
            </label>
        </div>
    </div>
);

interface ReasoningSelectorProps {
    labId: string;
    currentReasoning: ReasoningEffort;
    hasContext: boolean;
    isDisabled: boolean;
    onChange: (labId: string, reasoningEffort: ReasoningEffort) => void;
}

export const ReasoningSelector: React.FC<ReasoningSelectorProps> = ({
    labId,
    currentReasoning,
    hasContext,
    isDisabled,
    onChange,
}) => (
    <div className="mb-2 d-flex align-items-center">
        <div style={{ minWidth: 150 }} className="me-3">
            <label className="form-label small text-muted mb-0">Reasoning effort</label>
        </div>
        <div className="btn-group" role="group" aria-label="Reasoning Effort">
            <input
                type="radio"
                className="btn-check"
                name={`reasoning-${labId}`}
                id={`reasoning-minimal-${labId}`}
                autoComplete="off"
                checked={currentReasoning === "minimal"}
                onChange={() => onChange(labId, "minimal")}
                disabled={isDisabled || !hasContext}
            />
            <label
                className={`btn btn-outline-primary ${!hasContext ? "disabled" : ""}`}
                htmlFor={`reasoning-minimal-${labId}`}
                title="Direct answer without reasoning"
            >
                Minimal
            </label>
            <input
                type="radio"
                className="btn-check"
                name={`reasoning-${labId}`}
                id={`reasoning-low-${labId}`}
                autoComplete="off"
                checked={currentReasoning === "low"}
                onChange={() => onChange(labId, "low")}
                disabled={isDisabled || !hasContext}
            />
            <label
                className={`btn btn-outline-primary ${!hasContext ? "disabled" : ""}`}
                htmlFor={`reasoning-low-${labId}`}
                title="Basic reasoning"
            >
                Low
            </label>
            <input
                type="radio"
                className="btn-check"
                name={`reasoning-${labId}`}
                id={`reasoning-medium-${labId}`}
                autoComplete="off"
                checked={currentReasoning === "medium"}
                onChange={() => onChange(labId, "medium")}
                disabled={isDisabled || !hasContext}
            />
            <label
                className={`btn btn-outline-primary ${!hasContext ? "disabled" : ""}`}
                htmlFor={`reasoning-medium-${labId}`}
                title="Moderate reasoning"
            >
                Medium
            </label>
            <input
                type="radio"
                className="btn-check"
                name={`reasoning-${labId}`}
                id={`reasoning-high-${labId}`}
                autoComplete="off"
                checked={currentReasoning === "high"}
                onChange={() => onChange(labId, "high")}
                disabled={isDisabled || !hasContext}
            />
            <label
                className={`btn btn-outline-primary ${!hasContext ? "disabled" : ""}`}
                htmlFor={`reasoning-high-${labId}`}
                title="Detailed step-by-step reasoning"
            >
                High
            </label>
        </div>
    </div>
);
