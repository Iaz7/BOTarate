import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ImportExportTab } from "../components/ImportExportTab";
import ProgressConfigTab from "../components/ProgressConfigTab";
import { APP_CONFIG } from "../constants";
import "../content/bootstrap.css";
import { AVAILABLE_LANGUAGES, changeLanguage, type LanguageCode } from "../i18n";
import { AgentConfig } from "../util/ai/AgentConfig";
import { OpenAIService } from "../util/ai/OpenAIService";
import { ConfigManager } from "../util/config/ConfigManager";
import { AppMode, ModeManager } from "../util/config/ModeManager";
import { AgentConfigStorageManager } from "../util/storage/AgentConfigStorageManager";

type TabType = "llm" | "agents" | "progress" | "import-export";
type AgentSection = "general" | "exercise" | "evaluation" | "explanation";

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
    const { t, i18n } = useTranslation();

    // Language - Sync with i18n state
    const [currentLang, setCurrentLang] = useState<LanguageCode>(
        (i18n.language?.split("-")[0] as LanguageCode) || "es",
    );

    useEffect(() => {
        const handleLanguageChanged = (lng: string) => {
            setCurrentLang((lng.split("-")[0] as LanguageCode) || "es");
        };
        i18n.on("languageChanged", handleLanguageChanged);
        return () => {
            i18n.off("languageChanged", handleLanguageChanged);
        };
    }, [i18n]);

    // LLM Configuration
    const [selectedProvider, setSelectedProvider] = useState<number>(0);
    const [modelList, setModelList] = useState<string[]>([]);
    const [modelListEnabled, setModelListEnabled] = useState<boolean>(false);
    const [selectedModel, setSelectedModel] = useState<string>("");
    const [selectedVisionModel, setSelectedVisionModel] = useState<string>("");
    const [apiKey, setApiKey] = useState<string>("");
    const [saveMessage, setSaveMessage] = useState<string>("");
    const [isConfigLoaded, setIsConfigLoaded] = useState<boolean>(false);
    const [apiKeyError, setApiKeyError] = useState<string>("");

    // Tab navigation
    const [activeTab, setActiveTab] = useState<TabType>("llm");
    const [activeAgentSection, setActiveAgentSection] = useState<AgentSection>("general");

    // Agent Configuration
    const [agentConfig, setAgentConfig] = useState<AgentConfig | null>(null);
    const [agentSaveMessage, setAgentSaveMessage] = useState<string>("");

    // Mode Configuration
    const [isUserTeacher, setIsUserTeacher] = useState<boolean>(false);

    const handleLanguageChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newLang = e.target.value as LanguageCode;
        await changeLanguage(newLang);
        setCurrentLang(newLang);
    };

    // Validación y carga de modelos/API key
    const validateAndLoadModels = (
        providerIndex: number,
        modelToPreselect?: string,
        visionModelToPreselect?: string,
        apiKeyValue?: string,
    ) => {
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

                // Select text model
                const cleanModelToPreselect = modelToPreselect?.replace("models/", "") || "";
                const textModels = cleanList.filter(m => ConfigManager.TEXT_MODELS.includes(m));
                const modelToSelect =
                    cleanModelToPreselect && textModels.includes(cleanModelToPreselect)
                        ? cleanModelToPreselect
                        : textModels[0] || "";
                setSelectedModel(modelToSelect);

                // Select vision model
                const cleanVisionModelToPreselect = visionModelToPreselect?.replace("models/", "") || "";
                const visionModels = cleanList.filter(m => ConfigManager.VISION_MODELS.includes(m));
                const visionModelToSelect =
                    cleanVisionModelToPreselect && visionModels.includes(cleanVisionModelToPreselect)
                        ? cleanVisionModelToPreselect
                        : visionModels[0] || "";
                setSelectedVisionModel(visionModelToSelect);

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

            // Si el usuario no es profesor, forzar modo alumno y seleccionar pestaña import-export
            if (!userIsTeacher) {
                await ModeManager.setMode(AppMode.STUDENT);
                setActiveTab("import-export");
            }

            // Cargar configuración LLM
            await ConfigManager.loadConfig();

            const currentProvider = ConfigManager.getSelectedProvider();
            const providerIndex = ConfigManager.getProviderList().indexOf(currentProvider.name);
            setSelectedProvider(Math.max(providerIndex, 0));
            setApiKey(currentProvider.key || "");

            // Obtener los modelos seleccionados guardados
            const savedModel = ConfigManager.getSelectedModel();
            const savedVisionModel = ConfigManager.getSelectedVisionModel();

            // Validar y cargar modelos
            validateAndLoadModels(providerIndex, savedModel, savedVisionModel, currentProvider.key);

            // Cargar configuración de agentes
            await loadAgentConfig();

            setIsConfigLoaded(true);
        };

        loadConfiguration();
    }, []);

    const loadAgentConfig = async () => {
        const config = await AgentConfigStorageManager.loadConfig();
        setAgentConfig(config);
    };

    const handleProviderChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const providerIndex = Number.parseInt(event.target.value);
        setSelectedProvider(providerIndex);
        const newApiKey = ConfigManager.getProvider(providerIndex).key || "";
        setApiKey(newApiKey);
        validateAndLoadModels(providerIndex, undefined, undefined, newApiKey);
    };

    // Validar la API key cada vez que cambia
    useEffect(() => {
        if (!isConfigLoaded) return;
        validateAndLoadModels(selectedProvider, undefined, undefined, apiKey);
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

            // Get available models from current provider
            const availableTextModels = modelList.filter(m => ConfigManager.TEXT_MODELS.includes(m));
            const availableVisionModels = modelList.filter(m => ConfigManager.VISION_MODELS.includes(m));

            // Use first available model if none selected
            const modelToSave = selectedModel || availableTextModels[0] || "";
            const visionModelToSave = selectedVisionModel || availableVisionModels[0] || "";

            ConfigManager.selectModel(modelToSave);
            ConfigManager.selectVisionModel(visionModelToSave);

            // Update React state to reflect saved values
            setSelectedModel(modelToSave);
            setSelectedVisionModel(visionModelToSave);

            // Enviar la configuración actualizada al background script
            // El background script se encargará de llamar a OpenAIService.loadProviderConfig()
            chrome.runtime
                .sendMessage({
                    action: "updateConfig",
                    config: {
                        providerKeys: ConfigManager.getProviderList().map(
                            (_, index) => ConfigManager.getProvider(index).key,
                        ),
                        selectedProvider: selectedProvider,
                        selectedModel: modelToSave,
                        selectedVisionModel: visionModelToSave,
                    },
                })
                .catch(error => {
                    console.error("Error sending config to background:", error);
                });

            setSaveMessage(t("options.llm.saveSuccess"));
        } catch (error) {
            console.error("Error saving configuration:", error);
            setSaveMessage(t("options.llm.saveError"));
        }
    };

    const handleSaveAgentConfig = async () => {
        if (!agentConfig) return;

        try {
            await AgentConfigStorageManager.saveConfig(agentConfig);
            setAgentSaveMessage(t("options.agents.buttons.saved"));

            // Notificar al background script para recargar la configuración
            chrome.runtime.sendMessage({ action: "reloadAgentConfig" }).catch(error => {
                console.error("Error notifying background:", error);
            });
        } catch (error) {
            console.error("Error saving agent configuration:", error);
            setAgentSaveMessage(t("options.agents.buttons.error"));
        }
    };

    const updateAgentField = (section: keyof AgentConfig, field: string, value: string) => {
        if (!agentConfig) return;

        setAgentConfig({
            ...agentConfig,
            [section]: {
                ...(agentConfig[section] as any),
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
                                <span className="visually-hidden">{t("common.loading")}</span>
                            </output>
                            <p className="mt-2">{t("common.loading")}</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const renderAgentSection = () => {
        if (!agentConfig) return null;

        switch (activeAgentSection) {
            case "general":
                return (
                    <div>
                        <h5 className="mb-3">{t("options.agents.sections.general")}</h5>
                        <ConfigTextField
                            label={t("options.agents.fields.subject.label")}
                            value={agentConfig.common.courseName}
                            onChange={value => updateAgentField("common", "courseName", value)}
                            description={t("options.agents.fields.subject.desc")}
                        />
                        <ConfigTextField
                            label={t("options.agents.fields.platform.label")}
                            value={agentConfig.common.platformName}
                            onChange={value => updateAgentField("common", "platformName", value)}
                            description={t("options.agents.fields.platform.desc")}
                        />
                        <ConfigTextField
                            label={t("options.agents.fields.institution.label")}
                            value={agentConfig.common.institutionName}
                            onChange={value => updateAgentField("common", "institutionName", value)}
                            description={t("options.agents.fields.institution.desc")}
                        />

                        <hr className="my-4" />
                        <h5 className="mb-3">{t("options.agents.headers.teacherPersonalization")}</h5>
                        <ConfigTextField
                            label={t("options.agents.fields.teacherName.label")}
                            value={agentConfig.common.teacherName}
                            onChange={value => updateAgentField("common", "teacherName", value)}
                            description={t("options.agents.fields.teacherName.desc")}
                        />
                        <ConfigTextArea
                            label={t("options.agents.fields.teacherTics.label")}
                            value={agentConfig.common.teacherTics}
                            onChange={value => updateAgentField("common", "teacherTics", value)}
                            description={t("options.agents.fields.teacherTics.desc")}
                            rows={3}
                        />
                    </div>
                );
            case "exercise":
                return (
                    <div>
                        <h5 className="mb-3">{t("options.agents.headers.labContext")}</h5>
                        <ConfigTextArea
                            label={t("options.agents.fields.labMaterial.label")}
                            value={agentConfig.exerciseAgent.contextDescription}
                            onChange={value => updateAgentField("exerciseAgent", "contextDescription", value)}
                            description={t("options.agents.fields.labMaterial.desc")}
                            rows={2}
                        />
                        <ConfigTextArea
                            label={t("options.agents.fields.exerciseCriteria.label")}
                            value={agentConfig.exerciseAgent.exerciseCriteria}
                            onChange={value => updateAgentField("exerciseAgent", "exerciseCriteria", value)}
                            description={t("options.agents.fields.exerciseCriteria.desc")}
                            rows={6}
                        />
                    </div>
                );
            case "evaluation":
                return (
                    <div>
                        <h5 className="mb-3">{t("options.agents.headers.evaluator")}</h5>
                        <ConfigTextArea
                            label={t("options.agents.fields.role.label")}
                            value={agentConfig.evaluationAgent.role}
                            onChange={value => updateAgentField("evaluationAgent", "role", value)}
                            description={t("options.agents.fields.role.desc")}
                            rows={2}
                        />
                        <ConfigTextArea
                            label={t("options.agents.fields.evaluationCriteria.label")}
                            value={agentConfig.evaluationAgent.evaluationCriteria}
                            onChange={value => updateAgentField("evaluationAgent", "evaluationCriteria", value)}
                            description={t("options.agents.fields.evaluationCriteria.desc")}
                            rows={10}
                        />
                        <ConfigTextArea
                            label={t("options.agents.fields.scoringScale.label")}
                            value={agentConfig.evaluationAgent.scoringScale}
                            onChange={value => updateAgentField("evaluationAgent", "scoringScale", value)}
                            description={t("options.agents.fields.scoringScale.desc")}
                            rows={5}
                        />
                        <ConfigTextArea
                            label={t("options.agents.fields.feedbackFormat.label")}
                            value={agentConfig.evaluationAgent.feedbackFormat}
                            onChange={value => updateAgentField("evaluationAgent", "feedbackFormat", value)}
                            description={t("options.agents.fields.feedbackFormat.desc")}
                            rows={6}
                        />
                    </div>
                );
            case "explanation":
                return (
                    <div>
                        <h5 className="mb-3">{t("options.agents.headers.solver")}</h5>
                        <ConfigTextArea
                            label={t("options.agents.fields.role.label")}
                            value={agentConfig.explanationAgent.role}
                            onChange={value => updateAgentField("explanationAgent", "role", value)}
                            description={t("options.agents.fields.role.desc")}
                            rows={2}
                        />
                        <ConfigTextArea
                            label={t("options.agents.fields.methodology.label")}
                            value={agentConfig.explanationAgent.methodology}
                            onChange={value => updateAgentField("explanationAgent", "methodology", value)}
                            description={t("options.agents.fields.methodology.desc")}
                            rows={15}
                        />
                        <ConfigTextArea
                            label={t("options.agents.fields.feedbackFormat.label")}
                            value={agentConfig.explanationAgent.outputFormat}
                            onChange={value => updateAgentField("explanationAgent", "outputFormat", value)}
                            description={t("options.agents.fields.feedbackFormat.desc")}
                            rows={6}
                        />
                        <ConfigTextArea
                            label={t("options.agents.fields.pickyExerciseConfig.label")}
                            value={agentConfig.explanationAgent.pickyExerciseConfiguration || ""}
                            onChange={value =>
                                updateAgentField("explanationAgent", "pickyExerciseConfiguration", value)
                            }
                            description={t("options.agents.fields.pickyExerciseConfig.desc")}
                            rows={4}
                        />
                    </div>
                );
            default:
                return null;
        }
    };

    const renderProgressTab = () => {
        if (!isUserTeacher) return null;

        return (
            <div className="card mb-4">
                <div className="card-header">
                    <h5 className="card-title mb-0">{t("options.progress.globalTitle")}</h5>
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
                    <div className="d-flex justify-content-between align-items-center mb-4">
                        <h1 className="h2 mb-0">
                            {APP_CONFIG.NAME} - {t("options.tabs.llm").split(" ")[0]}
                        </h1>

                        {/* Selector de idioma */}
                        <div className="d-flex align-items-center gap-2">
                            <label className="form-label mb-0 small text-muted">{t("options.language.title")}:</label>
                            <select
                                className="form-select form-select-sm"
                                style={{ width: "auto" }}
                                value={currentLang}
                                onChange={handleLanguageChange}
                            >
                                {AVAILABLE_LANGUAGES.map(lang => (
                                    <option key={lang.code} value={lang.code}>
                                        {lang.nativeName}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Tabs de navegación principal */}
                    <ul className="nav nav-pills mb-4">
                        <li className="nav-item">
                            <button
                                className={`nav-link ${activeTab === "llm" ? "active" : ""}`}
                                onClick={() => setActiveTab("llm")}
                            >
                                {t("options.tabs.llm")}
                            </button>
                        </li>
                        {isUserTeacher && (
                            <li className="nav-item">
                                <button
                                    className={`nav-link ${activeTab === "agents" ? "active" : ""}`}
                                    onClick={() => setActiveTab("agents")}
                                >
                                    {t("options.tabs.agents")}
                                </button>
                            </li>
                        )}
                        {isUserTeacher && (
                            <li className="nav-item">
                                <button
                                    className={`nav-link ${activeTab === "progress" ? "active" : ""}`}
                                    onClick={() => setActiveTab("progress")}
                                >
                                    {t("options.tabs.progress")}
                                </button>
                            </li>
                        )}
                        <li className="nav-item">
                            <button
                                className={`nav-link ${activeTab === "import-export" ? "active" : ""}`}
                                onClick={() => setActiveTab("import-export")}
                            >
                                {t("options.tabs.importExport")}
                            </button>
                        </li>
                    </ul>

                    {/* Mensaje informativo para alumnos */}
                    {!isUserTeacher && (
                        <div className="alert alert-info mb-4">
                            <span dangerouslySetInnerHTML={{ __html: t("options.studentMode.warning") }} />
                        </div>
                    )}

                    {/* Contenido de LLM */}
                    {activeTab === "llm" && (
                        <div className="card mb-4">
                            <div className="card-header">
                                <h5 className="card-title mb-0">{t("options.llm.title")}</h5>
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
                                            {t("options.llm.provider")}
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
                                    <div className="col-md-9">
                                        <label htmlFor="apiKey" className="form-label">
                                            {t("options.llm.apiKey")}
                                        </label>
                                        <input
                                            type="password"
                                            className={`form-control${apiKeyError ? " is-invalid" : ""}`}
                                            id="apiKey"
                                            placeholder={t("options.llm.apiKeyPlaceholder")}
                                            autoComplete="off"
                                            value={apiKey}
                                            onChange={e => setApiKey(e.target.value)}
                                        />
                                        {apiKeyError && (
                                            <div className="invalid-feedback">{t("options.llm.apiKeyError")}</div>
                                        )}
                                    </div>
                                </div>
                                <div className="row g-3 mt-2">
                                    <div className="col-md-6">
                                        <label htmlFor="modelSelect" className="form-label">
                                            {t("options.llm.textModel")}
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
                                            {ConfigManager.TEXT_MODELS.filter(m => modelList.includes(m)).map(model => (
                                                <option key={model} value={model}>
                                                    {model}
                                                </option>
                                            ))}
                                        </select>
                                        <div className="form-text">{t("options.llm.textModelHelp")}</div>
                                    </div>
                                    <div className="col-md-6">
                                        <label htmlFor="visionModelSelect" className="form-label">
                                            {t("options.llm.visionModel")}
                                        </label>
                                        <select
                                            className={`form-select${
                                                !modelListEnabled && apiKeyError ? " is-invalid" : ""
                                            }`}
                                            id="visionModelSelect"
                                            disabled={!modelListEnabled}
                                            value={selectedVisionModel}
                                            onChange={e => setSelectedVisionModel(e.target.value)}
                                        >
                                            {ConfigManager.VISION_MODELS.filter(m => modelList.includes(m)).map(
                                                model => (
                                                    <option key={model} value={model}>
                                                        {model}
                                                    </option>
                                                ),
                                            )}
                                        </select>
                                        <div className="form-text">{t("options.llm.visionModelHelp")}</div>
                                        {!modelListEnabled && apiKey.trim() && apiKeyError && (
                                            <div className="invalid-feedback">{t("options.llm.apiKeyError")}</div>
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
                                            {t("options.llm.save")}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Contenido de Agentes */}
                    {activeTab === "agents" && (
                        <div>
                            {agentSaveMessage && (
                                <div
                                    className={`alert ${
                                        agentSaveMessage.includes("Error") ? "alert-danger" : "alert-success"
                                    } alert-dismissible fade show`}
                                    role="alert"
                                >
                                    {agentSaveMessage}
                                    <button
                                        type="button"
                                        className="btn-close"
                                        onClick={() => setAgentSaveMessage("")}
                                        aria-label={t("common.close")}
                                    ></button>
                                </div>
                            )}

                            {/* Sub-navegación para secciones de agentes */}
                            <ul className="nav nav-pills mb-3">
                                <li className="nav-item">
                                    <button
                                        className={`nav-link ${activeAgentSection === "general" ? "active" : ""}`}
                                        onClick={() => setActiveAgentSection("general")}
                                    >
                                        {t("options.agents.sections.general")}
                                    </button>
                                </li>
                                <li className="nav-item">
                                    <button
                                        className={`nav-link ${activeAgentSection === "exercise" ? "active" : ""}`}
                                        onClick={() => setActiveAgentSection("exercise")}
                                    >
                                        {t("options.agents.sections.exercise")}
                                    </button>
                                </li>
                                <li className="nav-item">
                                    <button
                                        className={`nav-link ${
                                            activeAgentSection === "evaluation" ? "active" : ""
                                        }`}
                                        onClick={() => setActiveAgentSection("evaluation")}
                                    >
                                        {t("options.agents.sections.evaluation")}
                                    </button>
                                </li>
                                <li className="nav-item">
                                    <button
                                        className={`nav-link ${
                                            activeAgentSection === "explanation" ? "active" : ""
                                        }`}
                                        onClick={() => setActiveAgentSection("explanation")}
                                    >
                                        {t("options.agents.sections.explanation")}
                                    </button>
                                </li>
                            </ul>

                            <div className="card">
                                <div className="card-body">
                                    {renderAgentSection()}
                                    <div className="mt-4">
                                        <button
                                            type="button"
                                            className="btn btn-primary me-2"
                                            onClick={handleSaveAgentConfig}
                                        >
                                            {t("options.agents.buttons.save")}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === "progress" && renderProgressTab()}

                    {/* Contenido de Importar/Exportar */}
                    {activeTab === "import-export" && <ImportExportTab onDataChange={loadAgentConfig} />}
                </div>
            </div>
        </div>
    );
};

export default Options;