import { expect, vi } from "vitest";
import { defineTest } from "../../defineTest.js";

export default defineTest({
    get props() {
        const fn = vi.fn();

        return {
            fn,
            getHandler: () => fn,
        };
    },

    html: "<button>click me</button>",

    test({ props, target }) {
        const button = target.querySelector("button");

        expect(props.fn).not.toHaveBeenCalled();
        button?.click();
        expect(props.fn).toHaveBeenCalledOnce();
        expect(props.fn.mock.calls[0]).toHaveLength(1);
        expect(props.fn.mock.calls[0][0]).toBeInstanceOf(MouseEvent);
    },
});
