import React, { useEffect, useState } from "react";
import { ImportExportTab } from "../components/ImportExportTab";
import "../content/bootstrap.css";
import { AssistantConfig } from "../util/ai/AssistantConfig";
import { OpenAIService } from "../util/ai/OpenAIService";
import { ConfigManager } from "../util/config/ConfigManager";
import { AssistantConfigStorageManager } from "../util/storage/AssistantConfigStorageManager";

type TabType = "llm" | "assistants" | "import-export";
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

    // Tab navigation
    const [activeTab, setActiveTab] = useState<TabType>("llm");
    const [activeAssistantSection, setActiveAssistantSection] = useState<AssistantSection>("general");

    // Assistant Configuration
    const [assistantConfig, setAssistantConfig] = useState<AssistantConfig | null>(null);
    const [assistantSaveMessage, setAssistantSaveMessage] = useState<string>("");

    const loadModelList = (providerIndex: number, modelToPreselect?: string) => {
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
            })
            .catch(e => {
                console.error("Error al cargar lista de modelos:", e);
                setModelList(["Set API key first"]);
                setModelListEnabled(false);
            });
    };

    // Cargar configuración inicial
    useEffect(() => {
        const loadConfiguration = async () => {
            // Cargar configuración LLM
            await ConfigManager.loadConfig();

            const currentProvider = ConfigManager.getSelectedProvider();
            const providerIndex = ConfigManager.getProviderList().indexOf(currentProvider.name);
            setSelectedProvider(Math.max(providerIndex, 0));
            setApiKey(currentProvider.key || "");

            // Obtener el modelo seleccionado guardado
            const savedModel = ConfigManager.getSelectedModel();
            console.log("Modelo guardado en ConfigManager:", savedModel);

            loadModelList(providerIndex, savedModel);

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
        setApiKey(ConfigManager.getProvider(providerIndex).key || "");
        loadModelList(providerIndex);
    };

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
                    console.error("Error enviando configuración al background:", error);
                });

            setSaveMessage(
                "Configuración guardada correctamente. Proveedor: " +
                    ConfigManager.getSelectedProvider().baseUrl +
                    ". Modelo: " +
                    ConfigManager.getSelectedModel()
            );
        } catch (error) {
            console.error("Error al guardar la configuración:", error);
            setSaveMessage("Error al guardar la configuración");
        }
    };

    const handleSaveAssistantConfig = async () => {
        if (!assistantConfig) return;

        try {
            await AssistantConfigStorageManager.saveConfig(assistantConfig);
            setAssistantSaveMessage("Configuración de asistentes guardada correctamente");

            // Notificar al background script para recargar la configuración
            chrome.runtime.sendMessage({ action: "reloadAssistantConfig" }).catch(error => {
                console.error("Error notificando al background:", error);
            });
        } catch (error) {
            console.error("Error al guardar configuración de asistentes:", error);
            setAssistantSaveMessage("Error al guardar la configuración");
        }
    };

    const handleResetAssistantConfig = async () => {
        if (confirm("¿Estás seguro de que deseas restaurar la configuración por defecto?")) {
            await AssistantConfigStorageManager.resetToDefault();
            const config = await AssistantConfigStorageManager.loadConfig();
            setAssistantConfig(config);
            setAssistantSaveMessage("Configuración restaurada a valores por defecto");
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
                            <div className="spinner-border" role="status">
                                <span className="visually-hidden">Cargando configuración...</span>
                            </div>
                            <p className="mt-2">Cargando configuración...</p>
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
                        <h5 className="mb-3">Configuración General</h5>
                        <ConfigTextField
                            label="Nombre de la Asignatura"
                            value={assistantConfig.common.subjectName}
                            onChange={value => updateAssistantField("common", "subjectName", value)}
                            description="Nombre de la asignatura para la que se configuran los asistentes"
                        />
                        <ConfigTextField
                            label="Nombre de la Plataforma"
                            value={assistantConfig.common.platformName}
                            onChange={value => updateAssistantField("common", "platformName", value)}
                            description="Nombre de la plataforma educativa (ej: Moodle, Canvas, Egela)"
                        />
                        <ConfigTextField
                            label="Nombre de la Institución"
                            value={assistantConfig.common.institutionName}
                            onChange={value => updateAssistantField("common", "institutionName", value)}
                            description="Nombre de la universidad o institución educativa"
                        />
                    </div>
                );
            case "course":
                return (
                    <div>
                        <h5 className="mb-3">Asistente de Curso (Chat General)</h5>
                        <ConfigTextArea
                            label="Rol del Asistente"
                            value={assistantConfig.courseAssistant.role}
                            onChange={value => updateAssistantField("courseAssistant", "role", value)}
                            description="Define el propósito principal del asistente de curso"
                            rows={2}
                        />
                        <ConfigTextArea
                            label="Descripción de Herramientas"
                            value={assistantConfig.courseAssistant.toolsDescription}
                            onChange={value => updateAssistantField("courseAssistant", "toolsDescription", value)}
                            description="Describe las herramientas disponibles para el asistente"
                            rows={2}
                        />
                        <ConfigTextArea
                            label="Instrucciones"
                            value={assistantConfig.courseAssistant.instructions}
                            onChange={value => updateAssistantField("courseAssistant", "instructions", value)}
                            description="Instrucciones específicas de comportamiento del asistente"
                            rows={8}
                        />
                        <ConfigTextArea
                            label="Reglas Adicionales"
                            value={assistantConfig.courseAssistant.additionalRules || ""}
                            onChange={value => updateAssistantField("courseAssistant", "additionalRules", value)}
                            description="Reglas adicionales opcionales"
                            rows={3}
                        />
                    </div>
                );
            case "exercise":
                return (
                    <div>
                        <h5 className="mb-3">Asistente de Identificación de Ejercicios</h5>
                        <ConfigTextArea
                            label="Rol del Asistente"
                            value={assistantConfig.exerciseAssistant.role}
                            onChange={value => updateAssistantField("exerciseAssistant", "role", value)}
                            description="Define el propósito del asistente de identificación"
                            rows={2}
                        />
                        <ConfigTextArea
                            label="Descripción del Contexto"
                            value={assistantConfig.exerciseAssistant.contextDescription}
                            onChange={value => updateAssistantField("exerciseAssistant", "contextDescription", value)}
                            description="Describe qué tipo de contexto se espera para los ejercicios"
                            rows={2}
                        />
                        <ConfigTextField
                            label="Nombre del Campo de Contexto"
                            value={assistantConfig.exerciseAssistant.contextFieldName}
                            onChange={value => updateAssistantField("exerciseAssistant", "contextFieldName", value)}
                            description="Nombre técnico del campo que almacena el contexto"
                        />
                        <ConfigTextArea
                            label="Ejemplos de Conceptos"
                            value={assistantConfig.exerciseAssistant.conceptsExamples}
                            onChange={value => updateAssistantField("exerciseAssistant", "conceptsExamples", value)}
                            description="Ejemplos de conceptos que se trabajan en los ejercicios"
                            rows={2}
                        />
                        <ConfigTextArea
                            label="Criterios para Identificar Ejercicios"
                            value={assistantConfig.exerciseAssistant.exerciseCriteria}
                            onChange={value => updateAssistantField("exerciseAssistant", "exerciseCriteria", value)}
                            description="Criterios para identificar qué constituye un ejercicio"
                            rows={6}
                        />
                    </div>
                );
            case "evaluation":
                return (
                    <div>
                        <h5 className="mb-3">Asistente de Evaluación</h5>
                        <ConfigTextArea
                            label="Rol del Asistente"
                            value={assistantConfig.evaluationAssistant.role}
                            onChange={value => updateAssistantField("evaluationAssistant", "role", value)}
                            description="Define el propósito del asistente de evaluación"
                            rows={2}
                        />
                        <ConfigTextArea
                            label="Descripción de la Tarea"
                            value={assistantConfig.evaluationAssistant.taskDescription}
                            onChange={value => updateAssistantField("evaluationAssistant", "taskDescription", value)}
                            description="Describe la tarea principal del evaluador"
                            rows={3}
                        />
                        <ConfigTextArea
                            label="Criterios de Evaluación"
                            value={assistantConfig.evaluationAssistant.evaluationCriteria}
                            onChange={value => updateAssistantField("evaluationAssistant", "evaluationCriteria", value)}
                            description="Criterios detallados para evaluar las soluciones"
                            rows={10}
                        />
                        <ConfigTextArea
                            label="Escala de Puntuación"
                            value={assistantConfig.evaluationAssistant.scoringScale}
                            onChange={value => updateAssistantField("evaluationAssistant", "scoringScale", value)}
                            description="Descripción de la escala de puntuación"
                            rows={5}
                        />
                        <ConfigTextArea
                            label="Formato del Feedback"
                            value={assistantConfig.evaluationAssistant.feedbackFormat}
                            onChange={value => updateAssistantField("evaluationAssistant", "feedbackFormat", value)}
                            description="Instrucciones sobre cómo formatear el feedback"
                            rows={6}
                        />
                    </div>
                );
            case "explanation":
                return (
                    <div>
                        <h5 className="mb-3">Asistente de Explicación</h5>
                        <ConfigTextArea
                            label="Rol del Asistente"
                            value={assistantConfig.explanationAssistant.role}
                            onChange={value => updateAssistantField("explanationAssistant", "role", value)}
                            description="Define el propósito del asistente tutorial"
                            rows={2}
                        />
                        <ConfigTextArea
                            label="Descripción de la Tarea"
                            value={assistantConfig.explanationAssistant.taskDescription}
                            onChange={value => updateAssistantField("explanationAssistant", "taskDescription", value)}
                            description="Describe la tarea principal del tutor"
                            rows={2}
                        />
                        <ConfigTextArea
                            label="Metodología"
                            value={assistantConfig.explanationAssistant.methodology}
                            onChange={value => updateAssistantField("explanationAssistant", "methodology", value)}
                            description="Metodología pedagógica para generar explicaciones"
                            rows={15}
                        />
                        <ConfigTextArea
                            label="Formato de Salida"
                            value={assistantConfig.explanationAssistant.outputFormat}
                            onChange={value => updateAssistantField("explanationAssistant", "outputFormat", value)}
                            description="Formato esperado de las explicaciones"
                            rows={6}
                        />
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="container-fluid py-4">
            <div className="row justify-content-center">
                <div className="col-11 col-xl-10">
                    <h1 className="h2 mb-4">Configuración</h1>

                    {/* Tabs de navegación principal */}
                    <ul className="nav nav-pills mb-4">
                        <li className="nav-item">
                            <button
                                className={`nav-link ${activeTab === "llm" ? "active" : ""}`}
                                onClick={() => setActiveTab("llm")}
                            >
                                Configuración LLM
                            </button>
                        </li>
                        <li className="nav-item">
                            <button
                                className={`nav-link ${activeTab === "assistants" ? "active" : ""}`}
                                onClick={() => setActiveTab("assistants")}
                            >
                                Configuración Asistentes
                            </button>
                        </li>
                        <li className="nav-item">
                            <button
                                className={`nav-link ${activeTab === "import-export" ? "active" : ""}`}
                                onClick={() => setActiveTab("import-export")}
                            >
                                Importar/Exportar
                            </button>
                        </li>
                    </ul>

                    {/* Contenido de LLM */}
                    {activeTab === "llm" && (
                        <div className="card mb-4">
                            <div className="card-header">
                                <h5 className="card-title mb-0">Proveedores de LLM</h5>
                            </div>
                            <div className="card-body">
                                {saveMessage && (
                                    <div
                                        className={`alert ${
                                            saveMessage.includes("Error") ? "alert-danger" : "alert-success"
                                        } alert - dismissible fade show`}
                                        role="alert"
                                    >
                                        {saveMessage}
                                    </div>
                                )}
                                <div className="row g-3">
                                    <div className="col-md-3">
                                        <label htmlFor="providerSelect" className="form-label">
                                            Proveedor
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
                                            className="form-control"
                                            id="apiKey"
                                            placeholder="Introduce tu API Key"
                                            autoComplete="off"
                                            value={apiKey}
                                            onChange={e => setApiKey(e.target.value)}
                                        />
                                    </div>
                                    <div className="col-md-3">
                                        <label htmlFor="modelSelect" className="form-label">
                                            Modelo
                                        </label>
                                        <select
                                            className="form-select"
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
                                    </div>
                                </div>
                                <div className="row mt-3">
                                    <div className="col-12">
                                        <button
                                            type="button"
                                            className="btn btn-primary me-2"
                                            onClick={handleSaveConfiguration}
                                        >
                                            Guardar configuración
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
                                        Asistente de Curso
                                    </button>
                                </li>
                                <li className="nav-item">
                                    <button
                                        className={`nav-link ${activeAssistantSection === "exercise" ? "active" : ""}`}
                                        onClick={() => setActiveAssistantSection("exercise")}
                                    >
                                        Identificación
                                    </button>
                                </li>
                                <li className="nav-item">
                                    <button
                                        className={`nav-link ${
                                            activeAssistantSection === "evaluation" ? "active" : ""
                                        }`}
                                        onClick={() => setActiveAssistantSection("evaluation")}
                                    >
                                        Evaluación
                                    </button>
                                </li>
                                <li className="nav-item">
                                    <button
                                        className={`nav-link ${
                                            activeAssistantSection === "explanation" ? "active" : ""
                                        }`}
                                        onClick={() => setActiveAssistantSection("explanation")}
                                    >
                                        Explicación
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
                                            Guardar configuración
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-outline-secondary"
                                            onClick={handleResetAssistantConfig}
                                        >
                                            Restaurar valores por defecto
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Contenido de Importar/Exportar */}
                    {activeTab === "import-export" && <ImportExportTab />}
                </div>
            </div>
        </div>
    );
};

export default Options;
