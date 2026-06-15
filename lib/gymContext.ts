/**
 * Notre Dame gym context — equipment profiles for campus centers and dorm halls.
 */
import { Dorm, DEFAULT_GYMS } from '@/types/user';

export type GymEquipmentTier = 'full' | 'standard' | 'limited' | 'minimal';

export interface GymProfile {
    name: string;
    equipment: string[];
    limitations: string[];
    /** full = all library exercises OK; limited = dorm-style placeholder until DB inventory */
    tier?: GymEquipmentTier;
}

/** Placeholder for residential halls until per-dorm equipment is loaded from the database. */
const DORM_GYM_CONFIG: Omit<GymProfile, 'name'> = {
    tier: 'limited',
    equipment: [
        'Dumbbells (up to 50lbs)',
        'Adjustable Bench',
        'Basic Treadmill/Bike',
        'Pull-up Bar',
        'Kettlebells (limited)',
    ],
    limitations: [
        'No squat racks',
        'No barbells',
        'No heavy machines',
        'Quiet hours may apply',
        'ID access only',
        'Per-hall inventory not in database yet — use conservative exercise choices',
    ],
};

const HOME_GYM_CONFIG: GymProfile = {
    name: 'Home / Bodyweight',
    tier: 'minimal',
    equipment: ['Bodyweight', 'Chair', 'Door-frame', 'Water jugs'],
    limitations: ['Zero heavy weight capacity', 'Floor space only'],
};

/** Residential gym profile name for each dorm (GYM_PROFILES key). */
export function dormToGymProfileName(dorm: Dorm): string {
    if (dorm === Dorm.OFF_CAMPUS) return HOME_GYM_CONFIG.name;

    const labels: Partial<Record<Dorm, string>> = {
        [Dorm.BREEN_PHILLIPS]: 'Breen-Phillips Hall',
        [Dorm.JOHSON_FAMILY]: 'Johnson Family Hall',
        [Dorm.ONEILL]: "O'Neill Family Hall",
        [Dorm.PASQUERILLA_EAST]: 'Pasquerilla East Hall',
        [Dorm.PASQUERILLA_WEST]: 'Pasquerilla West Hall',
        [Dorm.WELSH_FAMILY]: 'Welsh Family Hall',
    };

    return labels[dorm] ?? `${dorm} Hall`;
}

export const CAMPUS_GYM_NAMES: string[] = [
    DEFAULT_GYMS.DUNCAN,
    DEFAULT_GYMS.ROCKNE,
    HOME_GYM_CONFIG.name,
];

/** All residential dorm gyms, sorted A→Z (every Dorm enum value except off-campus). */
export function getDormGymNames(): string[] {
    return Object.values(Dorm)
        .filter((d) => d !== Dorm.OFF_CAMPUS)
        .map(dormToGymProfileName)
        .sort((a, b) => a.localeCompare(b));
}

/** Every selectable training location (campus + dorms). */
export function getAllTrainingLocationNames(): string[] {
    return [...CAMPUS_GYM_NAMES, ...getDormGymNames()];
}

const CAMPUS_PROFILES: Record<string, GymProfile> = {
    [DEFAULT_GYMS.DUNCAN]: {
        name: DEFAULT_GYMS.DUNCAN,
        tier: 'full',
        equipment: [
            'Full Squat Racks',
            'Dumbbells (up to 120lbs)',
            'Barbells',
            'Cable Machines',
            'Leg Press',
            'Smith Machine',
            'Cardio Deck',
            'Turf Area',
            'Kettlebells',
        ],
        limitations: [
            'Extremely busy after 4 PM',
            'No chalk allowed',
            'No dropping deadlift weights outside platform',
        ],
    },
    [DEFAULT_GYMS.ROCKNE]: {
        name: DEFAULT_GYMS.ROCKNE,
        tier: 'standard',
        equipment: [
            '4 Squat Racks (Downstairs)',
            '4 Deadlift Stations (Downstairs)',
            '3 Benches (Downstairs)',
            'Dumbbells up to 75lbs (Downstairs)',
            'Fixed EZ Bars 10-50lbs (Downstairs)',
            'Fixed Straight Bars 60-100lbs (Downstairs)',
            '1 Cable Machine (Downstairs)',
            '1 Dip Attachment (Downstairs)',
            'Treadmills (Upstairs)',
            'Stairmasters (Upstairs)',
            'Bikes & Ellipticals (Upstairs)',
            'Full Cable Tower (Lat Pull, Row, 2 Adjustable) (Upstairs)',
            '4 Benches (Upstairs)',
            'Dumbbells up to 100lbs (Upstairs)',
            'Leg Press (Upstairs)',
            'Assisted Dip/Pull-up (Upstairs)',
            'Quad Extension (Upstairs)',
            'Hamstring Curl (Upstairs)',
        ],
        limitations: [
            'Equipment split across two floors',
            'Dumbbell weight ranges vary by floor',
            "Classic 'Rock' old-school environment",
        ],
    },
    [HOME_GYM_CONFIG.name]: HOME_GYM_CONFIG,
};

const DORM_PROFILES = Object.values(Dorm).reduce(
    (acc, dorm) => {
        const name = dormToGymProfileName(dorm);
        if (dorm === Dorm.OFF_CAMPUS) return acc;
        acc[name] = { name, ...DORM_GYM_CONFIG };
        return acc;
    },
    {} as Record<string, GymProfile>
);

export const GYM_PROFILES: Record<string, GymProfile> = {
    ...CAMPUS_PROFILES,
    ...DORM_PROFILES,
};

export const getGymProfile = (name: string): GymProfile => {
    return GYM_PROFILES[name] ?? HOME_GYM_CONFIG;
};

/** Label shown on Workout tab — valid saved gym, else user's dorm hall. */
export function resolveTrainingLocation(user: {
    dorm?: Dorm | string | null;
    defaultGym?: string | null;
}): string {
    const saved = user.defaultGym?.trim();
    if (saved && GYM_PROFILES[saved]) return saved;

    if (user.dorm) {
        const dorm =
            typeof user.dorm === 'string'
                ? (Object.values(Dorm).includes(user.dorm as Dorm)
                      ? (user.dorm as Dorm)
                      : null)
                : user.dorm;
        if (dorm) return dormToGymProfileName(dorm);
    }

    return DEFAULT_GYMS.DUNCAN;
}

/** True when this gym row is the user's dorm residential gym. */
export function isUserDormGymLocation(
    gymName: string,
    dorm?: Dorm | string | null
): boolean {
    if (!dorm) return false;
    const dormEnum = Object.values(Dorm).includes(dorm as Dorm) ? (dorm as Dorm) : null;
    if (!dormEnum || dormEnum === Dorm.OFF_CAMPUS) return false;
    return gymName === dormToGymProfileName(dormEnum);
}

export function isResidentialHallGym(name: string): boolean {
    return getDormGymNames().includes(name);
}

/** Short copy for Training location UI. */
export function getEquipmentSummaryForUI(locationName: string): string {
    const profile = getGymProfile(locationName);
    switch (profile.tier) {
        case 'full':
            return 'Full equipment — workouts use the full exercise library';
        case 'standard':
            return 'Full gym — plans respect floor-specific gear';
        case 'limited':
            return 'Limited hall gym — workouts adapt to what\'s here';
        case 'minimal':
            return 'Bodyweight & minimal gear only';
        default:
            return 'Workouts adapt to equipment here';
    }
}

/** System-prompt block for Leprechaun AI — always use the user's active training location. */
export function formatGymContextForAI(locationName: string): string {
    const profile = getGymProfile(locationName);
    const isDuncan = locationName === DEFAULT_GYMS.DUNCAN;
    const isResidential = isResidentialHallGym(locationName);

    let block = `[ACTIVE TRAINING LOCATION — authoritative for this session]
Location: ${profile.name}
Tier: ${profile.tier ?? 'standard'}
Available equipment: ${profile.equipment.join('; ')}
Limitations: ${profile.limitations.join('; ')}`;

    if (isDuncan) {
        block += `

EQUIPMENT POLICY: Duncan Student Center has FULL campus gym equipment. Until per-dorm inventories are in the database, treat Duncan as the complete reference — any standard library exercise is allowed if it fits their goal and injuries.`;
    } else if (isResidential) {
        block += `

EQUIPMENT POLICY: This is a RESIDENTIAL hall gym with LIMITED gear (placeholder until hall-specific inventory is loaded). Do NOT prescribe barbell squats, deadlifts, bench press, or heavy machines. Prefer dumbbells, goblet squats, push-ups, rows, lunges, curls, and bodyweight. Swap unavailable lifts for library alternatives.`;
    } else if (locationName === DEFAULT_GYMS.ROCKNE) {
        block += `

EQUIPMENT POLICY: Honor Rockne's two-floor layout — use only equipment listed above; match dumbbell ceilings to the floor (75 lbs downstairs, 100 lbs upstairs).`;
    } else if (locationName === HOME_GYM_CONFIG.name) {
        block += `

EQUIPMENT POLICY: Bodyweight and minimal home gear only — no barbells or machines.`;
    }

    block += `

When the user changes their active training location in the app, this block updates on the next message — always honor the ACTIVE location above, not a previous gym.`;

    return block;
}

export function getGymProfileForUser(user: {
    dorm?: Dorm | string | null;
    defaultGym?: string | null;
}): GymProfile {
    return getGymProfile(resolveTrainingLocation(user));
}

/**
 * Future: hydrate profiles from Supabase when per-dorm equipment is imported.
 */
export function registerGymEquipmentFromDb(
    locationName: string,
    equipment: string[],
    limitations: string[],
    tier?: GymEquipmentTier
): void {
    if (!GYM_PROFILES[locationName]) return;
    GYM_PROFILES[locationName] = {
        ...GYM_PROFILES[locationName],
        equipment,
        limitations,
        ...(tier ? { tier } : {}),
    };
}
