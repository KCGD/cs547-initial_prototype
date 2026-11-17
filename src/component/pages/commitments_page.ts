import { ensure_commitmentdb, type Commitment_t } from "../../lib/db/db";
import type { LsDb } from "../../lib/db/lsdb";
import { Component } from "../component";

export class CommitmentPage extends Component {
    private update: Function;
    private db: LsDb<Commitment_t> = ensure_commitmentdb();
    private placeholder: HTMLElement;

    constructor(element: HTMLElement) {

        super(element);
        this.update = async() => {
            this.placeholder.innerText = JSON.stringify(await this.db.find({}));
        }

        // placeholder
        this.placeholder = document.createElement("p");
        this.element.appendChild(this.placeholder);
        this.update();
    }
}