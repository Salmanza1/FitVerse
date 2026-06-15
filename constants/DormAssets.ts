import { Dorm } from '../types/user';
import { getDormLogoSource } from '../lib/dormLogo';

/** Remote dorm crest images (Wikimedia Commons). */
export const DORM_LOGOS: Record<Dorm, { uri: string }> = Object.values(Dorm).reduce(
    (acc, dorm) => {
        acc[dorm as Dorm] = getDormLogoSource(dorm as Dorm);
        return acc;
    },
    {} as Record<Dorm, { uri: string }>
);
