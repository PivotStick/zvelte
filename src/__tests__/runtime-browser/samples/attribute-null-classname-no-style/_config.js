import { expect } from "vitest";
import { defineTest, ok } from "../../defineTest.js";
import { tick } from "../../../../internal/client/index.js";

export default defineTest({
    get props() {
        return {
            /** @type {any} */
            testName: "testClassName",
        };
    },

    html: '<div class="testClassName"></div>',

    async test({ props, target }) {
        const div = target.querySelector("div");
        ok(div);
        expect(div.className).toEqual("testClassName");

        props.testName = null;
        await tick();
        expect(div.className).toEqual("");

        props.testName = undefined;
        await tick();
        expect(div.className).toEqual("");

        props.testName = undefined + "";
        await tick();
        expect(div.className).toEqual("undefined");

        props.testName = null + "";
        await tick();
        expect(div.className).toEqual("null");

        props.testName = 1;
        await tick();
        expect(div.className).toEqual("1");

        props.testName = 0;
        await tick();
        expect(div.className).toEqual("0");

        props.testName = false;
        await tick();
        expect(div.className).toEqual("false");

        props.testName = true;
        await tick();
        expect(div.className).toEqual("true");

        props.testName = {};
        await tick();
        expect(div.className).toEqual("[object Object]");

        props.testName = "";
        await tick();
        expect(div.className).toEqual("");
    },
});
