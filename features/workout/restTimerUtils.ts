import { Exercise, Set } from '@/types/workout';

export function formatRestSeconds(seconds: number): string {
    const s = Math.max(0, Math.round(seconds));
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
}

/** Accepts "90", "1:30", "2:00", etc. */
export function parseRestInput(text: string): number {
    const trimmed = text.trim();
    if (!trimmed) return 0;
    if (trimmed.includes(':')) {
        const [mPart, sPart] = trimmed.split(':');
        return Math.max(0, (parseInt(mPart, 10) || 0) * 60 + (parseInt(sPart, 10) || 0));
    }
    return Math.max(0, parseInt(trimmed, 10) || 0);
}

export function getRestAfterSetSeconds(exercise: Exercise, set: Set): number {
    if (set.restAfterSeconds != null) return set.restAfterSeconds;
    const timers = exercise.restTimers;
    if (set.type === 'warmup') return timers?.warmup ?? 0;
    if (set.type === 'dropset') return timers?.dropset ?? 0;
    return timers?.work ?? 120;
}
