import { expect } from "vitest";
import { tick } from "../../../../internal/client/index.js";
import { defineTest } from "../../defineTest.js";

export default defineTest({
    get props() {
        return {
            active: "",
            autofocusFalse: false,
            autofocusTrue: true,
            spread: { autofocus: true },
        };
    },

    html: "",

    async test({ props, target }) {
        props.active = "default";
        await tick();
        expect(window.document.activeElement, "1").toStrictEqual(
            target.querySelector('input[title="default"]'),
        );

        props.active = "dynamic-false";
        await tick();
        expect(window.document.activeElement, "2").not.toStrictEqual(
            target.querySelector('input[title="dynamic-false"]'),
        );

        // when dynamically set autofocus to true, don't autofocus
        props.autofocusFalse = true;
        await tick();
        expect(window.document.activeElement, "3").not.toStrictEqual(
            target.querySelector('input[title="dynamic-false"]'),
        );

        props.active = "dynamic-true";
        await tick();
        expect(window.document.activeElement, "4").toStrictEqual(
            target.querySelector('input[title="dynamic-true"]'),
        );

        props.active = "spread";
        await tick();
        expect(window.document.activeElement, "5").toStrictEqual(
            target.querySelector('input[title="spread"]'),
        );

        props.active = "spread-override";
        await tick();
        expect(window.document.activeElement, "6").not.toStrictEqual(
            target.querySelector('input[title="spread-override"]'),
        );
    },
});
