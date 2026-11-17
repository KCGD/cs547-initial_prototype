import { Component } from "./component";

import "../style/maincomponent.css"
import type { HozMenu } from "./hozmenu";

export type PageRotation = Record<string, PageComponentConstructor>;

export class MainComponent extends Component {
    private page_components: Record<string, Component> = {};
    private global_menu_ref: HozMenu | undefined;

    constructor(element:HTMLElement, page_constructors: PageRotation) {
        super(element);
        this.element.classList.add("main-content");

        // iterage page names given as argument
        for(const page_name of Object.keys(page_constructors)) {
            const page = page_constructors[page_name];

            // create full-parent element
            const el = document.createElement("div");
            el.classList.add("fillparent");

            // set hidden
            el.hidden = true;

            // init class on element
            let init_component = createPageComponent(page, el, this);

            // attach to parent
            this.element.appendChild(el);

            // add to class pages
            this.page_components[page_name] = init_component
        }
    }

    public setMenuReference(menu:HozMenu) {
        this.global_menu_ref = menu;
    }

    public setActive(componentName: string) {
        if (typeof this.page_components[componentName] === "undefined") {
            throw new Error(
                `MainComponent > setActive: No registered component: ${componentName}`
            );
        }
    
        for (const [name, page] of Object.entries(this.page_components)) {
            page.getElement().hidden = name !== componentName;
        }

        if(this.global_menu_ref) {
            console.log(`Menu ref: set ${componentName}`);
            this.global_menu_ref.setActive(componentName);
        }
    }
}

export type PageComponentConstructor<T extends Component = Component> = new (
    element: HTMLElement,
    parent: MainComponent
) => T;

export function createPageComponent<T extends Component>(
    Ctor: PageComponentConstructor<T>,
    element: HTMLElement,
    parent: MainComponent
): T {
    return new Ctor(element, parent);
}