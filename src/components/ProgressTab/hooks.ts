import { useEffect, useState } from "react";
import {
    LabProgress,
    ProgressManager,
    ProgressRequirements,
} from "../../util/progress/ProgressManager";

export const useProgressData = (courseId: string) => {
    const [labProgress, setLabProgress] = useState<LabProgress[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [requirements, setRequirements] = useState<ProgressRequirements | null>(null);

    useEffect(() => {
        loadProgressData();
    }, [courseId]);

    const loadProgressData = async () => {
        setIsLoading(true);
        try {
            const progressData = await ProgressManager.loadProgressData(courseId);
            setLabProgress(progressData.labs);
            setRequirements(progressData.requirements);
        } catch (error) {
            console.error("[ProgressTab] Error loading progress data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    return { labProgress, isLoading, requirements };
};