import { expect } from "vitest";
import { defineTest } from "../../defineTest.js";
import { tick } from "../../../../internal/client/index.js";

export default defineTest({
    get props() {
        return {
            columns: [{ size: "1fr" }, { size: "2fr" }, {}],
        };
    },

    html: `<div style="grid-template-columns: 1fr 2fr auto;">Some stuff</div>`,

    async test({ props, target }) {
        props.columns = [{}, {}, { size: "33px" }];
        await tick();
        expect(target.innerHTML).toEqual(
            `<div style="grid-template-columns: auto auto 33px;">Some stuff</div>`
        );

        props.columns = [];
        await tick();
        expect(target.innerHTML).toEqual(
            `<div style="grid-template-columns: ;">Some stuff</div>`
        );
    },
});
