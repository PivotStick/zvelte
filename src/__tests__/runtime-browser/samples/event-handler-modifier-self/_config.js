import { expect } from "vitest";
import { defineTest, ok } from "../../defineTest.js";
import { tick } from "../../../../internal/client/index.js";

export default defineTest({
    get props() {
        let inner_clicked = false;
        return {
            get inner_clicked() {
                return inner_clicked;
            },
            set inner_clicked(v) {
                inner_clicked = v;
            },
        };
    },

    html: `<div><button>click me</button></div>`,

    async test({ props, target }) {
        expect(props.inner_clicked).toEqual(false);

        const button = target.querySelector("button");
        ok(button);

        const backdrop = target.querySelector("div");
        ok(backdrop);

        const event = new window.MouseEvent("click", { bubbles: true });
        button.dispatchEvent(event);
        await tick();
        expect(props.inner_clicked).toEqual(false);

        backdrop.dispatchEvent(event);
        await tick();
        expect(props.inner_clicked).toEqual(true);
    },
});
