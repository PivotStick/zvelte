/**
 * @param {import("@pivotass/zvelte").Args<{ count: number; }>} args
 */
export default function init({ props, scope }) {
    props.count = 0;

    scope.increment = () => {
        props.count++;
    };
}
