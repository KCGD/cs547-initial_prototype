import { createChild } from "../lib/dom/domUtil";
import type { OnClickFunction } from "../util";
import { Component } from "./component";

// style
import "../style/header.css";
import type { MainComponent } from "./main_component";

type HeaderOpts = {
    initialText?: string;
    initialBack?: OnClickFunction;
}

export class Header extends Component {
    private title:HTMLElement;
    private back:HTMLElement;
    private parent: MainComponent;
    private backrefs: Array<string> = new Array();
    header = "header";

    constructor(element:HTMLElement, opts?: HeaderOpts) {
        super(element);

        // create header element
        this.element.classList.add("app-header");
        this.title = createChild(element, "p");
        this.back = createChild(element, "button");
        this.back.setAttribute("aria-label", "Back");

        if(opts && opts.initialText) this.title.innerText = opts.initialText;
        this.back.addEventListener('click', () => {this.clickBack()});
    }

    public setTitle(title:string) {
        this.title.innerText = title;
    }

    public setParentReference(parent:MainComponent) {
        this.parent = parent;
    }
    public pushBackRef(ref: string) {
        if (this.backrefs[this.backrefs.length - 1] === ref) return;
    
        this.backrefs.push(ref);
        this.back.hidden = false;
    }
    
    public clickBack() {
        if (!this.parent) return;
    
        const ref = this.backrefs.pop();
        if (ref === undefined) return;
    
        this.back.hidden = this.backrefs.length === 0;
        this.parent.setActive(ref);
    }
}