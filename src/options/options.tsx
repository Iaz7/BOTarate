import React, { useEffect, useState } from "react";
import "../content/bootstrap.css";
import { OpenAIService } from "../util/ai/OpenAIService";

import { ConfigManager } from "../util/config/ConfigManager";

const Options: React.FC = () => {
    const [selectedProvider, setSelectedProvider] = useState<number>(0);
    const [modelList, setModelList] = useState<string[]>([]);
    const [modelListEnabled, setModelListEnabled] = useState<boolean>(false);
    const [selectedModel, setSelectedModel] = useState<string>("");
    const [apiKey, setApiKey] = useState<string>("");
    const [saveMessage, setSaveMessage] = useState<string>("");
    const [isConfigLoaded, setIsConfigLoaded] = useState<boolean>(false);

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
            // Esperar a que se cargue la configuración desde el storage
            await ConfigManager.loadConfig();

            const currentProvider = ConfigManager.getSelectedProvider();
            const providerIndex = ConfigManager.getProviderList().indexOf(currentProvider.name);
            setSelectedProvider(Math.max(providerIndex, 0));
            setApiKey(currentProvider.key || "");

            // Obtener el modelo seleccionado guardado
            const savedModel = ConfigManager.getSelectedModel();
            console.log("Modelo guardado en ConfigManager:", savedModel);

            loadModelList(providerIndex, savedModel);

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

    return (
        <div className="container-fluid py-4">
            <div className="row justify-content-center">
                <div className="col-11 col-xl-10">
                    <h1 className="h2 mb-4">Configuración</h1>
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
                </div>
            </div>
        </div>
    );
};

export default Options;
