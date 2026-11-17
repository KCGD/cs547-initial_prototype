import { ensure_commitmentdb, type Commitment_t } from "../../lib/db/db";
import type { LsDb } from "../../lib/db/lsdb";
import type { CommitmentWeek, Rated } from "../../lib/planner/planner";
import { Component } from "../component";
import type { MainComponent } from "../main_component";


export class WeekViewPage extends Component {
    private db: LsDb<Commitment_t> = ensure_commitmentdb();
    header = "Week View";

    constructor(element: HTMLElement, parent: MainComponent) {
        super(element);

        this.update = async(week?: Rated<CommitmentWeek>) => {
            console.log(`week view:`, week);
        }
    }
}