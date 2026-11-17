import { ensure_commitmentdb, type Commitment_t } from "../../lib/db/db";
import type { LsDb } from "../../lib/db/lsdb";
import { Component } from "../component";
import type { MainComponent } from "../main_component";

import "../../style/schedule.css";

export class SchedulePage extends Component {
    private db: LsDb<Commitment_t> = ensure_commitmentdb();
    private parent:MainComponent;
    header = "My Semester";
    
    private noCommitmentsScreen: HTMLElement;

    constructor(element: HTMLElement, parent:MainComponent) {
        super(element);
        this.parent = parent;
        this.element.classList.add("schedule-page");

        this.update = async() => {
            // query for all commitments
            let res = await this.db.find({});
            if(res.length < 1) {
                /**
                 * No commitments, show "no commitments" and "add commitment"
                 */
                this.noCommitmentsScreen.hidden = false;
            } else {
                /**
                 * Commitments present, show weeks by weight
                 */
                this.noCommitmentsScreen.hidden = true;
            }
        }

        /**
         * set up no commitments screen
         */
        const ncscreen = document.createElement("div");
        ncscreen.classList.add("schedule-empty");
        ncscreen.hidden = true;  

        // create schedule icon, placeholder text, button
        const sched_icon = document.createElement("img");
        sched_icon.alt = "No commitments yet.";
        sched_icon.src = "/public/schedule_icon.png";
        ncscreen.appendChild(sched_icon);

        // title (nothing here)
        const nothing_here_title = document.createElement("h2");
        nothing_here_title.innerText = "Nothing here yet.";
        ncscreen.appendChild(nothing_here_title);

        // subtext (description)
        const nothing_here_text = document.createElement("p");
        nothing_here_text.innerHTML = "Add your exams and meetings here to see which weeks are going to get heavy.";
        ncscreen.appendChild(nothing_here_text);

        // button (adds new)
        const add_new_button = document.createElement("button");
        add_new_button.innerText = "+ Add Commitment";
        add_new_button.addEventListener('click', () => {this.parent.setActive("add")});
        ncscreen.appendChild(add_new_button);

        // assign to class
        this.noCommitmentsScreen = ncscreen;
        this.element.appendChild(this.noCommitmentsScreen);

        /**
         * Call initial update
         */
        this.update();
    }
}