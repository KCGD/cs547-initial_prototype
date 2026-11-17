import "./style/main.css"
import "./style/header.css"

import { createChild } from "./lib/dom/domUtil";
import { Header } from "./component/header";
import { HozMenu, type HozMenuOptions } from "./component/hozmenu";
import { ensure_commitmentdb } from "./lib/db/db";
import { MainComponent } from "./component/main_component";
import { SchedulePage } from "./component/pages/schedule_page";
import { CommitmentPage } from "./component/pages/commitments_page";
import { AddPage } from "./component/pages/add_page";
import { WeekViewPage } from "./component/pages/week_view";

async function Main() {
	const db = ensure_commitmentdb();

	const APP = document.querySelector<HTMLDivElement>('#app');
	if(!APP) {
		alert('NO APP');
		return;
	}

	// init app
	const HEADER = new Header(createChild(APP, "header"), {"initialText": "My Semester", "initialBack": () => {alert("test")}});

	// create main component and attach pages
	const MAIN = new MainComponent(createChild(APP, "main"), {
		"schedule": SchedulePage,
		"commitments": CommitmentPage,
		"add": AddPage,

		// non-menu pages
		"weekview": WeekViewPage
	});

	// create footer horizontal menu
	// "name" should match key of page in MAIN constructor
	const FooterMenu:HozMenuOptions = [
		{"name": "schedule", 	"icon": "/public/calendar_button.png", 		"text": "Schedule", 	"selected": true, 	"function": () => {MAIN.setActive("schedule");}},
		{"name": "commitments", "icon": "/public/commitments_button.png", 	"text": "Commitments", 	"selected": false, 	"function": () => {MAIN.setActive("commitments")}},
		{"name": "add", 		"icon": "/public/add_button.png", 			"text": "Add", 			"selected": false, 	"function": () => {MAIN.setActive("add")}}
	];
	const FOOTER = new HozMenu(createChild(APP, "footer"), FooterMenu);

	// add footer menu ref to main component so it updates on non-direct context switch
	MAIN.setMenuReference(FOOTER);
	MAIN.setHeaderReference(HEADER);

	MAIN.setActive("schedule");
}

Main();