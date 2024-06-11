/**
 * @param {import("@pivotass/zvelte").Args<{
 *  counter: number;
 * }>} args
 */
export default function init({ props, scope }) {
    props.counter = 10;

    scope.increment = () => {
        props.counter++;
    };
}
