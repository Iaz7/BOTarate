import { createRoot } from "react-dom/client";
import "../i18n"; // Inicializar i18n
import Options from "./options";

const container = document.getElementById("options-root");
if (container) {
    const root = createRoot(container);
    root.render(<Options />);
}
