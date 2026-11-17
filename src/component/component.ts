export class Component {
    protected element: HTMLElement;

    constructor(element:HTMLElement) {
        this.element = element;
    }

    public getElement() {
        return this.element;
    }
}