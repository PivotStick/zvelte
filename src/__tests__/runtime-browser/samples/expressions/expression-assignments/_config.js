import { expect } from "vitest";
import { tick } from "../../../../../internal/client/index.js";
import { defineTest } from "../../../defineTest.js";

export default defineTest({
    get props() {
        return {
            count: 0,
        };
    },

    html: [
        "<button>0</button>",
        "<button>decrement</button>",
        "<button>add 2</button>",
        "<button>sub 2</button>",
        "<button>set</button>",
    ].join(" "),

    async test({ props, target }) {
        /**
         * @type {HTMLButtonElement[]}
         */
        // @ts-ignore
        const [increment, decrement, add2, sub2, set] = target.children;

        increment.click();
        await tick();
        expect(increment.innerHTML).toEqual("1");

        decrement.click();
        await tick();
        expect(increment.innerHTML).toEqual("0");

        add2.click();
        await tick();
        expect(increment.innerHTML).toEqual("2");

        sub2.click();
        await tick();
        expect(increment.innerHTML).toEqual("0");

        set.click();
        await tick();
        expect(increment.innerHTML).toEqual("10");
    },
});
