import { ensure_commitmentdb, type Commitment_t } from "../../lib/db/db";
import type { LsDb } from "../../lib/db/lsdb";
import {
    create_week_rating,
    week_rating_map,
    type CommitmentWeek,
    type Rated,
} from "../../lib/planner/planner";
import { Component } from "../component";
import type { MainComponent } from "../main_component";

import "../../style/week_view.css";

export type WeekViewData = Rated<CommitmentWeek> & {
    label?: string;
    startDate?: string;
};

const DAY_MS = 86_400_000;
const rangeDate = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
});
const weekday = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: "UTC",
});
const timeOfDay = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
});

function weekStart(week: WeekViewData): number | undefined {
    if (week.startDate) {
        const start = Date.parse(`${week.startDate}T00:00:00Z`);
        if (Number.isFinite(start)) return start;
    }

    // Older callers pass only events and rated. Derive the Sunday from an event.
    for (const event of week.events) {
        const date = new Date(`${event.date}T00:00:00Z`);
        if (Number.isFinite(date.getTime())) {
            return date.getTime() - date.getUTCDay() * DAY_MS;
        }
    }
}

function eventName(event: Commitment_t): string {
    if (!event.time) return event.name;
    const time = Date.parse(`2000-01-01T${event.time}:00Z`);
    return Number.isFinite(time) ? `${event.name}, ${timeOfDay.format(time)}` : event.name;
}

export class WeekViewPage extends Component {
    private db: LsDb<Commitment_t> = ensure_commitmentdb();
    header = "Week View";

    constructor(element: HTMLElement, parent: MainComponent) {
        super(element);
        this.element.classList.add("week-view");

        const content = document.createElement("div");
        content.className = "week-view-content";
        content.hidden = true;
        content.innerHTML = `
            <p class="week-view-range"></p>
            <div class="week-view-meter">
                <span class="week-view-bar" aria-hidden="true"></span>
                <span class="week-view-rating"></span>
            </div>
            <p class="week-view-summary"></p>
            <ul class="week-view-events" aria-label="Commitments this week"></ul>
            <p class="week-view-status" role="status"></p>
            <div class="week-view-actions">
                <button type="button" class="week-view-suggested">See suggested moves</button>
                <button type="button" class="week-view-rating-link">Rating feels off? Change it</button>
            </div>
        `;

        const range = content.querySelector<HTMLElement>(".week-view-range")!;
        const bar = content.querySelector<HTMLElement>(".week-view-bar")!;
        const rating = content.querySelector<HTMLElement>(".week-view-rating")!;
        const summary = content.querySelector<HTMLElement>(".week-view-summary")!;
        const eventsList = content.querySelector<HTMLUListElement>(".week-view-events")!;
        const status = content.querySelector<HTMLElement>(".week-view-status")!;
        const suggested = content.querySelector<HTMLButtonElement>(".week-view-suggested")!;
        const changeRating = content.querySelector<HTMLButtonElement>(".week-view-rating-link")!;

        let currentWeek: WeekViewData | undefined;
        let saving = false;
        let readRevision = 0;

        const setSaving = (pending: boolean) => {
            saving = pending;
            suggested.disabled = pending;
            eventsList.querySelectorAll<HTMLButtonElement>(".week-view-toggle").forEach((button) => {
                button.disabled = pending || !button.dataset.id;
            });
        };

        const toggleMovable = async (id: string, movable: boolean) => {
            if (saving) return;
            setSaving(true);
            status.textContent = "";

            try {
                try {
                    await this.saveMovable(id, movable);
                } catch (error) {
                    console.error("Could not update commitment", error);
                    status.textContent = "Couldn’t update this commitment. Try again.";
                    return;
                }

                if (currentWeek?.events.some((event) => (event as { _id?: string })._id === id)) {
                    const events = currentWeek.events.map((event) =>
                        (event as { _id?: string })._id === id ? { ...event, movable } : event,
                    );
                    currentWeek = { ...currentWeek, events };
                    const start = weekStart(currentWeek);

                    if (start !== undefined) {
                        try {
                            const date = new Date(start).toISOString().slice(0, 10);
                            const updatedRating = create_week_rating(events, date)["Week 1"];
                            if (updatedRating) currentWeek = { ...currentWeek, rated: updatedRating.rated };
                        } catch (error) {
                            console.error("Could not recalculate week rating", error);
                            status.textContent = "Commitment saved. The week rating could not refresh.";
                        }
                    }
                    ++readRevision;
                    render();
                }

                try {
                    await parent.disbatchUpdate();
                } catch (error) {
                    console.error("Could not refresh pages after saving commitment", error);
                    status.textContent = "Commitment saved. Other pages could not refresh.";
                }
            } finally {
                setSaving(false);
            }
        };

        const render = () => {
            if (!currentWeek) return;

            this.header = currentWeek.label ?? "Week View";
            const start = weekStart(currentWeek);
            range.textContent = start === undefined
                ? ""
                : `${rangeDate.format(start)} to ${rangeDate.format(start + 6 * DAY_MS)}`;
            range.hidden = start === undefined;

            const score = Math.round(Math.max(0, Math.min(100, currentWeek.rated)));
            const ratingLabel = week_rating_map(score);
            content.dataset.rating = ratingLabel;
            bar.style.setProperty("--week-score", String(score / 100));
            rating.textContent = ratingLabel;

            const events = [...currentWeek.events].sort((a, b) =>
                a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""),
            );
            const exams = events.filter((event) => event.type === "Exam").length;
            const meetings = events.filter((event) => event.type === "Meeting").length;
            summary.textContent = `${exams} ${exams === 1 ? "exam" : "exams"} + ${meetings} ${meetings === 1 ? "meeting" : "meetings"}`;

            const rows = document.createDocumentFragment();
            for (const event of events) {
                const id = (event as { _id?: string })._id;
                const row = document.createElement("li");
                const day = document.createElement("span");
                day.className = "week-view-day";
                const date = Date.parse(`${event.date}T00:00:00Z`);
                day.textContent = Number.isFinite(date) ? weekday.format(date) : "";

                const name = document.createElement("span");
                name.className = "week-view-event-name";
                name.textContent = eventName(event);

                const toggle = document.createElement("button");
                toggle.type = "button";
                toggle.className = "week-view-toggle";
                toggle.textContent = event.movable ? "flexible" : "fixed";
                toggle.setAttribute("aria-label", `Flexible: ${event.name}`);
                toggle.setAttribute("aria-pressed", String(event.movable));
                if (id) {
                    toggle.dataset.id = id;
                    toggle.addEventListener("click", () => void toggleMovable(id, !event.movable));
                }

                row.append(day, name, toggle);
                rows.appendChild(row);
            }
            if (events.length === 0) {
                const empty = document.createElement("li");
                empty.className = "week-view-empty";
                empty.textContent = "No commitments this week.";
                rows.appendChild(empty);
            }
            eventsList.replaceChildren(rows);
            setSaving(saving);
            content.hidden = false;
        };

        this.update = async (week?: WeekViewData) => {
            const request = ++readRevision;
            if (week) {
                currentWeek = week;
                status.textContent = "";
                render();
            }

            const selected = currentWeek;
            if (!selected) return;
            const start = weekStart(selected);
            if (start === undefined) return;

            try {
                const commitments = await this.db.find({});
                if (request !== readRevision) return;

                const events = commitments.filter((event) => {
                    const date = Date.parse(`${event.date}T00:00:00Z`);
                    return date >= start && date < start + 7 * DAY_MS;
                });
                const startDate = new Date(start).toISOString().slice(0, 10);
                const rated = events.length > 0
                    ? create_week_rating(events, startDate)["Week 1"]?.rated ?? selected.rated
                    : 0;
                currentWeek = { ...selected, startDate, events, rated };
                render();
            } catch (error) {
                if (request !== readRevision) return;
                console.error("Could not refresh week commitments", error);
                status.textContent = "Couldn’t refresh this week.";
            }
        };

        suggested.addEventListener("click", () => {
            if (currentWeek && !saving) parent.setActive("suggested", currentWeek);
        });
        changeRating.addEventListener("click", () => {
            window.alert("Rating adjustment will be available here.");
        });

        this.element.appendChild(content);
    }

    private async saveMovable(id: string, movable: boolean): Promise<void> {
        const result: unknown = await this.db.update({ _id: id }, { movable });
        if (result === false || result === 0) throw new Error("No commitment was updated");
    }
}
