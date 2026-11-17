import { ensure_commitmentdb, type Commitment_t } from "../../lib/db/db";
import type { LsDb } from "../../lib/db/lsdb";
import { Component } from "../component";
import type { MainComponent } from "../main_component";

export class CommitmentPage extends Component {
    private db: LsDb<Commitment_t> = ensure_commitmentdb();
    private placeholder: HTMLElement;
    header = "My Commitments";

    constructor(element: HTMLElement, parent: MainComponent) {

        super(element);
        this.update = async() => {

        }

        // placeholder
        this.placeholder = document.createElement("p");
        this.element.appendChild(this.placeholder);
        this.update();
    }
}