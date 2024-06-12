/**
 * @param {import("@pivotass/zvelte").Args<{ count: number }>} args
 */
export default function init({ scope, props }) {
    props.count = 0;

    scope.increment = () => {
        props.count++;
    };
}
