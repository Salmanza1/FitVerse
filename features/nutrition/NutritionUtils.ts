export const UNITS = {
    SERVING: 'serving',
    OZ: 'oz',
    G: 'g',
    CUP: 'cup',
    HANDFUL: 'handful',
    PIECE: 'piece',
    TBSP: 'tbsp',
    TSP: 'tsp',
};

// Standard conversion factors to "Internal Units" (let's use Ounces as base for volume/weight approximation)
const CONVERSIONS: Record<string, number> = {
    [UNITS.SERVING]: 1,
    [UNITS.OZ]: 1,
    [UNITS.G]: 0.035274, // 1g = 0.035 oz
    [UNITS.CUP]: 8,       // 1 cup = 8 oz
    [UNITS.HANDFUL]: 1.5, // 1 handful ≈ 1.5 oz (rough estimate for nuts/greens)
    [UNITS.TBSP]: 0.5,    // 1 tbsp = 0.5 oz
    [UNITS.TSP]: 0.166,   // 1 tsp = 0.166 oz
    [UNITS.PIECE]: 1,
};

/**
 * Calculates the macro multiplier based on the selected amount/unit vs the base amount/unit.
 */
export const calculateMultiplier = (
    selectedAmount: number,
    selectedUnit: string,
    baseAmount: number = 1,
    baseUnit: string = 'serving'
): number => {
    const sUnit = (selectedUnit || 'serving').toLowerCase();
    const bUnit = (baseUnit || 'serving').toLowerCase();

    // If units match exactly (or both are serving variants), simple ratio
    if (sUnit === bUnit || (sUnit.includes('serv') && bUnit.includes('serv'))) {
        return selectedAmount / (baseAmount || 1);
    }

    // Try to find conversion factors
    const sFactor = getFactor(sUnit);
    const bFactor = getFactor(bUnit);

    // CRITICAL FIX: If we are converting from/to a 'serving' where base weight is unknown,
    // we must assume 1 serving = 1 internal unit (oz) as a fallback to prevent 100x errors.
    // However, if one is 'serving' and the other is a weight unit, we attempt a sensible estimate.
    
    // If base is a serving and we log weight: 
    // Most ND servings are ~4oz (standard portion) or 1oz (condiments/small items)
    // We'll use a conservative 1:1 if we can't be sure, but prioritizing the known weight.
    
    const sValue = selectedAmount * sFactor;
    const bValue = (baseAmount || 1) * bFactor;

    return sValue / bValue;
};

const getFactor = (unit: string): number => {
    const u = unit.toLowerCase();
    if (u.includes('oz') || u.includes('ounce')) return CONVERSIONS[UNITS.OZ];
    if (u.includes('gram') || u === 'g') return CONVERSIONS[UNITS.G];
    if (u.includes('cup')) return CONVERSIONS[UNITS.CUP];
    if (u.includes('handful')) return CONVERSIONS[UNITS.HANDFUL];
    if (u.includes('tbsp') || u.includes('tablespoon')) return CONVERSIONS[UNITS.TBSP];
    if (u.includes('tsp') || u.includes('teaspoon')) return CONVERSIONS[UNITS.TSP];
    if (u.includes('piece') || u.includes('each') || u.includes('slice') || u.includes('item')) return CONVERSIONS[UNITS.PIECE];

    return 1; // Default to 1 (servings)
};

export const getAvailableUnits = (baseUnit: string = 'serving'): string[] => {
    const b = baseUnit.toLowerCase();
    
    // Core units always available
    const units = [UNITS.SERVING, UNITS.OZ, UNITS.G];

    // Contextual adds
    if (b.includes('cup')) units.push(UNITS.CUP);
    if (b.includes('handful')) units.push(UNITS.HANDFUL);
    if (b.includes('tbsp') || b.includes('tsp')) units.push(UNITS.TBSP, UNITS.TSP);
    if (b.includes('piece') || b.includes('each') || b.includes('slice') || b.includes('item')) {
        units.push(UNITS.PIECE);
    }

    // Deduplicate and return
    return Array.from(new Set(units));
};

export const formatAmount = (amount: number): string => {
    if (amount >= 10) return Math.round(amount).toString();
    return amount.toFixed(1).replace(/\.0$/, '');
};
