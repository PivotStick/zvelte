/**
 * @param {import("@pivotass/zvelte").Args<{
 *  clickHandler?: () => any;
 *  number: number;
 * }>} args
 */
export default function init({ props, scope }) {
    props.clickHandler = undefined;
    props.number = 0;

    scope.updateHandler1 = () => {
        props.clickHandler = () => (props.number = 1);
    };

    scope.updateHandler2 = () => {
        props.clickHandler = () => (props.number = 2);
    };
}
