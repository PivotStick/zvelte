import { tick } from "svelte";
import { defineTest } from "../../defineTest.js";
import { expect } from "vitest";

export default defineTest({
    get props() {
        return {
            value: 0,
            reactive: 0,
        };
    },

    html: "<div>0</div><!----> <div>0</div>",

    async test({ target, props }) {
        let [div1, div2] = target.querySelectorAll("div");

        props.value = 5;
        await tick();
        expect(target.innerHTML).toEqual("<div>5</div><!----> <div>0</div>");
        expect(div1).not.toStrictEqual(target.querySelectorAll("div")[0]);
        expect(div2).toStrictEqual(target.querySelectorAll("div")[1]);
        [div1, div2] = target.querySelectorAll("div");

        props.reactive = 10;
        await tick();
        expect(target.innerHTML).toEqual("<div>5</div><!----> <div>10</div>");
        expect(div1).toStrictEqual(target.querySelectorAll("div")[0]);
        expect(div2).toStrictEqual(target.querySelectorAll("div")[1]);
    },
});
