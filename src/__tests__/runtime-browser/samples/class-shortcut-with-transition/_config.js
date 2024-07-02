import { expect } from "vitest";
import { defineTest } from "../../defineTest.js";
import { tick } from "../../../../internal/client/index.js";

export default defineTest({
    get props() {
        return { open: false, border: true };
    },

    html: '<p class="zvelte-xf2vy">foo</p> <!---->',

    async test({ props, target, raf }) {
        props.open = true;
        await tick();

        raf.tick(100);
        expect(target.innerHTML, "first").toEqual(
            '<p class="zvelte-xf2vy">foo</p> <p class="red zvelte-xf2vy border">bar</p><!---->',
        );

        props.open = false;
        await tick();

        raf.tick(150);
        expect(target.innerHTML, "second").toEqual(
            '<p class="zvelte-xf2vy">foo</p> <!---->',
        );

        props.open = true;
        await tick();

        raf.tick(250);
        expect(target.innerHTML, "third").toEqual(
            '<p class="zvelte-xf2vy">foo</p> <p class="red zvelte-xf2vy border">bar</p><!---->',
        );
    },
});
