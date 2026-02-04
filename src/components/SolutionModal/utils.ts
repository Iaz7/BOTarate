export const getScoreColor = (score: number): string => {
    if (score >= 9) return "success";
    if (score >= 7) return "primary";
    if (score >= 5) return "warning";
    return "danger";
};

export const getScoreLabel = (score: number): string => {
    if (score >= 9) return "evaluation.scoreLabels.excellent";
    if (score >= 7) return "evaluation.scoreLabels.good";
    if (score >= 5) return "evaluation.scoreLabels.acceptable";
    if (score >= 3) return "evaluation.scoreLabels.insufficient";
    return "evaluation.scoreLabels.veryPoor";
};