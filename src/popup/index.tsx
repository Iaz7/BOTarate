import { createRoot } from "react-dom/client";
import "../i18n"; // Inicializar i18n
import Popup from "./popup";

const container = document.getElementById("root");
if (container) {
    const root = createRoot(container);
    root.render(<Popup />);
}
