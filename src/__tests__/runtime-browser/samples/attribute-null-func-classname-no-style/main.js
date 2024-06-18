/**
 * @param {import('@pivotass/zvelte').Args<{}>} args
 */
export default function init({ scope }) {
    scope.myHelper = (/** @type {any} */ testName) => {
        return testName;
    };
}
