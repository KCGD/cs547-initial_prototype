import { ensure_commitmentdb, type Commitment_t } from "../../lib/db/db";
import type { LsDb } from "../../lib/db/lsdb";
import { Component } from "../component";
import type { MainComponent } from "../main_component";

import "../../style/add.css";

function nextWeekdayDate(weekday: number): string {
    const date = new Date();
    date.setDate(date.getDate() + (weekday - date.getDay() + 7) % 7);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

export class AddPage extends Component {
    private db: LsDb<Commitment_t> = ensure_commitmentdb();
    private pending: Commitment_t[] = [];

    header = "Add Commitment";

    constructor(element: HTMLElement, parent: MainComponent) {
        super(element);
        this.element.classList.add("add-commitment");

        const form = document.createElement("form");
        form.noValidate = true;
        form.innerHTML = `
            <fieldset class="add-fields">
                <fieldset class="add-options add-type">
                    <legend>Commitment type</legend>
                    <label>
                        <input type="radio" name="type" value="Exam" checked>
                        <span>Exam</span>
                    </label>
                    <label>
                        <input type="radio" name="type" value="Meeting">
                        <span>Meeting</span>
                    </label>
                </fieldset>

                <label class="add-field">
                    <span>Name</span>
                    <input type="text" name="name" required>
                </label>

                <label class="add-field" data-repeats hidden>
                    <span>Repeats</span>
                    <select name="repeats">
                        <option value="once" selected>Once</option>
                        <option value="daily">Every day</option>
                        <option value="weekly">Every week</option>
                        <option value="bi-weekly">Every two weeks</option>
                    </select>
                </label>

                <div class="add-date-time">
                    <label class="add-field" data-date>
                        <span>Date</span>
                        <input type="date" name="date" required>
                    </label>

                    <label class="add-field" data-day hidden>
                        <span>Day</span>
                        <select name="day" required>
                            <option value="" selected disabled>Select a day</option>
                            <option value="0">Sun</option>
                            <option value="1">Mon</option>
                            <option value="2">Tue</option>
                            <option value="3">Wed</option>
                            <option value="4">Thu</option>
                            <option value="5">Fri</option>
                            <option value="6">Sat</option>
                        </select>
                    </label>

                    <label class="add-field" data-time hidden>
                        <span>Time (optional)</span>
                        <input type="time" name="time" step="60">
                    </label>
                </div>

                <fieldset class="add-options">
                    <legend>Can this move?</legend>
                    <label>
                        <input type="radio" name="movable" value="false" checked>
                        <span>Fixed</span>
                    </label>
                    <label>
                        <input type="radio" name="movable" value="true">
                        <span>Flexible</span>
                    </label>
                </fieldset>

                <section class="add-queue">
                    <h2>Added so far</h2>
                    <ul></ul>
                </section>

                <div class="add-actions">
                    <button type="button">Save and add another</button>
                    <button type="submit">Save and add all commitments</button>
                </div>
            </fieldset>
            <p class="add-status" role="status"></p>
        `;

        const fields = form.querySelector<HTMLFieldSetElement>(".add-fields")!;
        const nameInput = form.querySelector<HTMLInputElement>('[name="name"]')!;
        const dateInput = form.querySelector<HTMLInputElement>('[name="date"]')!;
        const meetingRadio = form.querySelector<HTMLInputElement>('[name="type"][value="Meeting"]')!;
        const repeatsInput = form.querySelector<HTMLSelectElement>('[name="repeats"]')!;
        const dayInput = form.querySelector<HTMLSelectElement>('[name="day"]')!;
        const timeInput = form.querySelector<HTMLInputElement>('[name="time"]')!;
        const repeatsField = form.querySelector<HTMLElement>("[data-repeats]")!;
        const dateField = form.querySelector<HTMLElement>("[data-date]")!;
        const dayField = form.querySelector<HTMLElement>("[data-day]")!;
        const timeField = form.querySelector<HTMLElement>("[data-time]")!;
        const queue = form.querySelector<HTMLElement>(".add-queue")!;
        const list = form.querySelector<HTMLUListElement>(".add-queue > ul")!;
        const status = form.querySelector<HTMLParagraphElement>(".add-status")!;
        const addAnother = form.querySelector<HTMLButtonElement>('.add-actions button[type="button"]')!;
        const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;

        if (dateInput.type === "text") {
            dateInput.placeholder = "YYYY-MM-DD";
        }
        if (timeInput.type === "text") {
            timeInput.placeholder = "HH:mm";
        }

        const dateFormat = new Intl.DateTimeFormat("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            timeZone: "UTC",
        });

        const getRepeats = (): Commitment_t["repeats"] =>
            meetingRadio.checked
                ? (repeatsInput.value as Commitment_t["repeats"])
                : "once";

        const usesWeekday = () => {
            const repeats = getRepeats();
            return repeats === "weekly" || repeats === "bi-weekly";
        };

        const syncFields = () => {
            const meeting = meetingRadio.checked;
            const weekday = usesWeekday();

            form.classList.toggle("is-meeting", meeting);
            repeatsField.hidden = !meeting;
            dateField.hidden = weekday;
            dayField.hidden = !weekday;
            timeField.hidden = !meeting;

            addAnother.hidden = meeting;
            queue.hidden = meeting && this.pending.length === 0;
            submit.textContent = meeting && this.pending.length === 0
                ? "Save meeting"
                : "Save and add all commitments";
        };

        const renderPending = () => {
            list.replaceChildren();

            this.pending.forEach((commitment, index) => {
                const row = document.createElement("li");

                const label = document.createElement("span");
                const date = dateFormat.format(new Date(`${commitment.date}T00:00:00Z`));
                label.textContent = `${commitment.name}, ${date}`;
                label.title = label.textContent;

                const remove = document.createElement("button");
                remove.type = "button";
                remove.textContent = "×";
                remove.setAttribute("aria-label", `Remove ${label.textContent}`);
                remove.addEventListener("click", () => {
                    this.pending.splice(index, 1);
                    renderPending();
                    status.textContent = "";
                });

                row.append(label, remove);
                list.appendChild(row);
            });
            syncFields();
        };

        const queueDraft = () => {
            const name = nameInput.value.trim();
            nameInput.setCustomValidity(name ? "" : "Enter a commitment name.");
            if (!nameInput.reportValidity()) return false;

            const meeting = meetingRadio.checked;
            let date: string;

            if (usesWeekday()) {
                if (!dayInput.reportValidity()) return false;
                date = nextWeekdayDate(Number(dayInput.value));
            } else {
                date = dateInput.value.trim();
                const parsed = new Date(`${date}T00:00:00Z`);
                const validDate =
                    /^(?!0000)\d{4}-\d{2}-\d{2}$/.test(date) &&
                    !Number.isNaN(parsed.getTime()) &&
                    parsed.toISOString().slice(0, 10) === date;

                dateInput.setCustomValidity(validDate ? "" : "Enter a valid date.");
                if (!dateInput.reportValidity()) return false;
            }

            let time: string | null = null;
            if (meeting) {
                const enteredTime = timeInput.value.trim();
                const validTime =
                    !timeInput.validity.badInput &&
                    (enteredTime === "" || /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(enteredTime));

                timeInput.setCustomValidity(validTime ? "" : "Enter a valid time.");
                if (!timeInput.reportValidity()) return false;
                time = enteredTime || null;
            }

            const data = new FormData(form);
            this.pending.push({
                type: meeting ? "Meeting" : "Exam",
                name,
                date,
                movable: data.get("movable") === "true",
                repeats: getRepeats(),
                time,
            });

            nameInput.value = "";
            dateInput.value = "";
            dayInput.value = "";
            timeInput.value = "";
            renderPending();
            return true;
        };

        nameInput.addEventListener("input", () => nameInput.setCustomValidity(""));
        dateInput.addEventListener("input", () => dateInput.setCustomValidity(""));
        timeInput.addEventListener("input", () => timeInput.setCustomValidity(""));

        form.addEventListener("change", (event) => {
            const input = event.target;
            if (
                input === repeatsInput ||
                (input instanceof HTMLInputElement && input.name === "type")
            ) {
                syncFields();
            }
        });

        addAnother.addEventListener("click", () => {
            status.textContent = "";
            if (queueDraft()) nameInput.focus();
        });

        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            if (fields.disabled) return;

            status.textContent = "";
            const hasDraft =
                nameInput.value !== "" ||
                (usesWeekday()
                    ? dayInput.value !== ""
                    : dateInput.value !== "" || dateInput.validity.badInput) ||
                (meetingRadio.checked &&
                    (timeInput.value !== "" || timeInput.validity.badInput));

            if ((hasDraft || this.pending.length === 0) && !queueDraft()) return;

            const pendingAtStart = this.pending.length;
            fields.disabled = true;
            try {
                while (this.pending.length > 0) {
                    await this.db.insert(this.pending[0]);
                    this.pending.shift();
                    renderPending();
                }
                status.textContent = "All commitments saved.";
                parent.disbatchUpdate();
            } catch (error) {
                console.error("Could not save commitment", error);
                status.textContent = "Couldn’t save the remaining commitments. Try again.";
            } finally {
                fields.disabled = false;
            }

            if (this.pending.length < pendingAtStart) {
                try {
                    await parent.disbatchUpdate();
                } catch (error) {
                    console.error("Could not refresh pages after saving commitments", error);
                    if (this.pending.length === 0) {
                        status.textContent = "Commitments saved. Other pages could not refresh.";
                    }
                }
            }
        });

        syncFields();
        this.element.appendChild(form);
    }
}
