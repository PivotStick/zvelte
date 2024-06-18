import { expect } from "vitest";
import { defineTest } from "../../defineTest.js";

export default defineTest({
    html: [
        `<div class="SHOUTY">YELL</div>`,
        `<svg viewBox="0 0 100 100" id="one"><text textLength="100">hellooooo</text></svg>`,
        `<svg viewBox="0 0 100 100" id="two"><text textLength="100">hellooooo</text></svg>`,
    ].join(" "),

    test({ target }) {
        /** @param {string} sel */
        const attr = (sel) => target.querySelector(sel)?.attributes[0].name;

        expect(attr("div")).toEqual("class");
        expect(attr("svg#one")).toEqual("viewBox");
        expect(attr("svg#one text")).toEqual("textLength");
        expect(attr("svg#two")).toEqual("viewBox");
        expect(attr("svg#two text")).toEqual("textLength");
    },
});
