import { ensure_commitmentdb, type Commitment_t } from "../../lib/db/db";
import type { LsDb } from "../../lib/db/lsdb";
import { Component } from "../component";
import type { MainComponent } from "../main_component";

import "../../style/commitment_page.css";

type SavedCommitment = Commitment_t & { _id: string };

const examDate = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
});
const meetingDay = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: "UTC",
});
const repeatLabels: Record<Commitment_t["repeats"], string> = {
    once: "once",
    daily: "every day",
    weekly: "every week",
    "bi-weekly": "every two weeks",
};

function formatDetail(commitment: SavedCommitment): string {
    const date = new Date(`${commitment.date}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return commitment.date;
    if (commitment.type === "Exam") return examDate.format(date);

    const repeats = repeatLabels[commitment.repeats] ?? repeatLabels.once;
    return `${meetingDay.format(date)}, ${repeats}`;
}

export class CommitmentPage extends Component {
    private db: LsDb<Commitment_t> = ensure_commitmentdb();

    header = "My Commitments";

    constructor(element: HTMLElement, parent: MainComponent) {
        super(element);
        this.element.classList.add("commitments-page");

        const content = document.createElement("div");
        content.className = "commitments-content";
        content.innerHTML = `
            <section class="commitments-section">
                <h2>Exams</h2>
                <ul data-exams></ul>
            </section>
            <section class="commitments-section">
                <h2>Meetings and club tasks</h2>
                <ul data-meetings></ul>
            </section>
            <p class="commitments-hint">Tap a tag to switch between fixed and flexible</p>
            <p class="commitments-status" role="status"></p>
            <div class="commitments-footer">
                <button type="button">See my semester</button>
            </div>
        `;

        const exams = content.querySelector<HTMLUListElement>("[data-exams]")!;
        const meetings = content.querySelector<HTMLUListElement>("[data-meetings]")!;
        const status = content.querySelector<HTMLParagraphElement>(".commitments-status")!;
        const semesterButton = content.querySelector<HTMLButtonElement>(".commitments-footer button")!;

        let readVersion = 0;
        let saveInFlight: Promise<void> | undefined;

        const setTogglesDisabled = (disabled: boolean) => {
            content.querySelectorAll<HTMLButtonElement>(".commitments-toggle").forEach((button) => {
                button.disabled = disabled;
            });
        };

        const createRow = (commitment: SavedCommitment) => {
            const row = document.createElement("li");
            const details = document.createElement("div");
            const name = document.createElement("div");
            const date = document.createElement("div");
            const toggle = document.createElement("button");

            name.className = "commitments-name";
            name.textContent = commitment.name;
            date.className = "commitments-detail";
            date.textContent = formatDetail(commitment);
            details.append(name, date);

            toggle.type = "button";
            toggle.className = "commitments-toggle";
            toggle.setAttribute("aria-label", `Flexible: ${commitment.name}`);

            let movable = commitment.movable;
            const showMovable = () => {
                toggle.textContent = movable ? "flexible" : "fixed";
                toggle.setAttribute("aria-pressed", String(movable));
            };
            showMovable();

            toggle.addEventListener("click", () => {
                if (saveInFlight) return;

                ++readVersion;
                const nextMovable = !movable;
                status.textContent = "";
                setTogglesDisabled(true);

                saveInFlight = this.saveMovable(commitment._id, nextMovable)
                    .then(() => {
                        movable = nextMovable;
                        showMovable();
                    })
                    .catch((error: unknown) => {
                        console.error("Could not update commitment", error);
                        status.textContent = "Couldn’t change this commitment. Try again.";
                    })
                    .finally(() => {
                        saveInFlight = undefined;
                        setTogglesDisabled(false);
                    });
            });

            row.append(details, toggle);
            return row;
        };

        const renderGroup = (list: HTMLUListElement, commitments: SavedCommitment[], emptyText: string) => {
            if (commitments.length > 0) {
                list.replaceChildren(...commitments.map(createRow));
                return;
            }

            const empty = document.createElement("li");
            empty.className = "commitments-detail";
            empty.textContent = emptyText;
            list.replaceChildren(empty);
        };

        this.update = async () => {
            const version = ++readVersion;
            await saveInFlight;

            try {
                const commitments = (await this.db.find({})) as SavedCommitment[];
                if (version !== readVersion) return;

                const examEntries = commitments
                    .filter((commitment) => commitment.type === "Exam")
                    .sort((a, b) => a.date.localeCompare(b.date));
                const meetingEntries = commitments.filter((commitment) => commitment.type === "Meeting");

                renderGroup(exams, examEntries, "No exams yet.");
                renderGroup(meetings, meetingEntries, "No meetings or club tasks yet.");
            } catch (error) {
                if (version !== readVersion) return;
                console.error("Could not load commitments", error);
                status.textContent = "Couldn’t load commitments.";
            }
        };

        semesterButton.addEventListener("click", () => parent.setActive("schedule"));
        this.element.appendChild(content);
        void this.update();
    }

    private async saveMovable(id: string, movable: boolean): Promise<void> {
        const result: unknown = await this.db.update({ _id: id }, { movable });
        if (result === false || result === 0) {
            throw new Error("No commitment was updated");
        }
    }
}
