import { ensure_commitmentdb, type Commitment_t } from "../../lib/db/db";
import type { LsDb } from "../../lib/db/lsdb";
import { Component } from "../component";
import type { MainComponent } from "../main_component";

import "../../style/schedule.css";
import { create_week_rating, week_rating_map } from "../../lib/planner/planner";
import { semester_dates } from "../../const";

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
const weekDateFormat = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
});

function weekStartOffset(label: string): number {
    const match = /^(Pre-sem )?week ([1-9]\d*)$/i.exec(label);
    if (!match) throw new Error(`Unexpected week label: ${label}`);

    const number = Number(match[2]);
    return match[1] ? -number : number - 1;
}

export class SchedulePage extends Component {
    private db: LsDb<Commitment_t> = ensure_commitmentdb();
    header = "My Semester";

    constructor(element: HTMLElement, parent: MainComponent) {
        super(element);
        this.element.classList.add("schedule-page");

        const emptyScreen = document.createElement("div");
        emptyScreen.className = "schedule-empty";
        emptyScreen.hidden = true;

        const icon = document.createElement("img");
        icon.alt = "";
        icon.src = "/public/schedule_icon.png";

        const emptyTitle = document.createElement("h2");
        emptyTitle.textContent = "Nothing here yet.";

        const emptyDescription = document.createElement("p");
        emptyDescription.textContent =
            "Add your exams and meetings here to see which weeks are going to get heavy.";

        const addButton = document.createElement("button");
        addButton.type = "button";
        addButton.textContent = "+ Add Commitment";
        addButton.addEventListener("click", () => parent.setActive("add"));

        emptyScreen.append(icon, emptyTitle, emptyDescription, addButton);

        const weekScreen = document.createElement("div");
        weekScreen.className = "schedule-weeks";
        weekScreen.hidden = true;
        weekScreen.innerHTML = `
            <button type="button" class="schedule-heavy-banner" hidden>
                <span aria-hidden="true">⚠︎</span>
                <span class="schedule-heavy-label"></span>
                <span class="schedule-heavy-arrow" aria-hidden="true"></span>
            </button>
            <ul class="schedule-week-list" aria-label="Semester weeks"></ul>
            <p class="schedule-week-hint">Tap a week to see why it is rated that way</p>
        `;

        const banner = weekScreen.querySelector<HTMLButtonElement>(".schedule-heavy-banner")!;
        const bannerText = weekScreen.querySelector<HTMLElement>(".schedule-heavy-label")!;
        const list = weekScreen.querySelector<HTMLUListElement>(".schedule-week-list")!;

        const status = document.createElement("p");
        status.className = "schedule-week-status";
        status.setAttribute("role", "status");

        this.element.append(emptyScreen, weekScreen, status);

        let updateVersion = 0;
        this.update = async () => {
            const version = ++updateVersion;

            try {
                const commitments = await this.db.find({});
                if (version !== updateVersion) return;

                const start = semester_dates().start;
                const weeks = commitments.length > 0
                    ? Object.entries(create_week_rating(commitments, start))
                    : [];
                const startDate = new Date(`${start}T00:00:00Z`);
                const weekOneSunday = startDate.getTime() - startDate.getUTCDay() * DAY_MS;
                const rows = document.createDocumentFragment();
                let firstHeavy: (typeof weeks)[number] | undefined;

                for (const [label, week] of weeks) {
                    const score = week.rated;
                    const rating = week_rating_map(score);
                    if (rating === "HEAVY" && !firstHeavy) firstHeavy = [label, week];

                    const row = document.createElement("li");
                    const button = document.createElement("button");
                    button.type = "button";
                    button.className = "schedule-week-row";
                    button.dataset.rating = rating;
                    button.style.setProperty("--week-score", String(Math.max(0, Math.min(100, score)) / 100));
                    button.addEventListener("click", () => parent.setActive("weekview", week));

                    const heading = document.createElement("span");
                    heading.className = "schedule-week-heading";
                    const title = document.createElement("strong");
                    title.textContent = label.replace(/\bweek\b/i, "Wk");
                    const date = document.createElement("span");
                    date.className = "schedule-week-date";
                    date.textContent = weekDateFormat.format(
                        weekOneSunday + weekStartOffset(label) * WEEK_MS,
                    );
                    heading.append(title, date);

                    const meter = document.createElement("span");
                    meter.className = "schedule-week-meter";
                    const bar = document.createElement("span");
                    bar.className = "schedule-week-bar";
                    bar.setAttribute("aria-hidden", "true");
                    const ratingText = document.createElement("span");
                    ratingText.className = "schedule-week-rating";
                    ratingText.textContent = rating;
                    meter.append(bar, ratingText);

                    button.append(heading, meter);
                    row.appendChild(button);
                    rows.appendChild(row);
                }

                list.replaceChildren(rows);
                banner.hidden = !firstHeavy;
                banner.onclick = null;
                if (firstHeavy) {
                    const [label, week] = firstHeavy;
                    bannerText.textContent = `${label} is heavy!`;
                    banner.onclick = () => parent.setActive("weekview", week);
                }

                emptyScreen.hidden = weeks.length > 0;
                weekScreen.hidden = weeks.length === 0;
                status.textContent = "";
            } catch (error) {
                if (version !== updateVersion) return;
                console.error("Could not load semester weeks", error);
                status.textContent = "Couldn’t load semester weeks.";
            }
        };

        void this.update();
    }
}
