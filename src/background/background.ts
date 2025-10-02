// Este archivo contiene el script de fondo de la extensión. Se encarga de manejar eventos globales y la lógica que no está relacionada directamente con la interfaz de usuario.

chrome.runtime.onInstalled.addListener(() => {
    console.log("La extensión ha sido instalada.");
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getData") {
        // Lógica para manejar la solicitud de datos
        sendResponse({ data: "Aquí están los datos solicitados." });
    }
});