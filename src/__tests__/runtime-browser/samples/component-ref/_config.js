import { expect } from "vitest";
import { defineTest } from "../../defineTest.js";

export default defineTest({
    get props() {
        /**
         * @type {any}
         */
        let widget;

        return {
            get widget() {
                return widget;
            },
            set widget(v) {
                widget = v;
            },
        };
    },

    html: "<div><p>i am a widget</p><!----></div>",

    test({ props }) {
        expect(props.widget.isWidget).toBe(true);
    },
});
