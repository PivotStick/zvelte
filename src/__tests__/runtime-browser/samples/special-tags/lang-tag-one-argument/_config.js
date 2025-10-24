import { setLangFunctions } from "../../../../../internal/client/index.js";
import { defineTest } from "../../../defineTest.js";

export default defineTest({
    before() {
        /**
         * @type {Record<string, Record<string, any>>}
         */
        const langs = {};

        setLangFunctions({
            resolve(id, args) {
                return langs[id][args[0]];
            },
            setup(id, json) {
                langs[id] = json;
            },
        });
    },
    after() {
        setLangFunctions({});
    },
    html: "<!---->Hello World!",
});
