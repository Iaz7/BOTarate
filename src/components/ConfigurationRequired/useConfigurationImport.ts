import React, { useRef } from "react";
import { ImportExportManager } from "../../util/storage/ImportExportManager";

interface UseConfigurationImportProps {
    onConfigLoaded: () => void;
}

export const useConfigurationImport = ({ onConfigLoaded }: UseConfigurationImportProps) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.name.endsWith(".json")) {
            setError("Please select a valid JSON file.");
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
                setError(result.message);
            }
        } catch (error) {
            console.error("Error loading configuration:", error);
            setError(`Unexpected error: ${error instanceof Error ? error.message : "Unknown error"}`);
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