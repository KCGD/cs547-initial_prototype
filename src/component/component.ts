export abstract class Component {
    protected element: HTMLElement;
    public update: Function = ()=>{};
    abstract readonly header:string;

    constructor(element:HTMLElement) {
        this.element = element;
    }

    public getElement() {
        return this.element;
    }
}