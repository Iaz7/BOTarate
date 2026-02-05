import { createRoot } from "react-dom/client";
import { i18nInitialized } from "../i18n"; // Inicializar i18n
import Options from "./options";

const container = document.getElementById("options-root");
if (container) {
    // Esperar a que i18n esté completamente inicializado antes de renderizar
    i18nInitialized.then(() => {
        const root = createRoot(container);
        root.render(<Options />);
    });
}
