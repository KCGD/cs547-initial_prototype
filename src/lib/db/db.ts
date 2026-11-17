import { LsDb } from "./lsdb";

const DB_COMMITMENT_COLLECTION = "commitments";

type Commitment_t = {
    type: "Exam" | "Meeting";
    name: string;
    date: string;
    movable: boolean;
}

let __db_commitments: LsDb<Commitment_t> | undefined = undefined;

export function ensure_commitmentdb(): LsDb<Commitment_t> {
    if(!__db_commitments) __db_commitments = new LsDb<Commitment_t>(DB_COMMITMENT_COLLECTION);
    return __db_commitments;
}