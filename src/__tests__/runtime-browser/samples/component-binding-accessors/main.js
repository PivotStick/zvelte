/**
 * @param {import("@pivotass/zvelte").Args<any, any>} args
 */
export default function init({ props, scope, els }) {
    props.value = "something";

    scope.reset = () => {
        els.c.value = "Reset";
    };
}
