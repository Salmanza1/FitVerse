import { Dorm } from '@/types/user';

/**
 * Direct Wikimedia PNG thumbs (250px — 200px URLs return HTTP 400).
 * @see https://commons.wikimedia.org/wiki/Category:Coats_of_arms_of_halls_of_the_University_of_Notre_Dame
 */
const DORM_LOGO_URIS: Record<Dorm, string> = {
    [Dorm.ALUMNI]: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/Arms_of_Alumni.svg/250px-Arms_of_Alumni.svg.png',
    [Dorm.BADIN]: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/Arms_of_Badin.svg/250px-Arms_of_Badin.svg.png',
    [Dorm.BAUMER]: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Arms_of_Baumer.svg/250px-Arms_of_Baumer.svg.png',
    [Dorm.BREEN_PHILLIPS]: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b2/Arms_of_Breen-Phillips.svg/250px-Arms_of_Breen-Phillips.svg.png',
    [Dorm.CARROLL]: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/Arms_of_Carroll.svg/250px-Arms_of_Carroll.svg.png',
    [Dorm.CAVANAUGH]: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Arms_of_Cavanaugh.svg/250px-Arms_of_Cavanaugh.svg.png',
    [Dorm.DILLON]: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bd/Arms_of_Dillon.svg/250px-Arms_of_Dillon.svg.png',
    [Dorm.DUNCAN]: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Arms_of_Duncan.svg/250px-Arms_of_Duncan.svg.png',
    [Dorm.DUNNE]: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Arms_of_Dunne.svg/250px-Arms_of_Dunne.svg.png',
    [Dorm.FARLEY]: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Arms_of_Farley.svg/250px-Arms_of_Farley.svg.png',
    [Dorm.FISHER]: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/42/Arms_of_Fisher_Hall.svg/250px-Arms_of_Fisher_Hall.svg.png',
    [Dorm.FLAHERTY]: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Arms_of_Flaherty_Hall.svg/250px-Arms_of_Flaherty_Hall.svg.png',
    [Dorm.HOWARD]: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/71/Arms_of_Howard.svg/250px-Arms_of_Howard.svg.png',
    [Dorm.JOHSON_FAMILY]: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/Arms_of_Johnson_Family.svg/250px-Arms_of_Johnson_Family.svg.png',
    [Dorm.KEENAN]: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Arms_of_Keenan.svg/250px-Arms_of_Keenan.svg.png',
    [Dorm.KEOUGH]: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Arms_of_Keough.svg/250px-Arms_of_Keough.svg.png',
    [Dorm.KNOTT]: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/99/Arms_of_Knott.svg/250px-Arms_of_Knott.svg.png',
    [Dorm.LEWIS]: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/Arms_of_Lewis.svg/250px-Arms_of_Lewis.svg.png',
    [Dorm.LYONS]: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/df/Arms_of_Lyons_Hall.svg/250px-Arms_of_Lyons_Hall.svg.png',
    [Dorm.MCGLINN]: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Arms_of_McGlinn.svg/250px-Arms_of_McGlinn.svg.png',
    [Dorm.MORRISSEY]: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/ff/Arms_of_Morrissey.svg/250px-Arms_of_Morrissey.svg.png',
    [Dorm.ONEILL]: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/Arms_of_ONeill.svg/250px-Arms_of_ONeill.svg.png',
    [Dorm.PANGBORN]: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/Arms_of_Sorin_Hall.svg/250px-Arms_of_Sorin_Hall.svg.png',
    [Dorm.PASQUERILLA_EAST]: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/49/Arms_of_Pasquerilla_East.svg/250px-Arms_of_Pasquerilla_East.svg.png',
    [Dorm.PASQUERILLA_WEST]: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/Arms_of_Pasquerilla_West.svg/250px-Arms_of_Pasquerilla_West.svg.png',
    [Dorm.RYAN]: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Arms_of_Ryan.svg/250px-Arms_of_Ryan.svg.png',
    [Dorm.SIEGFRIED]: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Arms_of_Siegfried.svg/250px-Arms_of_Siegfried.svg.png',
    [Dorm.SORIN]: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/Arms_of_Sorin_Hall.svg/250px-Arms_of_Sorin_Hall.svg.png',
    [Dorm.STANFORD]: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f5/Arms_of_Stanford_Hall.svg/250px-Arms_of_Stanford_Hall.svg.png',
    [Dorm.WALSH]: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Arms_of_Walsh.svg/250px-Arms_of_Walsh.svg.png',
    [Dorm.WELSH_FAMILY]: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Arms_of_Welsh_Family.svg/250px-Arms_of_Welsh_Family.svg.png',
    [Dorm.OFF_CAMPUS]: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/Arms_of_Sorin_Hall.svg/250px-Arms_of_Sorin_Hall.svg.png',
};

export function getDormLogoSource(dorm: Dorm): { uri: string } {
    return { uri: DORM_LOGO_URIS[dorm] ?? DORM_LOGO_URIS[Dorm.SORIN] };
}

/** Match leaderboard / feed strings to a Dorm enum value. */
export function resolveDormFromName(name: string): Dorm {
    const normalized = name.trim().toLowerCase();
    if (!normalized) return Dorm.SORIN;

    const exact = Object.values(Dorm).find((d) => d.toLowerCase() === normalized);
    if (exact) return exact;

    const byLength = [...Object.values(Dorm)].sort((a, b) => b.length - a.length);
    for (const d of byLength) {
        if (normalized.includes(d.toLowerCase())) return d;
    }

    if (normalized.includes('oneill') || normalized.includes("o'neill")) return Dorm.ONEILL;
    if (normalized.includes('breen')) return Dorm.BREEN_PHILLIPS;
    if (normalized.includes('pasquerilla') && normalized.includes('east')) return Dorm.PASQUERILLA_EAST;
    if (normalized.includes('pasquerilla') && normalized.includes('west')) return Dorm.PASQUERILLA_WEST;
    if (normalized.includes('johnson')) return Dorm.JOHSON_FAMILY;
    if (normalized.includes('welsh')) return Dorm.WELSH_FAMILY;
    if (normalized.includes('off') && normalized.includes('campus')) return Dorm.OFF_CAMPUS;

    return Dorm.SORIN;
}
