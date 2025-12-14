import { useRef, useState } from "react";
import { ImportExportManager } from "../../util/storage/ImportExportManager";
import { ImportExportTabProps } from "./types";

export const useImportExport = ({ onDataChange }: ImportExportTabProps) => {
    const [message, setMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    /**
     * Exporta la configuración a un archivo JSON
     */
    const handleExport = async () => {
        setIsProcessing(true);
        setMessage(null);

        try {
            const result = await ImportExportManager.exportToFile();
            setMessage({
                text: result.message,
                type: result.success ? "success" : "error",
            });
        } catch (error) {
            console.error("Error exporting configuration:", error);
            setMessage({
                text: `Unexpected error exporting: ${error instanceof Error ? error.message : "Unknown error"}`,
                type: "error",
            });
        } finally {
            setIsProcessing(false);
        }
    };

    /**
     * Importa la configuración desde un archivo JSON
     */
    const handleImport = async (file: File) => {
        setIsProcessing(true);
        setMessage(null);

        try {
            const result = await ImportExportManager.importFromFile(file);
            setMessage({
                text: result.message,
                type: result.success ? "success" : "error",
            });
            if (result.success && onDataChange) {
                onDataChange();
            }
        } catch (error) {
            console.error("Error importing configuration:", error);
            setMessage({
                text: `Unexpected error importing: ${error instanceof Error ? error.message : "Unknown error"}`,
                type: "error",
            });
        } finally {
            setIsProcessing(false);
            // Limpiar el input
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    /**
     * Limpia todos los datos del storage
     */
    const handleClearAll = async () => {
        const confirmed = confirm(
            "⚠️ WARNING: This action will delete ALL saved configuration, including:\n\n" +
            "- Assistant configuration\n" +
            "- Identified exercise data\n" +
            "- Configured lab data\n\n" +
            "This action CANNOT be undone. Are you sure you want to continue?"
        );

        if (!confirmed) return;

        setIsProcessing(true);
        setMessage(null);

        try {
            const result = await ImportExportManager.clearAllData();
            setMessage({
                text: result.message,
                type: result.success ? "info" : "error",
            });
            if (result.success && onDataChange) {
                onDataChange();
            }
        } catch (error) {
            console.error("Error clearing data:", error);
            setMessage({
                text: `Unexpected error clearing: ${error instanceof Error ? error.message : "Unknown error"}`,
                type: "error",
            });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            if (!file.name.endsWith(".json")) {
                setMessage({
                    text: "Please select a valid JSON file.",
                    type: "error",
                });
                return;
            }
            handleImport(file);
        }
    };

    return {
        message,
        isProcessing,
        fileInputRef,
        handleExport,
        handleImport,
        handleClearAll,
        handleFileSelect,
        setMessage,
    };
};