import { ensure_overridedb } from "../../lib/db/db";
import { week_rating_map } from "../../lib/planner/planner";
import { Component } from "../component";
import type { MainComponent } from "../main_component";
import { dispatchPlannerUpdate, weekStart, type WeekViewData } from "./week_view";

import "../../style/adjust_rating.css";

const RATINGS = { LOW: 15, MEDIUM: 50, HEAVY: 85 } as const;

export class AdjustRating extends Component {
    private overridedb = ensure_overridedb();
    header = "Adjust Rating";

    constructor(element: HTMLElement, parent: MainComponent) {
        super(element);
        this.element.classList.add("adjust-rating-page");

        const form = document.createElement("form");
        form.className = "adjust-rating-form";
        form.innerHTML = `
            <h2>Rating feels off?</h2>
            <p class="adjust-rating-description"></p>
            <fieldset disabled>
                <legend class="adjust-rating-legend">Week difficulty</legend>
                <div class="adjust-rating-options">
                    <label><input type="radio" name="rating" value="LOW" required><span>Light</span></label>
                    <label><input type="radio" name="rating" value="MEDIUM"><span>Medium</span></label>
                    <label><input type="radio" name="rating" value="HEAVY"><span>Heavy</span></label>
                </div>
                <div class="adjust-rating-actions">
                    <button type="button">Cancel</button>
                    <button type="submit">Save</button>
                </div>
            </fieldset>
            <p class="adjust-rating-status" role="status"></p>
        `;

        const fields = form.querySelector<HTMLFieldSetElement>("fieldset")!;
        const description = form.querySelector<HTMLElement>(".adjust-rating-description")!;
        const status = form.querySelector<HTMLElement>(".adjust-rating-status")!;
        const cancel = form.querySelector<HTMLButtonElement>('button[type="button"]')!;
        let currentWeek: WeekViewData | undefined;
        let request = 0;
        let loading = false;
        let saving = false;

        const selectRating = (rating: number) => {
            const value = week_rating_map(rating);
            form.querySelector<HTMLInputElement>(`input[value="${value}"]`)!.checked = true;
        };

        this.update = async (week?: WeekViewData) => {
            if (!week) return;

            const version = ++request;
            const start = weekStart(week);
            currentWeek = start === undefined ? undefined : {
                ...week,
                startDate: new Date(start).toISOString().slice(0, 10),
            };

            description.textContent = `Pick how ${week.label ?? "this week"} feels to you. Your choice replaces the estimate.`;
            status.textContent = "";
            fields.disabled = true;
            loading = Boolean(currentWeek);
            selectRating(week.rated);

            if (!currentWeek) {
                status.textContent = "This week’s start date is unavailable.";
                return;
            }

            try {
                const overrides = await this.overridedb.find({ start_date: currentWeek.startDate });
                if (version === request) selectRating(overrides[overrides.length - 1]?.rating ?? week.rated);
            } catch (error) {
                if (version === request) {
                    console.error("Could not load the week rating", error);
                    status.textContent = "Couldn’t load the saved rating.";
                }
            } finally {
                if (version === request) {
                    loading = false;
                    fields.disabled = saving;
                }
            }
        };

        cancel.addEventListener("click", () => {
            if (!saving && currentWeek) parent.setActive("weekview", currentWeek);
        });

        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            const week = currentWeek;
            const start_date = week?.startDate;
            if (!week || !start_date || saving || fields.disabled) return;

            const choice = form.querySelector<HTMLInputElement>('input[name="rating"]:checked');
            if (!choice) return;

            const rating = RATINGS[choice.value as keyof typeof RATINGS];
            const version = request;
            saving = true;
            fields.disabled = true;
            status.textContent = "";

            try {
                try {
                    const updated = await this.overridedb.update({ start_date }, { rating });
                    if (updated.length === 0) await this.overridedb.insert({ start_date, rating });
                } catch (error) {
                    console.error("Could not save the week rating", error);
                    if (version === request) status.textContent = "Couldn’t save your rating. Try again.";
                    return;
                }

                const savedWeek = { ...week, rated: rating };
                if (version === request) currentWeek = savedWeek;
                try {
                    await dispatchPlannerUpdate(parent);
                } catch (error) {
                    console.error("Could not refresh pages after saving the rating", error);
                    if (version === request) status.textContent = "Rating saved. Other pages could not refresh.";
                    return;
                }

                if (version === request && !this.element.hidden) parent.setActive("weekview", savedWeek);
            } finally {
                saving = false;
                fields.disabled = loading || !currentWeek;
            }
        });

        this.element.appendChild(form);
    }
}
