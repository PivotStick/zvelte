import { defineTest, ok } from "../../defineTest.js";
import { tick } from "../../../../internal/client/index.js";
import { expect } from "vitest";

export default defineTest({
    get props() {
        return {
            /** @type {any} */
            testName1: "test1",
            /** @type {any} */
            testName2: "test2",
        };
    },

    html: '<div class="test1test2 zvelte-x1o6ra"></div>',

    async test({ props, target }) {
        const div = target.querySelector("div");
        ok(div);
        expect(div.className).toEqual("test1test2 zvelte-x1o6ra");

        props.testName1 = null;
        props.testName2 = null;
        await tick();
        expect(div.className).toEqual("nullnull zvelte-x1o6ra");

        props.testName1 = null;
        props.testName2 = "test";
        await tick();
        expect(div.className).toEqual("nulltest zvelte-x1o6ra");

        props.testName1 = undefined;
        props.testName2 = "test";
        await tick();
        expect(div.className).toEqual("undefinedtest zvelte-x1o6ra");

        props.testName1 = undefined;
        props.testName2 = undefined;
        await tick();
        expect(div.className).toEqual("undefinedundefined zvelte-x1o6ra");

        props.testName1 = null;
        props.testName2 = 1;
        await tick();
        expect(div.className).toEqual("null1 zvelte-x1o6ra");

        props.testName1 = undefined;
        props.testName2 = 1;
        await tick();
        expect(div.className).toEqual("undefined1 zvelte-x1o6ra");

        props.testName1 = null;
        props.testName2 = 0;
        await tick();
        expect(div.className).toEqual("null0 zvelte-x1o6ra");

        props.testName1 = undefined;
        props.testName2 = 0;
        await tick();
        expect(div.className).toEqual("undefined0 zvelte-x1o6ra");
    },
});
