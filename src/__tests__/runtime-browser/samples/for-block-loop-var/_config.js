import { defineTest } from "../../defineTest.js";

const items = Array.from({ length: 5 });

export default defineTest({
    props: {
        items,
    },

    html:
        items
            .map((_, i, { length }) => {
                const json = JSON.stringify({
                    index: i + 1,
                    index0: i,
                    revindex: length - i,
                    revindex0: length - i - 1,
                    first: i === 0,
                    last: i === length - 1,
                    length,
                    parent: null,
                });

                return `<p>${json}</p>`;
            })
            .join("") + "<!---->",
});
