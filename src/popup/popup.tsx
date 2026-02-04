import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { APP_CONFIG } from "../constants";
import "../content/bootstrap.css";
import { AVAILABLE_LANGUAGES, changeLanguage, type LanguageCode } from "../i18n";

const Popup: React.FC = () => {
    const { t, i18n } = useTranslation();
    const [isLoading, setIsLoading] = useState(true);
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

    useEffect(() => {
        // Simular una pequeña carga para mantener consistencia
        setTimeout(() => setIsLoading(false), 100);
    }, []);

    const openOptionsPage = () => {
        chrome.runtime.openOptionsPage();
    };

    const handleLanguageChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newLang = e.target.value as LanguageCode;
        await changeLanguage(newLang);
        setCurrentLang(newLang);
    };

    if (isLoading) {
        return (
            <div className="p-4 text-center" style={{ width: "300px" }}>
                <div className="spinner-border spinner-border-sm" role="status">
                    <span className="visually-hidden">{t("common.loading")}</span>
                </div>
            </div>
        );
    }

    return (
        <div className="p-3" style={{ width: "300px" }}>
            <div className="d-flex align-items-center justify-content-center mb-3">
                <h5 className="mb-0">{APP_CONFIG.NAME}</h5>
            </div>

            <div className="alert alert-info small mb-3" role="alert">
                {t("popup.welcome", { appName: APP_CONFIG.NAME })}
            </div>

            <div className="d-grid gap-2">
                <button className="btn btn-primary" onClick={openOptionsPage}>
                    <i className="bi bi-gear me-2" />
                    {t("popup.openSettings")}
                </button>
            </div>

            <hr className="my-3" />

            {/* Selector de idioma */}
            <div className="mb-3">
                <label className="form-label small text-muted">{t("options.language.title")}</label>
                <select className="form-select form-select-sm" value={currentLang} onChange={handleLanguageChange}>
                    {AVAILABLE_LANGUAGES.map(lang => (
                        <option key={lang.code} value={lang.code}>
                            {lang.nativeName}
                        </option>
                    ))}
                </select>
            </div>

            <div className="text-center">
                <small className="text-muted">{t("app.description")}</small>
            </div>
        </div>
    );
};

export default Popup;
