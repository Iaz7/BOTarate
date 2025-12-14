export const getScoreColor = (score: number): string => {
    if (score >= 9) return "success";
    if (score >= 7) return "primary";
    if (score >= 5) return "warning";
    return "danger";
};

export const getScoreLabel = (score: number): string => {
    if (score >= 9) return "Excellent";
    if (score >= 7) return "Good";
    if (score >= 5) return "Acceptable";
    if (score >= 3) return "Insufficient";
    return "Very poor";
};