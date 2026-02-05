import React, { useRef } from "react";
import { useTranslation } from "react-i18next";
import { ImportExportManager } from "../../util/storage/ImportExportManager";

interface UseConfigurationImportProps {
    onConfigLoaded: () => void;
}

export const useConfigurationImport = ({ onConfigLoaded }: UseConfigurationImportProps) => {
    const { t } = useTranslation();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.name.endsWith(".json")) {
            setError(t('options.importExport.messages.invalidFile', 'Please select a valid JSON file.'));
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const result = await ImportExportManager.importFromFile(file);

            if (result.success) {
                // Notificar que la configuración ha sido cargada
                setTimeout(() => {
                    onConfigLoaded();
                }, 500);
            } else {
                // Map complex errors
                let text = "";
                switch (result.message) {
                    case "invalid_format":
                        text = t('options.importExport.messages.importFormatError');
                        break;
                    case "invalid_signature":
                        text = t('options.importExport.messages.importSignatureError');
                        break;
                    case "invalid_json":
                        text = t('options.importExport.messages.importJsonError');
                        break;
                    default:
                        text = t('options.importExport.messages.importError', 'Unexpected error importing: {{error}}', { error: result.message });
                }
                setError(text);
            }
        } catch (error) {
            console.error("Error loading configuration:", error);
            setError(t('options.importExport.messages.importError', 'Unexpected error: {{error}}', { error: error instanceof Error ? error.message : "Unknown error" }));
        } finally {
            setIsLoading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    const handleButtonClick = () => {
        fileInputRef.current?.click();
    };

    return {
        fileInputRef,
        isLoading,
        error,
        handleFileSelect,
        handleButtonClick,
    };
};