import { expect } from "vitest";
import { tick } from "../../../../internal/client/index.js";
import { defineTest } from "../../defineTest.js";

export default defineTest({
    get props() {
        return {
            raw: "<span><em>raw html!!!\\o/</span></em>",
        };
    },

    html: "before<span><em>raw html!!!\\o/</em></span><!---->after",

    async test({ props, target }) {
        props.raw = "";
        await tick();
        expect(target.innerHTML).toEqual("before<!---->after");

        props.raw = "how about <strong>unclosed elements?";
        await tick();
        expect(target.innerHTML).toEqual(
            "beforehow about <strong>unclosed elements?</strong><!---->after"
        );
    },
});
