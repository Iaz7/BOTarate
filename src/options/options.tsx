import React, { useEffect, useState } from "react";
import { ImportExportTab } from "../components/ImportExportTab";
import ProgressConfigTab from "../components/ProgressConfigTab";
import { APP_CONFIG } from "../constants";
import "../content/bootstrap.css";
import { AssistantConfig } from "../util/ai/AssistantConfig";
import { OpenAIService } from "../util/ai/OpenAIService";
import { ConfigManager } from "../util/config/ConfigManager";
import { AppMode, ModeManager } from "../util/config/ModeManager";
import { AssistantConfigStorageManager } from "../util/storage/AssistantConfigStorageManager";

type TabType = "llm" | "assistants" | "progress" | "import-export";
type AssistantSection = "general" | "course" | "exercise" | "evaluation" | "explanation";

// Componentes reutilizables para campos de configuración
interface ConfigFieldProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    description: string;
}

const ConfigTextField: React.FC<ConfigFieldProps> = ({ label, value, onChange, description }) => (
    <div className="mb-3">
        <label className="form-label fw-bold">{label}</label>
        <input type="text" className="form-control" value={value} onChange={e => onChange(e.target.value)} />
        <div className="form-text">{description}</div>
    </div>
);

interface ConfigTextAreaProps extends ConfigFieldProps {
    rows?: number;
}

const ConfigTextArea: React.FC<ConfigTextAreaProps> = ({ label, value, onChange, description, rows = 3 }) => (
    <div className="mb-3">
        <label className="form-label fw-bold">{label}</label>
        <textarea className="form-control" rows={rows} value={value} onChange={e => onChange(e.target.value)} />
        <div className="form-text">{description}</div>
    </div>
);

const Options: React.FC = () => {
    // LLM Configuration
    const [selectedProvider, setSelectedProvider] = useState<number>(0);
    const [modelList, setModelList] = useState<string[]>([]);
    const [modelListEnabled, setModelListEnabled] = useState<boolean>(false);
    const [selectedModel, setSelectedModel] = useState<string>("");
    const [apiKey, setApiKey] = useState<string>("");
    const [saveMessage, setSaveMessage] = useState<string>("");
    const [isConfigLoaded, setIsConfigLoaded] = useState<boolean>(false);
    const [apiKeyError, setApiKeyError] = useState<string>("");

    // Tab navigation
    const [activeTab, setActiveTab] = useState<TabType>("llm");
    const [activeAssistantSection, setActiveAssistantSection] = useState<AssistantSection>("general");

    // Assistant Configuration
    const [assistantConfig, setAssistantConfig] = useState<AssistantConfig | null>(null);
    const [assistantSaveMessage, setAssistantSaveMessage] = useState<string>("");

    // Mode Configuration
    const [isTeacherMode, setIsTeacherMode] = useState<boolean>(false);
    const [isUserTeacher, setIsUserTeacher] = useState<boolean>(false);

    // Validación y carga de modelos/API key
    const validateAndLoadModels = (providerIndex: number, modelToPreselect?: string, apiKeyValue?: string) => {
        setModelList([]);
        setModelListEnabled(false);
        setApiKeyError("");
        if (typeof apiKeyValue === "string") {
            ConfigManager.setProviderKey(providerIndex, apiKeyValue);
        }
        OpenAIService.getModelList(ConfigManager.getProvider(providerIndex))
            .then(list => {
                const cleanList = list.map(m => m.replace("models/", ""));
                setModelList(cleanList);
                const cleanModelToPreselect = modelToPreselect?.replace("models/", "") || "";
                const compatibleModels = cleanList.filter(m => ConfigManager.COMPATIBLE_MODELS.includes(m));
                const modelToSelect =
                    cleanModelToPreselect && compatibleModels.includes(cleanModelToPreselect)
                        ? cleanModelToPreselect
                        : compatibleModels[0] || "";
                setSelectedModel(modelToSelect);
                setModelListEnabled(true);
                setApiKeyError("");
            })
            .catch(e => {
                setModelList([]);
                setModelListEnabled(false);
                if ((apiKeyValue ?? apiKey).trim()) {
                    setApiKeyError("Invalid API key. Please enter a valid API key to view models.");
                } else {
                    setApiKeyError("");
                }
            });
    };

    // Cargar configuración inicial
    useEffect(() => {
        const loadConfiguration = async () => {
            // Verificar si el usuario es profesor en Egela comunicándose con el background
            const response = await chrome.runtime.sendMessage({ action: "checkUserRole" });
            const userIsTeacher = response?.success ? response.isTeacher : false;
            setIsUserTeacher(userIsTeacher);

            // Si el usuario no es profesor, forzar modo alumno
            if (!userIsTeacher) {
                await ModeManager.setMode(AppMode.STUDENT);
                setIsTeacherMode(false);
            } else {
                // Si es profesor, usar el modo configurado
                const teacherMode = await ModeManager.isTeacherMode();
                setIsTeacherMode(teacherMode);
            }

            // Cargar configuración LLM
            await ConfigManager.loadConfig();

            const currentProvider = ConfigManager.getSelectedProvider();
            const providerIndex = ConfigManager.getProviderList().indexOf(currentProvider.name);
            setSelectedProvider(Math.max(providerIndex, 0));
            setApiKey(currentProvider.key || "");

            // Obtener el modelo seleccionado guardado
            const savedModel = ConfigManager.getSelectedModel();
            console.log("Model saved in ConfigManager:", savedModel);

            // Validar y cargar modelos
            validateAndLoadModels(providerIndex, savedModel, currentProvider.key);

            // Cargar configuración de asistentes
            const config = await AssistantConfigStorageManager.loadConfig();
            setAssistantConfig(config);

            setIsConfigLoaded(true);
        };

        loadConfiguration();
    }, []);

    const handleProviderChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const providerIndex = Number.parseInt(event.target.value);
        setSelectedProvider(providerIndex);
        const newApiKey = ConfigManager.getProvider(providerIndex).key || "";
        setApiKey(newApiKey);
        validateAndLoadModels(providerIndex, undefined, newApiKey);
    };

    // Validar la API key cada vez que cambia
    useEffect(() => {
        if (!isConfigLoaded) return;
        validateAndLoadModels(selectedProvider, undefined, apiKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [apiKey, selectedProvider]);

    const handleSaveConfiguration = () => {
        try {
            // Seleccionar el proveedor
            ConfigManager.selectProvider(selectedProvider);

            // Guardar la API key
            if (apiKey.trim()) {
                ConfigManager.setProviderKey(selectedProvider, apiKey.trim());
            }

            ConfigManager.selectModel(selectedModel);
            console.log("Selected model" + selectedModel);

            // Enviar la configuración actualizada al background script
            // El background script se encargará de llamar a OpenAIService.loadProviderConfig()
            chrome.runtime
                .sendMessage({
                    action: "updateConfig",
                    config: {
                        providerKeys: ConfigManager.getProviderList().map(
                            (_, index) => ConfigManager.getProvider(index).key
                        ),
                        selectedProvider: selectedProvider,
                        selectedModel: selectedModel,
                    },
                })
                .catch(error => {
                    console.error("Error sending config to background:", error);
                });

            setSaveMessage(
                "Configuration saved successfully. Provider: " +
                    ConfigManager.getSelectedProvider().baseUrl +
                    ". Model: " +
                    ConfigManager.getSelectedModel()
            );
        } catch (error) {
            console.error("Error saving configuration:", error);
            setSaveMessage("Error saving configuration");
        }
    };

    const handleSaveAssistantConfig = async () => {
        if (!assistantConfig) return;

        try {
            await AssistantConfigStorageManager.saveConfig(assistantConfig);
            setAssistantSaveMessage("Assistant configuration saved successfully");

            // Notificar al background script para recargar la configuración
            chrome.runtime.sendMessage({ action: "reloadAssistantConfig" }).catch(error => {
                console.error("Error notifying background:", error);
            });
        } catch (error) {
            console.error("Error saving assistant configuration:", error);
            setAssistantSaveMessage("Error saving configuration");
        }
    };

    const handleResetAssistantConfig = async () => {
        if (confirm("Are you sure you want to restore default settings?")) {
            await AssistantConfigStorageManager.resetToDefault();
            const config = await AssistantConfigStorageManager.loadConfig();
            setAssistantConfig(config);
            setAssistantSaveMessage("Configuration restored to default values");
        }
    };

    const updateAssistantField = (section: keyof AssistantConfig, field: string, value: string) => {
        if (!assistantConfig) return;

        setAssistantConfig({
            ...assistantConfig,
            [section]: {
                ...(assistantConfig[section] as any),
                [field]: value,
            },
        });
    };

    // Mostrar mensaje de carga mientras se inicializa la configuración
    if (!isConfigLoaded) {
        return (
            <div className="container-fluid py-4">
                <div className="row justify-content-center">
                    <div className="col-11 col-xl-10">
                        <div className="text-center">
                            <output className="spinner-border">
                                <span className="visually-hidden">Loading configuration...</span>
                            </output>
                            <p className="mt-2">Loading configuration...</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const renderAssistantSection = () => {
        if (!assistantConfig) return null;

        switch (activeAssistantSection) {
            case "general":
                return (
                    <div>
                        <h5 className="mb-3">General configuration</h5>
                        <ConfigTextField
                            label="Subject Name"
                            value={assistantConfig.common.subjectName}
                            onChange={value => updateAssistantField("common", "subjectName", value)}
                            description="Name of the subject for which assistants are configured"
                        />
                        <ConfigTextField
                            label="Platform Name"
                            value={assistantConfig.common.platformName}
                            onChange={value => updateAssistantField("common", "platformName", value)}
                            description="Name of the educational platform (e.g., Moodle, Canvas, Egela)"
                        />
                        <ConfigTextField
                            label="Institution Name"
                            value={assistantConfig.common.institutionName}
                            onChange={value => updateAssistantField("common", "institutionName", value)}
                            description="Name of the university or educational institution"
                        />
                    </div>
                );
            case "course":
                return (
                    <div>
                        <h5 className="mb-3">Course Assistant (General Chat)</h5>
                        <ConfigTextArea
                            label="Assistant Role"
                            value={assistantConfig.courseAssistant.role}
                            onChange={value => updateAssistantField("courseAssistant", "role", value)}
                            description="Defines the main purpose of the course assistant"
                            rows={2}
                        />
                        <ConfigTextArea
                            label="Tools Description"
                            value={assistantConfig.courseAssistant.toolsDescription}
                            onChange={value => updateAssistantField("courseAssistant", "toolsDescription", value)}
                            description="Describes the tools available to the assistant"
                            rows={2}
                        />
                        <ConfigTextArea
                            label="Instructions"
                            value={assistantConfig.courseAssistant.instructions}
                            onChange={value => updateAssistantField("courseAssistant", "instructions", value)}
                            description="Specific assistant behavior instructions"
                            rows={8}
                        />
                        <ConfigTextArea
                            label="Additional Rules"
                            value={assistantConfig.courseAssistant.additionalRules || ""}
                            onChange={value => updateAssistantField("courseAssistant", "additionalRules", value)}
                            description="Optional additional rules"
                            rows={3}
                        />
                    </div>
                );
            case "exercise":
                return (
                    <div>
                        <h5 className="mb-3">Exercise identification assistant</h5>
                        <ConfigTextArea
                            label="Assistant role"
                            value={assistantConfig.exerciseAssistant.role}
                            onChange={value => updateAssistantField("exerciseAssistant", "role", value)}
                            description="Defines the purpose of the identification assistant"
                            rows={2}
                        />
                        <ConfigTextArea
                            label="Context description"
                            value={assistantConfig.exerciseAssistant.contextDescription}
                            onChange={value => updateAssistantField("exerciseAssistant", "contextDescription", value)}
                            description="Describes what type of context is expected for exercises"
                            rows={2}
                        />
                        <ConfigTextArea
                            label="Concept examples"
                            value={assistantConfig.exerciseAssistant.conceptsExamples}
                            onChange={value => updateAssistantField("exerciseAssistant", "conceptsExamples", value)}
                            description="Examples of concepts worked on in exercises"
                            rows={2}
                        />
                        <ConfigTextArea
                            label="Criteria for identifying exercises"
                            value={assistantConfig.exerciseAssistant.exerciseCriteria}
                            onChange={value => updateAssistantField("exerciseAssistant", "exerciseCriteria", value)}
                            description="Criteria for identifying what constitutes an exercise"
                            rows={6}
                        />
                    </div>
                );
            case "evaluation":
                return (
                    <div>
                        <h5 className="mb-3">Evaluation assistant</h5>
                        <ConfigTextArea
                            label="Assistant role"
                            value={assistantConfig.evaluationAssistant.role}
                            onChange={value => updateAssistantField("evaluationAssistant", "role", value)}
                            description="Defines the purpose of the evaluation assistant"
                            rows={2}
                        />
                        <ConfigTextArea
                            label="Task description"
                            value={assistantConfig.evaluationAssistant.taskDescription}
                            onChange={value => updateAssistantField("evaluationAssistant", "taskDescription", value)}
                            description="Describes the main task of the evaluator"
                            rows={3}
                        />
                        <ConfigTextArea
                            label="Evaluation criteria"
                            value={assistantConfig.evaluationAssistant.evaluationCriteria}
                            onChange={value => updateAssistantField("evaluationAssistant", "evaluationCriteria", value)}
                            description="Detailed criteria for evaluating solutions"
                            rows={10}
                        />
                        <ConfigTextArea
                            label="Scoring scale"
                            value={assistantConfig.evaluationAssistant.scoringScale}
                            onChange={value => updateAssistantField("evaluationAssistant", "scoringScale", value)}
                            description="Description of the scoring scale"
                            rows={5}
                        />
                        <ConfigTextArea
                            label="Feedback format"
                            value={assistantConfig.evaluationAssistant.feedbackFormat}
                            onChange={value => updateAssistantField("evaluationAssistant", "feedbackFormat", value)}
                            description="Instructions on how to format feedback"
                            rows={6}
                        />
                    </div>
                );
            case "explanation":
                return (
                    <div>
                        <h5 className="mb-3">Explanation assistant</h5>
                        <ConfigTextArea
                            label="Assistant role"
                            value={assistantConfig.explanationAssistant.role}
                            onChange={value => updateAssistantField("explanationAssistant", "role", value)}
                            description="Defines the purpose of the tutorial assistant"
                            rows={2}
                        />
                        <ConfigTextArea
                            label="Task description"
                            value={assistantConfig.explanationAssistant.taskDescription}
                            onChange={value => updateAssistantField("explanationAssistant", "taskDescription", value)}
                            description="Describes the main task of the tutor"
                            rows={2}
                        />
                        <ConfigTextArea
                            label="Methodology"
                            value={assistantConfig.explanationAssistant.methodology}
                            onChange={value => updateAssistantField("explanationAssistant", "methodology", value)}
                            description="Pedagogical methodology for generating explanations"
                            rows={15}
                        />
                        <ConfigTextArea
                            label="Output format"
                            value={assistantConfig.explanationAssistant.outputFormat}
                            onChange={value => updateAssistantField("explanationAssistant", "outputFormat", value)}
                            description="Expected format of explanations"
                            rows={6}
                        />
                    </div>
                );
            default:
                return null;
        }
    };

    const renderProgressTab = () => {
        if (!isTeacherMode) return null;

        return (
            <div className="card mb-4">
                <div className="card-header">
                    <h5 className="card-title mb-0">Global progress criteria</h5>
                </div>
                <div className="card-body">
                    <ProgressConfigTab isActive={activeTab === "progress"} />
                </div>
            </div>
        );
    };

    return (
        <div className="container-fluid py-4">
            <div className="row justify-content-center">
                <div className="col-11 col-xl-10">
                    <h1 className="h2 mb-4">{APP_CONFIG.NAME} - Configuration</h1>

                    {/* Tabs de navegación principal */}
                    <ul className="nav nav-pills mb-4">
                        {/* Solo mostrar configuración completa a profesores */}
                        {isUserTeacher && (
                            <>
                                <li className="nav-item">
                                    <button
                                        className={`nav-link ${activeTab === "llm" ? "active" : ""}`}
                                        onClick={() => setActiveTab("llm")}
                                    >
                                        LLM configuration
                                    </button>
                                </li>
                                {isTeacherMode && (
                                    <li className="nav-item">
                                        <button
                                            className={`nav-link ${activeTab === "assistants" ? "active" : ""}`}
                                            onClick={() => setActiveTab("assistants")}
                                        >
                                            Assistants configuration
                                        </button>
                                    </li>
                                )}
                                {isTeacherMode && (
                                    <li className="nav-item">
                                        <button
                                            className={`nav-link ${activeTab === "progress" ? "active" : ""}`}
                                            onClick={() => setActiveTab("progress")}
                                        >
                                            Configure progress
                                        </button>
                                    </li>
                                )}
                            </>
                        )}
                        <li className="nav-item">
                            <button
                                className={`nav-link ${activeTab === "import-export" ? "active" : ""}`}
                                onClick={() => setActiveTab("import-export")}
                            >
                                Import/Export
                            </button>
                        </li>
                    </ul>

                    {/* Mensaje informativo para alumnos */}
                    {!isUserTeacher && (
                        <div className="alert alert-info mb-4">
                            <strong>Student mode:</strong> To configure the extension, import the configuration file
                            provided by your teacher.
                        </div>
                    )}

                    {/* Contenido de LLM - solo para profesores */}
                    {activeTab === "llm" && isUserTeacher && (
                        <div className="card mb-4">
                            <div className="card-header">
                                <h5 className="card-title mb-0">LLM providers</h5>
                            </div>
                            <div className="card-body">
                                {saveMessage && (
                                    <div
                                        className={`alert ${
                                            saveMessage.includes("Error") ? "alert-danger" : "alert-success"
                                        } alert-dismissible fade show`}
                                        role="alert"
                                    >
                                        {saveMessage}
                                    </div>
                                )}
                                <div className="row g-3">
                                    <div className="col-md-3">
                                        <label htmlFor="providerSelect" className="form-label">
                                            Provider
                                        </label>
                                        <select
                                            className="form-select"
                                            id="providerSelect"
                                            value={selectedProvider}
                                            onChange={handleProviderChange}
                                        >
                                            {ConfigManager.getProviderList().map((provider, index) => (
                                                <option key={provider} value={index}>
                                                    {provider}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="col-md-6">
                                        <label htmlFor="apiKey" className="form-label">
                                            API Key
                                        </label>
                                        <input
                                            type="password"
                                            className={`form-control${apiKeyError ? " is-invalid" : ""}`}
                                            id="apiKey"
                                            placeholder="Enter your API Key"
                                            autoComplete="off"
                                            value={apiKey}
                                            onChange={e => setApiKey(e.target.value)}
                                        />
                                        {apiKeyError && <div className="invalid-feedback">{apiKeyError}</div>}
                                    </div>
                                    <div className="col-md-3">
                                        <label htmlFor="modelSelect" className="form-label">
                                            Model
                                        </label>
                                        <select
                                            className={`form-select${
                                                !modelListEnabled && apiKeyError ? " is-invalid" : ""
                                            }`}
                                            id="modelSelect"
                                            disabled={!modelListEnabled}
                                            value={selectedModel}
                                            onChange={e => setSelectedModel(e.target.value)}
                                        >
                                            {modelList
                                                .filter(m => ConfigManager.COMPATIBLE_MODELS.includes(m))
                                                .map((model, index) => (
                                                    <option key={model} value={model}>
                                                        {model}
                                                    </option>
                                                ))}
                                        </select>
                                        {!modelListEnabled && apiKey.trim() && apiKeyError && (
                                            <div className="invalid-feedback">
                                                Enter a valid API key to view models.
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="row mt-3">
                                    <div className="col-12">
                                        <button
                                            type="button"
                                            className="btn btn-primary me-2"
                                            onClick={handleSaveConfiguration}
                                            disabled={!!apiKeyError || !modelListEnabled}
                                        >
                                            Save configuration
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Contenido de Asistentes */}
                    {activeTab === "assistants" && (
                        <div>
                            {assistantSaveMessage && (
                                <div
                                    className={`alert ${
                                        assistantSaveMessage.includes("Error") ? "alert-danger" : "alert-success"
                                    } alert-dismissible fade show`}
                                    role="alert"
                                >
                                    {assistantSaveMessage}
                                    <button
                                        type="button"
                                        className="btn-close"
                                        onClick={() => setAssistantSaveMessage("")}
                                        aria-label="Close"
                                    ></button>
                                </div>
                            )}

                            {/* Sub-navegación para secciones de asistentes */}
                            <ul className="nav nav-pills mb-3">
                                <li className="nav-item">
                                    <button
                                        className={`nav-link ${activeAssistantSection === "general" ? "active" : ""}`}
                                        onClick={() => setActiveAssistantSection("general")}
                                    >
                                        General
                                    </button>
                                </li>
                                <li className="nav-item">
                                    <button
                                        className={`nav-link ${activeAssistantSection === "course" ? "active" : ""}`}
                                        onClick={() => setActiveAssistantSection("course")}
                                    >
                                        Course assistant
                                    </button>
                                </li>
                                <li className="nav-item">
                                    <button
                                        className={`nav-link ${activeAssistantSection === "exercise" ? "active" : ""}`}
                                        onClick={() => setActiveAssistantSection("exercise")}
                                    >
                                        Identification
                                    </button>
                                </li>
                                <li className="nav-item">
                                    <button
                                        className={`nav-link ${
                                            activeAssistantSection === "evaluation" ? "active" : ""
                                        }`}
                                        onClick={() => setActiveAssistantSection("evaluation")}
                                    >
                                        Evaluation
                                    </button>
                                </li>
                                <li className="nav-item">
                                    <button
                                        className={`nav-link ${
                                            activeAssistantSection === "explanation" ? "active" : ""
                                        }`}
                                        onClick={() => setActiveAssistantSection("explanation")}
                                    >
                                        Explanation
                                    </button>
                                </li>
                            </ul>

                            <div className="card">
                                <div className="card-body">
                                    {renderAssistantSection()}

                                    <div className="mt-4">
                                        <button
                                            type="button"
                                            className="btn btn-primary me-2"
                                            onClick={handleSaveAssistantConfig}
                                        >
                                            Save configuration
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-outline-secondary"
                                            onClick={handleResetAssistantConfig}
                                        >
                                            Restore default values
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === "progress" && renderProgressTab()}

                    {/* Contenido de Importar/Exportar */}
                    {activeTab === "import-export" && <ImportExportTab />}
                </div>
            </div>
        </div>
    );
};

export default Options;
