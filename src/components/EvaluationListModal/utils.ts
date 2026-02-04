export const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString(undefined, {
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
    if (score >= 9) return "evaluation.scoreLabels.excellent";
    if (score >= 7) return "evaluation.scoreLabels.good";
    if (score >= 5) return "evaluation.scoreLabels.acceptable";
    return "evaluation.scoreLabels.insufficient";
};

export const formatScore = (score: number) => {
    return score % 1 === 0 ? score.toString() : score.toFixed(1);
};