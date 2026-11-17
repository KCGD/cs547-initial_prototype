import "./style/main.css"
import "./style/header.css"

import { createChild } from "./lib/dom/domUtil";
import { Header } from "./component/header";
import { HozMenu, type HozMenuOptions } from "./component/hozmenu";
import { ensure_commitmentdb } from "./lib/db/db";
import { MainComponent } from "./component/main_component";
import { SchedulePage } from "./component/pages/schedule_page";

async function Main() {
	const db = ensure_commitmentdb();

	const APP = document.querySelector<HTMLDivElement>('#app');
	if(!APP) {
		alert('NO APP');
		return;
	}

	// create menu
	const FooterMenu:HozMenuOptions = [
		{"name": "schedule", 	"icon": "/public/calendar_button.png", 		"text": "Schedule", 	"selected": true, 	"function": () => {}},
		{"name": "commitments", "icon": "/public/commitments_button.png", 	"text": "Commitments", 	"selected": false, 	"function": () => {}},
		{"name": "add", 		"icon": "/public/add_button.png", 			"text": "Add", 			"selected": false, 	"function": () => {}}
	]

	// init app
	const header = new Header(createChild(APP, "header"), {"initialText": "My Semester", "initialBack": () => {alert("test")}});

	// create main component and attach pages
	const MAIN = new MainComponent(createChild(APP, "main"), {
		"schedule": SchedulePage
	});
	MAIN.setActive("schedule");

	// create footer horizontal menu
	const FOOTER = new HozMenu(createChild(APP, "footer"), FooterMenu);

	console.log(db);
}

Main();