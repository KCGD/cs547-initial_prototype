import { Component } from "./component";

import "../style/maincomponent.css"
import type { HozMenu } from "./hozmenu";
import type { Header } from "./header";

export type PageRotation = Record<string, PageComponentConstructor>;

export class MainComponent extends Component {
    private page_components: Record<string, Component> = {};
    private global_menu_ref: HozMenu | undefined;
    private global_header_ref: Header | undefined;
    private active_page_name: string | null = null;
    header = "Main";

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

    public setHeaderReference(header:Header) {
        this.global_header_ref = header;
        header.setParentReference(this);
    }

    public setActive(componentName: string, ...args:any) {
        let thispage = this.page_components[componentName];
        if (typeof thispage === "undefined") {
            throw new Error(
                `MainComponent > setActive: No registered component: ${componentName}`
            );
        }

        // before switching, add current page ref to header backlog
        if(this.active_page_name && this.global_header_ref) 
            this.global_header_ref.pushBackRef(this.active_page_name);

        // disbatch update to component before rendering it
        this.page_components[componentName].update(...args);
    
        // hide all non-selected page components
        for (const [name, page] of Object.entries(this.page_components)) {
            page.getElement().hidden = name !== componentName;
        }

        // update global menu ref if it has an option matching the component name
        if(this.global_menu_ref) 
            if(this.global_menu_ref.hasOption(componentName)) 
                this.global_menu_ref.setActive(componentName);

        // update header ref to page title
        if(this.global_header_ref)
            this.global_header_ref.setTitle(thispage.header);

        // set current name
        this.active_page_name = componentName;
    }

    /**
     * Updates all registered sub components and pages
     */
    public disbatchUpdate() {
        for(const k of Object.keys(this.page_components)) {
            this.page_components[k].update();
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