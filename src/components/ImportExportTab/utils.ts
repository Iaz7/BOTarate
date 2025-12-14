export const getAlertClass = (message: { text: string; type: "success" | "error" | "info" } | null) => {
    if (!message) return "";
    if (message.type === "error") return "alert-danger";
    if (message.type === "success") return "alert-success";
    return "alert-info";
};