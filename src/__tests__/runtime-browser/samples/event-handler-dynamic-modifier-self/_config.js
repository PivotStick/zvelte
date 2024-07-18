import { expect, vi } from "vitest";
import { tick } from "../../../../internal/client/index.js";
import { defineTest, ok } from "../../defineTest.js";

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
            f: /** @type {any} */ (undefined),
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

        const fn = (props.f = vi.fn());
        await tick();

        backdrop.dispatchEvent(event);
        expect(fn).toHaveBeenCalledOnce();
    },
});
