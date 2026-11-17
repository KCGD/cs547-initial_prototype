import { createChild } from "../lib/dom/domUtil";
import type { OnClickFunction } from "../util";
import { Component } from "./component";

// style
import "../style/header.css";

type HeaderOpts = {
    initialText?: string;
    initialBack?: OnClickFunction;
}

export class Header extends Component {
    private title:HTMLElement;
    private back:HTMLElement;
    private clickHandler: (this: HTMLElement, ev: MouseEvent) => any | undefined;

    constructor(element:HTMLElement, opts?: HeaderOpts) {
        super(element);

        // create header element
        this.element.classList.add("app-header");
        this.title = createChild(element, "p");
        this.back = createChild(element, "button");
        this.back.setAttribute("aria-label", "Back");

        if(opts && opts.initialText) this.title.innerText = opts.initialText;
        if(opts && opts.initialBack) this.back.addEventListener('click', opts.initialBack);
    }

    public setTitle(title:string) {
        this.title.innerText = title;
    }

    public setBackAction(action:((this: HTMLElement, ev: MouseEvent) => any) | null) {
        if(action !== null) {
            this.back.addEventListener('click', action);
            this.back.style.display = "block";
            this.clickHandler = action;
        } else {
            this.back.style.display = "hidden";
            if(this.clickHandler) this.back.removeEventListener('click', this.clickHandler);
        }
    }
}