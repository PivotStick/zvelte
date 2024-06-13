import { expect } from "vitest";
import { defineTest } from "../../defineTest.js";
import { tick } from "../../../../internal/client/index.js";

export default defineTest({
    get props() {
        return {
            canvas: undefined,
        };
    },

    html: "<canvas></canvas>",

    async test({ props, target }) {
        const canvas = target.querySelector("canvas");
        expect(canvas).toStrictEqual(props.canvas);
    },
});
