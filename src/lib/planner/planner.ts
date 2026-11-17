import type { Commitment_t } from "../db/db";

export type Rated<T> = T & {
    rated: number;
}

type CommitmentWeek = {
    events: Commitment_t[];
};

type WeekRater = (events: readonly Commitment_t[]) => number;

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

export function week_rating_map(score:number): "LOW" | "MEDIUM" | "HEAVY" {
    if(score < 30) return "LOW";
    if(score < 70) return "MEDIUM";
    return "HEAVY";
}

function parseDateOnly(value: string): number {
    const date = new Date(`${value}T00:00:00Z`);
    const timestamp = date.getTime();

    if (
        !/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value) ||
        !Number.isFinite(timestamp) ||
        date.toISOString().slice(0, 10) !== value
    ) {
        throw new RangeError(`Expected a valid YYYY-MM-DD date, got "${value}"`);
    }

    return timestamp;
}

export function rate_week(events: readonly Commitment_t[]): number {
    const weights = {
        Exam: { fixed: 40, flexible: 30 },
        Meeting: { fixed: 20, flexible: 12 },
    };

    const score = events.reduce((total, event) => {
        const weight = weights[event.type];
        return total + (event.movable ? weight.flexible : weight.fixed);
    }, 0);

    return Math.min(100, score);
}

export function create_week_rating (
    events: readonly Commitment_t[],
    start_date: string,
    rater: WeekRater = rate_week,
): Record<string, Rated<CommitmentWeek>> {
    const start = parseDateOnly(start_date);
    const weekOneSunday = start - new Date(start).getUTCDay() * DAY_MS;

    const eventsByWeek = new Map<number, Commitment_t[]>();
    let firstWeek = 0;
    let lastWeek = 0;

    for (const event of events) {
        const date = parseDateOnly(event.date);
        const week = Math.floor((date - weekOneSunday) / WEEK_MS);
        const bucket = eventsByWeek.get(week);

        if (bucket) {
            bucket.push(event);
        } else {
            eventsByWeek.set(week, [event]);
        }

        firstWeek = Math.min(firstWeek, week);
        lastWeek = Math.max(lastWeek, week);
    }

    const weeks: Record<string, Rated<CommitmentWeek>> = {};

    for (let week = firstWeek; week <= lastWeek; week++) {
        const label = week < 0 ? `Pre-sem week ${-week}` : `Week ${week + 1}`;
        const weekEvents = eventsByWeek.get(week) ?? [];
        const score = rater(weekEvents);

        if (!Number.isFinite(score)) {
            throw new RangeError(`Rater returned an invalid score for ${label}`);
        }

        weeks[label] = {
            events: weekEvents,
            rated: Math.max(0, Math.min(100, Math.round(score))),
        };
    }

    // remove empty weeks
    for(const k of Object.keys(weeks)) 
        if(weeks[k].events.length < 1) delete weeks[k];

    return weeks;
}