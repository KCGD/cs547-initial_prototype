import { ensure_commitmentdb, ensure_overridedb, type Commitment_t } from "../../lib/db/db";
import type { LsDb } from "../../lib/db/lsdb";
import { create_week_rating, week_rating_map } from "../../lib/planner/planner";
import { semester_dates } from "../../const";
import { Component } from "../component";
import type { MainComponent } from "../main_component";
import { dispatchPlannerUpdate, type WeekViewData } from "./week_view";

import "../../style/suggestions.css";

type SavedCommitment = Commitment_t & { _id: string };

type Suggestion = {
    event: SavedCommitment;
    date: string;
    targetWeek: number;
    before: number;
    after: number;
};

type Selection = {
    start: number;
    label: string;
    dismissed: Set<string>;
    dates: Map<string, string>;
};

const DAY = 86_400_000;
const WEEK = 7 * DAY;
const formatDay = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
});

function dateKey(date: number): string {
    return new Date(date).toISOString().slice(0, 10);
}

function parseDate(value: string): number | undefined {
    if (!/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value)) return;
    const date = Date.parse(`${value}T00:00:00Z`);
    if (Number.isFinite(date) && dateKey(date) === value) return date;
}

function sunday(date: number): number {
    return date - new Date(date).getUTCDay() * DAY;
}

function scoreWeek(start: number, events: readonly Commitment_t[]): number {
    return events.length === 0
        ? 0
        : create_week_rating([...events], dateKey(start))["Week 1"]?.rated ?? 0;
}

function weekLabel(start: number, semesterSunday: number, short = false): string {
    const offset = Math.round((start - semesterSunday) / WEEK);
    const title = short ? "Wk" : "Week";
    return offset < 0 ? `Pre-sem ${title} ${-offset}` : `${title} ${offset + 1}`;
}

function comparisonBar(before: number, after: number, emphasizeAfter: boolean): HTMLElement {
    const meter = document.createElement("span");
    meter.className = "suggestions-meter";
    meter.setAttribute("aria-label", `Workload before ${before} of 100, after ${after} of 100`);
    meter.setAttribute("role", "img");

    const track = document.createElement("span");
    track.className = "suggestions-track";
    const scores = emphasizeAfter ? [before, after] : [after, before];
    for (const [index, score] of scores.entries()) {
        const bar = document.createElement("span");
        bar.className = index === 0 ? "suggestions-bar suggestions-faded" : "suggestions-bar";
        bar.dataset.rating = week_rating_map(score);
        bar.style.width = `${Math.max(0, Math.min(100, score))}%`;
        track.appendChild(bar);
    }

    const rating = document.createElement("span");
    rating.className = "suggestions-rating";
    rating.textContent = week_rating_map(emphasizeAfter ? after : before);
    meter.append(track, rating);
    return meter;
}

export class Suggestions extends Component {
    private db: LsDb<Commitment_t> = ensure_commitmentdb();
    private overridedb = ensure_overridedb();
    header = "Suggested Moves";

    constructor(element: HTMLElement, parent: MainComponent) {
        super(element);
        this.element.classList.add("suggestions-page");

        const content = document.createElement("div");
        content.className = "suggestions-content";
        content.hidden = true;
        content.innerHTML = `
            <p class="suggestions-intro"></p>
            <div class="suggestions-list"></div>
            <div class="suggestions-total"></div>
            <button type="button" class="suggestions-apply"></button>
            <p class="suggestions-status" role="status"></p>
            <dialog class="suggestions-picker" aria-label="Pick another week">
                <form>
                    <label>Move to date <input type="date" required></label>
                    <p class="suggestions-picker-status" role="status"></p>
                    <div class="suggestions-actions">
                        <button type="submit">Use date</button>
                        <button type="button" class="suggestions-cancel">Cancel</button>
                    </div>
                </form>
            </dialog>
        `;
        const intro = content.querySelector<HTMLElement>(".suggestions-intro")!;
        const list = content.querySelector<HTMLElement>(".suggestions-list")!;
        const total = content.querySelector<HTMLElement>(".suggestions-total")!;
        const apply = content.querySelector<HTMLButtonElement>(".suggestions-apply")!;
        const status = content.querySelector<HTMLElement>(".suggestions-status")!;
        const picker = content.querySelector<HTMLDialogElement>("dialog")!;
        const pickerForm = picker.querySelector<HTMLFormElement>("form")!;
        const dateInput = picker.querySelector<HTMLInputElement>("input")!;
        const pickerStatus = picker.querySelector<HTMLElement>(".suggestions-picker-status")!;
        if (dateInput.type === "text") dateInput.placeholder = "YYYY-MM-DD";

        let selection: Selection | undefined;
        let commitments: SavedCommitment[] = [];
        let ratingsByStart = new Map<string, number>();
        let suggestions: Suggestion[] = [];
        let pickFor: Suggestion | undefined;
        let loading = false;
        let saving = false;
        let revision = 0;

        const makeButton = (label: string, className: string) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = className;
            button.textContent = label;
            button.disabled = loading || saving;
            return button;
        };

        const pickDate = (suggestion: Suggestion) => {
            pickFor = suggestion;
            dateInput.value = suggestion.date;
            pickerStatus.textContent = "";
            picker.showModal();
            if (typeof dateInput.showPicker === "function") {
                try {
                    dateInput.showPicker();
                } catch {
                    // The date input remains available when the browser blocks showPicker().
                }
            }
        };

        const render = () => {
            if (!selection) return;

            const current = selection;
            const semester = semester_dates();
            const first = parseDate(semester.start)!;
            const last = parseDate(semester.end)!;
            const firstSunday = sunday(first);
            const buckets = new Map<number, SavedCommitment[]>();
            const effectiveScore = (start: number, events: readonly Commitment_t[]) =>
                ratingsByStart.get(dateKey(start)) ?? scoreWeek(start, events);

            for (const event of commitments) {
                const date = parseDate(event.date);
                if (date === undefined) continue;
                const start = sunday(date);
                const events = buckets.get(start);
                if (events) events.push(event);
                else buckets.set(start, [event]);
            }

            const source = buckets.get(current.start) ?? [];
            const before = effectiveScore(current.start, source);
            const candidates = source.filter((event) => event.movable &&
                event._id && !current.dismissed.has(event._id));
            const planned = new Map<number, SavedCommitment[]>();

            const reserve = (event: SavedCommitment, date: string, start: number) => {
                const events = planned.get(start) ?? [...(buckets.get(start) ?? [])];
                events.push({ ...event, date });
                planned.set(start, events);
            };

            // Reserve dates the user picked before assigning automatic recommendations.
            for (const event of candidates) {
                const chosen = current.dates.get(event._id);
                const date = chosen && parseDate(chosen);
                if (chosen && typeof date === "number") reserve(event, chosen, sunday(date));
            }

            suggestions = [];
            for (const event of candidates) {
                let targetDate = current.dates.get(event._id);
                if (!targetDate) {
                    const sourceDate = parseDate(event.date)!;
                    const dayOffset = sourceDate - current.start;
                    let bestScore = Infinity;
                    let bestDistance = Infinity;

                    for (let start = firstSunday; start <= last; start += WEEK) {
                        if (start === current.start) continue;
                        const day = Math.min(Math.min(last, start + 6 * DAY),
                            Math.max(first, start + dayOffset));
                        const date = dateKey(day);
                        const events = planned.get(start) ?? buckets.get(start) ?? [];
                        const score = effectiveScore(start, [...events, { ...event, date }]);
                        const distance = Math.abs(day - sourceDate);
                        if (score < bestScore || (score === bestScore && distance < bestDistance)) {
                            bestScore = score;
                            bestDistance = distance;
                            targetDate = date;
                        }
                    }
                    if (targetDate) reserve(event, targetDate, sunday(parseDate(targetDate)!));
                }

                if (!targetDate) continue;
                const targetWeek = sunday(parseDate(targetDate)!);
                const targetEvents = buckets.get(targetWeek) ?? [];
                suggestions.push({
                    event,
                    date: targetDate,
                    targetWeek,
                    before: effectiveScore(targetWeek, targetEvents),
                    after: effectiveScore(targetWeek, [...targetEvents, { ...event, date: targetDate }]),
                });
            }

            const moving = new Set(suggestions.map(({ event }) => event._id));
            const after = effectiveScore(current.start, source.filter((event) => !moving.has(event._id)));
            intro.textContent = suggestions.length > 0
                ? `${current.label} is ${week_rating_map(before).toLowerCase()}. These flexible commitments could move:`
                : "No moves suggested for this week.";
            list.replaceChildren();

            for (const suggestion of suggestions) {
                const card = document.createElement("article");
                card.className = "suggestions-card";
                const name = document.createElement("h2");
                name.textContent = suggestion.event.name;
                const date = document.createElement("p");
                date.className = "suggestions-date";
                date.textContent = `${formatDay.format(parseDate(suggestion.event.date)!)}, now in ${current.label}`;

                const target = document.createElement("div");
                target.className = "suggestions-comparison";
                const targetLabel = document.createElement("span");
                targetLabel.textContent = `Move to ${weekLabel(suggestion.targetWeek, firstSunday, true)}`;
                const targetDate = document.createElement("small");
                targetDate.className = "suggestions-target-date";
                targetDate.textContent = formatDay.format(parseDate(suggestion.date)!);
                targetLabel.appendChild(targetDate);
                target.append(targetLabel, comparisonBar(suggestion.before, suggestion.after, false));

                const actions = document.createElement("div");
                actions.className = "suggestions-actions";
                const move = makeButton("Move", "suggestions-primary");
                move.addEventListener("click", () => void save([suggestion]));
                const keep = makeButton("Keep", "suggestions-keep");
                keep.addEventListener("click", () => {
                    current.dismissed.add(suggestion.event._id);
                    current.dates.delete(suggestion.event._id);
                    render();
                });
                actions.append(move, keep);

                const choose = makeButton("Pick another week", "suggestions-link");
                choose.addEventListener("click", () => pickDate(suggestion));
                card.append(name, date, target, actions, choose);
                list.appendChild(card);
            }

            const totalLabel = document.createElement("span");
            totalLabel.textContent = `${current.label} after changes`;
            total.replaceChildren(totalLabel, comparisonBar(before, after, true));
            apply.textContent = `Apply ${suggestions.length} ${suggestions.length === 1 ? "change" : "changes"}`;
            apply.disabled = loading || saving || suggestions.length === 0;
            content.hidden = false;
        };

        const save = async (moves: Suggestion[]) => {
            const current = selection;
            if (!current || saving || loading || moves.length === 0) return;
            saving = true;
            status.textContent = "";
            render();

            const savedDates = new Map<string, string>();
            try {
                for (const move of moves) {
                    const { _id, date } = move.event;
                    try {
                        const updated = await this.db.update(
                            { _id, date, movable: true },
                            { date: move.date },
                        );
                        if (updated.length === 0) throw new Error("Commitment changed before saving");
                        savedDates.set(_id, move.date);
                        current.dates.delete(_id);
                    } catch (error) {
                        console.error("Could not move commitment", error);
                        current.dates.set(_id, move.date);
                    }
                }

                ++revision;
                loading = false;
                commitments = commitments.map((event) => {
                    const date = savedDates.get(event._id);
                    return date ? { ...event, date } : event;
                });
                if (savedDates.size < moves.length) {
                    const failed = moves.length - savedDates.size;
                    status.textContent = `Couldn’t apply ${failed} of ${moves.length} changes. Try again.`;
                }
                if (savedDates.size > 0) {
                    try {
                        await dispatchPlannerUpdate(parent);
                    } catch (error) {
                        console.error("Could not refresh pages after moving commitments", error);
                        if (savedDates.size === moves.length) {
                            status.textContent = "Changes saved. Other pages could not refresh.";
                        }
                    }
                }
            } finally {
                saving = false;
                render();
            }
        };

        pickerForm.addEventListener("submit", (event) => {
            event.preventDefault();
            if (!selection || !pickFor) return;
            const date = parseDate(dateInput.value);
            if (date === undefined) {
                pickerStatus.textContent = "Enter a valid date.";
                return;
            }
            if (sunday(date) === selection.start) {
                pickerStatus.textContent = "Choose a date in another week.";
                return;
            }
            selection.dates.set(pickFor.event._id, dateInput.value);
            picker.close();
            render();
        });
        picker.querySelector(".suggestions-cancel")!.addEventListener("click", () => picker.close());
        apply.addEventListener("click", () => void save([...suggestions]));

        this.update = async (week?: WeekViewData) => {
            if (week) {
                const provided = week.startDate && parseDate(week.startDate);
                const firstEvent = week.events.map((event) => parseDate(event.date))
                    .find((date) => date !== undefined);
                const date = typeof provided === "number" ? provided : firstEvent;
                const start = date === undefined ? undefined : sunday(date);

                if (start !== selection?.start) {
                    if (picker.open) picker.close();
                    pickFor = undefined;
                    status.textContent = "";
                    selection = start === undefined ? undefined : {
                        start,
                        label: week.label ?? weekLabel(start, sunday(parseDate(semester_dates().start)!)),
                        dismissed: new Set(),
                        dates: new Map(),
                    };
                }
            }

            const request = ++revision;
            if (!selection) {
                loading = false;
                content.hidden = true;
                return;
            }

            loading = true;
            render();

            try {
                const [records, overrides] = await Promise.all([
                    this.db.find({}),
                    this.overridedb.find({}),
                ]);
                if (request === revision) {
                    commitments = records;
                    ratingsByStart = new Map(overrides.map(({ start_date, rating }) =>
                        [start_date, rating] as const,
                    ));
                }
            } catch (error) {
                if (request === revision) {
                    console.error("Could not load commitments", error);
                    status.textContent = "Couldn’t load commitments.";
                }
            } finally {
                if (request === revision) {
                    loading = false;
                    render();
                }
            }
        };

        this.element.appendChild(content);
    }
}
