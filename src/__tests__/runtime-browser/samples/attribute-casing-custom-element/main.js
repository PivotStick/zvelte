export default function init() {
    class MyCustomElement extends HTMLElement {
        constructor() {
            super();
            this._obj = null;
        }

        /**
         * @param {any} obj
         */
        set camelCase(obj) {
            console.log("heyoooo");
            this._obj = obj;
            this.render();
        }

        connectedCallback() {
            this.render();
        }

        render() {
            this.innerHTML = "Hello " + this._obj.text + "!";
        }
    }

    if (!window.customElements.get("my-custom-element")) {
        window.customElements.define("my-custom-element", MyCustomElement);
    }
}
