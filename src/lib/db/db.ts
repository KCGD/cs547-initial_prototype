import { LsDb } from "./lsdb";

const DB_COMMITMENT_COLLECTION = "commitments";
const DB_WEEK_OVERRIDE = "week_override";

export type Commitment_t = {
    type: "Exam" | "Meeting";
    name: string;
    date: string;
    movable: boolean;
    repeats: "once" | "daily" | "weekly" | "bi-weekly"
    time: string | null;
}

export type WeekOverride_t = {
    start_date: string;
    rating: number;
}

let __db_commitments: LsDb<Commitment_t> | undefined = undefined;
let __db_overrides: LsDb<WeekOverride_t> | undefined = undefined;

export function ensure_commitmentdb(): LsDb<Commitment_t> {
    if(!__db_commitments) __db_commitments = new LsDb<Commitment_t>(DB_COMMITMENT_COLLECTION);
    return __db_commitments;
}

export function ensure_overridedb(): LsDb<WeekOverride_t> {
    if(!__db_overrides) __db_overrides = new LsDb<WeekOverride_t>(DB_WEEK_OVERRIDE);
    return __db_overrides;
}