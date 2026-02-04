import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ImportExportTab } from "../components/ImportExportTab";
import ProgressConfigTab from "../components/ProgressConfigTab";
import { APP_CONFIG } from "../constants";
import "../content/bootstrap.css";
import { AVAILABLE_LANGUAGES, changeLanguage, type LanguageCode } from "../i18n";
import { AssistantConfig } from "../util/ai/AssistantConfig";
import { OpenAIService } from "../util/ai/OpenAIService";
import { ConfigManager } from "../util/config/ConfigManager";
import { AppMode, ModeManager } from "../util/config/ModeManager";
import { AssistantConfigStorageManager } from "../util/storage/AssistantConfigStorageManager";

type TabType = "llm" | "assistants" | "progress" | "import-export";
type AssistantSection = "general" | "exercise" | "evaluation" | "explanation";

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
    const [activeAssistantSection, setActiveAssistantSection] = useState<AssistantSection>("general");

    // Assistant Configuration
    const [assistantConfig, setAssistantConfig] = useState<AssistantConfig | null>(null);
    const [assistantSaveMessage, setAssistantSaveMessage] = useState<string>("");

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

            // Cargar configuración de asistentes
            await loadAssistantConfig();

            setIsConfigLoaded(true);
        };

        loadConfiguration();
    }, []);

    const loadAssistantConfig = async () => {
        const config = await AssistantConfigStorageManager.loadConfig();
        setAssistantConfig(config);
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

            setSaveMessage(
                "Configuration saved successfully. Text model: " +
                    ConfigManager.getSelectedModel() +
                    ". Vision model: " +
                    ConfigManager.getSelectedVisionModel(),
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
                                <span className="visually-hidden">{t("common.loading")}</span>
                            </output>
                            <p className="mt-2">{t("common.loading")}</p>
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
                        <h5 className="mb-3">{t("options.assistants.sections.general")}</h5>
                        <ConfigTextField
                            label={t("options.assistants.fields.subject.label")}
                            value={assistantConfig.common.courseName}
                            onChange={value => updateAssistantField("common", "courseName", value)}
                            description={t("options.assistants.fields.subject.desc")}
                        />
                        <ConfigTextField
                            label={t("options.assistants.fields.platform.label")}
                            value={assistantConfig.common.platformName}
                            onChange={value => updateAssistantField("common", "platformName", value)}
                            description={t("options.assistants.fields.platform.desc")}
                        />
                        <ConfigTextField
                            label={t("options.assistants.fields.institution.label")}
                            value={assistantConfig.common.institutionName}
                            onChange={value => updateAssistantField("common", "institutionName", value)}
                            description={t("options.assistants.fields.institution.desc")}
                        />

                        <hr className="my-4" />
                        <h5 className="mb-3">{t("options.assistants.headers.teacherPersonalization")}</h5>
                        <ConfigTextField
                            label={t("options.assistants.fields.teacherName.label")}
                            value={assistantConfig.common.teacherName}
                            onChange={value => updateAssistantField("common", "teacherName", value)}
                            description={t("options.assistants.fields.teacherName.desc")}
                        />
                        <ConfigTextArea
                            label={t("options.assistants.fields.teacherTics.label")}
                            value={assistantConfig.common.teacherTics}
                            onChange={value => updateAssistantField("common", "teacherTics", value)}
                            description={t("options.assistants.fields.teacherTics.desc")}
                            rows={3}
                        />
                    </div>
                );
            case "exercise":
                return (
                    <div>
                        <h5 className="mb-3">{t("options.assistants.headers.labContext")}</h5>
                        <ConfigTextArea
                            label={t("options.assistants.fields.labMaterial.label")}
                            value={assistantConfig.exerciseAssistant.contextDescription}
                            onChange={value => updateAssistantField("exerciseAssistant", "contextDescription", value)}
                            description={t("options.assistants.fields.labMaterial.desc")}
                            rows={2}
                        />
                        <ConfigTextArea
                            label={t("options.assistants.fields.exerciseCriteria.label")}
                            value={assistantConfig.exerciseAssistant.exerciseCriteria}
                            onChange={value => updateAssistantField("exerciseAssistant", "exerciseCriteria", value)}
                            description={t("options.assistants.fields.exerciseCriteria.desc")}
                            rows={6}
                        />
                    </div>
                );
            case "evaluation":
                return (
                    <div>
                        <h5 className="mb-3">{t("options.assistants.headers.evaluator")}</h5>
                        <ConfigTextArea
                            label={t("options.assistants.fields.role.label")}
                            value={assistantConfig.evaluationAssistant.role}
                            onChange={value => updateAssistantField("evaluationAssistant", "role", value)}
                            description={t("options.assistants.fields.role.desc")}
                            rows={2}
                        />
                        <ConfigTextArea
                            label={t("options.assistants.fields.evaluationCriteria.label")}
                            value={assistantConfig.evaluationAssistant.evaluationCriteria}
                            onChange={value => updateAssistantField("evaluationAssistant", "evaluationCriteria", value)}
                            description={t("options.assistants.fields.evaluationCriteria.desc")}
                            rows={10}
                        />
                        <ConfigTextArea
                            label={t("options.assistants.fields.scoringScale.label")}
                            value={assistantConfig.evaluationAssistant.scoringScale}
                            onChange={value => updateAssistantField("evaluationAssistant", "scoringScale", value)}
                            description={t("options.assistants.fields.scoringScale.desc")}
                            rows={5}
                        />
                        <ConfigTextArea
                            label={t("options.assistants.fields.feedbackFormat.label")}
                            value={assistantConfig.evaluationAssistant.feedbackFormat}
                            onChange={value => updateAssistantField("evaluationAssistant", "feedbackFormat", value)}
                            description={t("options.assistants.fields.feedbackFormat.desc")}
                            rows={6}
                        />
                    </div>
                );
            case "explanation":
                return (
                    <div>
                        <h5 className="mb-3">{t("options.assistants.headers.solver")}</h5>
                        <ConfigTextArea
                            label={t("options.assistants.fields.role.label")}
                            value={assistantConfig.explanationAssistant.role}
                            onChange={value => updateAssistantField("explanationAssistant", "role", value)}
                            description={t("options.assistants.fields.role.desc")}
                            rows={2}
                        />
                        <ConfigTextArea
                            label={t("options.assistants.fields.methodology.label")}
                            value={assistantConfig.explanationAssistant.methodology}
                            onChange={value => updateAssistantField("explanationAssistant", "methodology", value)}
                            description={t("options.assistants.fields.methodology.desc")}
                            rows={15}
                        />
                        <ConfigTextArea
                            label={t("options.assistants.fields.feedbackFormat.label")}
                            value={assistantConfig.explanationAssistant.outputFormat}
                            onChange={value => updateAssistantField("explanationAssistant", "outputFormat", value)}
                            description={t("options.assistants.fields.feedbackFormat.desc")}
                            rows={6}
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
                                    className={`nav-link ${activeTab === "assistants" ? "active" : ""}`}
                                    onClick={() => setActiveTab("assistants")}
                                >
                                    {t("options.tabs.assistants")}
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
                                        Environment
                                    </button>
                                </li>
                                <li className="nav-item">
                                    <button
                                        className={`nav-link ${activeAssistantSection === "exercise" ? "active" : ""}`}
                                        onClick={() => setActiveAssistantSection("exercise")}
                                    >
                                        Context extraction
                                    </button>
                                </li>
                                <li className="nav-item">
                                    <button
                                        className={`nav-link ${
                                            activeAssistantSection === "evaluation" ? "active" : ""
                                        }`}
                                        onClick={() => setActiveAssistantSection("evaluation")}
                                    >
                                        Evaluator
                                    </button>
                                </li>
                                <li className="nav-item">
                                    <button
                                        className={`nav-link ${
                                            activeAssistantSection === "explanation" ? "active" : ""
                                        }`}
                                        onClick={() => setActiveAssistantSection("explanation")}
                                    >
                                        Solver
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
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === "progress" && renderProgressTab()}

                    {/* Contenido de Importar/Exportar */}
                    {activeTab === "import-export" && <ImportExportTab onDataChange={loadAssistantConfig} />}
                </div>
            </div>
        </div>
    );
};

export default Options;
