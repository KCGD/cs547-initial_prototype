import type { OnClickFunction } from "../util";
import { Component } from "./component";

import "../style/hozmenu.css";

const CLASS_SELECTED = "hozmenu-selected";

export type HozMenuOptions = Array<{
    name: string;
    icon: string;
    text: string;
    selected: boolean;
    function: OnClickFunction;
}>

export class HozMenu extends Component {
    private menu: HozMenuOptions;
    private elements: Record<string, HTMLElement> = {};

    constructor(element:HTMLElement, menu: HozMenuOptions) {
        super(element);
        this.element.classList.add("hozmenu");
        this.menu = menu;

        for(const item of menu) {
            // create hozmenu item div
            const el = document.createElement("div");
            
            // create icon element
            const icon = document.createElement("img");
            icon.src = item.icon;
            icon.alt = "";
            el.appendChild(icon);

            // create text element
            const text = document.createElement("p");
            text.innerText = item.text;
            el.appendChild(text);

            // if element selected, add class
            el.classList.toggle(CLASS_SELECTED, item.selected);

            // assign element click function
            // same as "setactive" but with function call
            el.addEventListener('click', (ev) => {
                for(const n of this.menu) 
                    if (n.name !== item.name) this.elements[n.name].classList.remove(CLASS_SELECTED);

                this.elements[item.name].classList.add(CLASS_SELECTED);
                item.function.call(el, ev);
            });

            // attach to parent
            this.element.appendChild(el);
            this.elements[item.name] = el;
        }
    }

    /**
     * Cosmetic "set active" without function call
     */
    public setActive(name:string) {
        for(const n of this.menu) {
            if (n.name !== name) this.elements[n.name].classList.remove(CLASS_SELECTED);
        }
        this.elements[name].classList.add(CLASS_SELECTED);
    }
}