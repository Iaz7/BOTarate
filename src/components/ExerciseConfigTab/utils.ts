import { Exercise, ExerciseFlags } from './types';

export const getDefaultFlags = (): ExerciseFlags => ({ allowed: true, isPicky: false });

export const createFlagsFromExercise = (exercise: Exercise): ExerciseFlags => ({
    allowed: exercise.allowed ?? true,
    isPicky: exercise.isPicky ?? false,
});

export const buildConfigMap = (list: Exercise[]): Map<string, ExerciseFlags> => {
    const config = new Map<string, ExerciseFlags>();
    for (const exercise of list) {
        config.set(exercise.name, createFlagsFromExercise(exercise));
    }
    return config;
};

export const configsAreEqual = (a: Map<string, ExerciseFlags>, b: Map<string, ExerciseFlags>): boolean => {
    if (a.size !== b.size) return false;
    for (const [name, flags] of a) {
        const reference = b.get(name);
        if (!reference) return false;
        if (flags.allowed !== reference.allowed || flags.isPicky !== reference.isPicky) {
            return false;
        }
    }
    return true;
};

export const computePendingChanges = (
    exerciseConfig: Map<string, ExerciseFlags>,
    originalConfig: Map<string, ExerciseFlags>
): Array<{ name: string; allowed?: boolean; isPicky?: boolean }> => {
    const changes: Array<{ name: string; allowed?: boolean; isPicky?: boolean }> = [];
    for (const [name, flags] of exerciseConfig.entries()) {
        const originalFlags = originalConfig.get(name) ?? getDefaultFlags();
        const change: { name: string; allowed?: boolean; isPicky?: boolean } = { name };

        if (flags.allowed !== originalFlags.allowed) {
            change.allowed = flags.allowed;
        }
        if (flags.isPicky !== originalFlags.isPicky) {
            change.isPicky = flags.isPicky;
        }

        if (change.allowed !== undefined || change.isPicky !== undefined) {
            changes.push(change);
        }
    }
    return changes;
};