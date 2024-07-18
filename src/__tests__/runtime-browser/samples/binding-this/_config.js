import { expect } from "vitest";
import { defineTest } from "../../defineTest.js";

export default defineTest({
    get props() {
        /**
         * @type {any}
         */
        let canvas = undefined;
        return {
            get canvas() {
                return canvas;
            },
            set canvas(value) {
                canvas = value;
            },
        };
    },

    html: "<canvas></canvas>",

    async test({ props, target }) {
        const canvas = target.querySelector("canvas");
        expect(canvas).toStrictEqual(props.canvas);
    },
});
