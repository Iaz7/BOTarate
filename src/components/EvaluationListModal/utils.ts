export const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

export const getScoreColor = (score: number) => {
    if (score >= 9) return "success";
    if (score >= 7) return "primary";
    if (score >= 5) return "warning";
    return "danger";
};

export const getScoreLabel = (score: number) => {
    if (score >= 9) return "Excellent";
    if (score >= 7) return "Good";
    if (score >= 5) return "Sufficient";
    return "Insufficient";
};

export const formatScore = (score: number) => {
    return score % 1 === 0 ? score.toString() : score.toFixed(1);
};