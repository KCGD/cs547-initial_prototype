
export type createChildOpts = {
    classes?: string[];
}

export function createChild(parent:HTMLElement, tag:keyof HTMLElementTagNameMap, opts?:createChildOpts): HTMLElement {
    // create element
    const el = document.createElement(tag);

    // apply classes
    if(opts && opts.classes) el.classList.add(...opts.classes);

    parent.appendChild(el);
    return el;
}