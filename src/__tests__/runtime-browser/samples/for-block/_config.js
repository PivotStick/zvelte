import { tick } from "svelte";
import { defineTest } from "../../defineTest.js";
import { expect } from "vitest";

export default defineTest({
    get props() {
        return {
            animals: ["alpaca", "baboon", "capybara"],
        };
    },

    html: "<p>alpaca</p><p>baboon</p><p>capybara</p><!---->",

    async test({ props, target }) {
        props.animals = ["alpaca", "baboon", "caribou", "dogfish"];
        await tick();
        expect(target.innerHTML).toEqual(
            "<p>alpaca</p><p>baboon</p><p>caribou</p><p>dogfish</p><!---->"
        );

        props.animals = [];
        await tick();
        expect(target.innerHTML).toEqual("<!---->");
    },
});
