export const langFunctions = {
    /**
     * @param {string} id
     * @param {any[]} args
     * @returns {any}
     */
    resolve(id, args) {
        throw new Error(
            `You must implement the 'lang.resolve' callback. Please call 'setLangFunctions' to set it up.`,
        );
    },
    /**
     * @param {string} id
     * @param {any} json
     * @returns {void}
     */
    setup(id, json) {
        throw new Error(
            `You must implement the 'lang.setup' callback. Please call 'setLangFunctions' to set it up.`,
        );
    },
};

const defaults = {
    ...langFunctions,
};

/**
 * @param {Partial<typeof langFunctions>} functions
 */
export function setLangFunctions(functions) {
    langFunctions.resolve = functions.resolve ?? defaults.resolve;
    langFunctions.setup = functions.setup ?? defaults.setup;
}
