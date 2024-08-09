import { expect } from "vitest";
import { defineTest, ok } from "../../defineTest.js";
import { tick } from "../../../../internal/client/index.js";

export default defineTest({
    get props() {
        return {
            testName: /** @type {any} */ (undefined),
        };
    },

    html: '<div class=" zvelte-x1o6ra"></div>',

    async test({ props, target }) {
        const div = target.querySelector("div");
        ok(div);

        props.testName = null;
        await tick();
        expect(div.className).toEqual(" zvelte-x1o6ra");

        props.testName = undefined;
        await tick();
        expect(div.className).toEqual(" zvelte-x1o6ra");

        props.testName = undefined + "";
        await tick();
        expect(div.className).toEqual("undefined zvelte-x1o6ra");

        props.testName = null + "";
        await tick();
        expect(div.className).toEqual("null zvelte-x1o6ra");

        props.testName = 1;
        await tick();
        expect(div.className).toEqual("1 zvelte-x1o6ra");

        props.testName = 0;
        await tick();
        expect(div.className).toEqual("0 zvelte-x1o6ra");

        props.testName = false;
        await tick();
        expect(div.className).toEqual("false zvelte-x1o6ra");

        props.testName = true;
        await tick();
        expect(div.className).toEqual("true zvelte-x1o6ra");

        props.testName = {};
        await tick();
        expect(div.className).toEqual("[object Object] zvelte-x1o6ra");

        props.testName = "";
        await tick();
        expect(div.className).toEqual(" zvelte-x1o6ra");

        props.testName = "testClassName";
        await tick();
        expect(div.className).toEqual("testClassName zvelte-x1o6ra");
    },
});
