export const SECOND = 1000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
export const YEAR = 365 * DAY;

const units = {
    ms: 1,
    s: SECOND,
    m: MINUTE,
    h: HOUR,
    d: DAY,
} as const satisfies Record<string, number>;

export function stringToDuration(string?: string | null) {
    if (!string) {
        return null;
    }

    const matches = /^(?<amount>\d+)(?<unit>\D+)$/v.exec(string.replace(/\s/gv, ''));

    if (!matches?.groups?.amount || !matches.groups.unit || !Object.keys(units).includes(matches.groups.unit)) {
        return null;
    }

    return Number(matches.groups.amount) * units[matches.groups.unit as keyof typeof units];
}
