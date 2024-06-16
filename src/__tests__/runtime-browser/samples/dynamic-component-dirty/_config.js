import { expect, vi } from "vitest";
import { tick } from "../../../../internal/client/index.js";
import { defineTest } from "../../defineTest.js";

export default defineTest({
    get props() {
        return {
            fn: vi.fn(),
            current_path: /** @type {string=} */ (undefined),
        };
    },

    async test({ props, target }) {
        const button = target.querySelector("button");

        expect(props.fn.mock.calls).toEqual([["foo"]]);

        const event = new window.MouseEvent("click", { bubbles: true });
        button?.dispatchEvent(event);
        await tick();

        expect(props.fn).toHaveBeenCalledOnce();
        expect(props.fn.mock.calls).toEqual([["foo"]]);

        props.current_path = "bar";
        await tick();
        expect(props.fn.mock.calls).toEqual([["foo"], ["bar"]]);
    },
});
