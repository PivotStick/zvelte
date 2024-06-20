/**
 * @param {import("@pivotass/zvelte").Args<{
 *  inner_clicked: boolean;
 * }>} args
 */
export default function init({ props, scope }) {
    props.inner_clicked = false;

    scope.handle_click = () => {
        props.inner_clicked = true;
    };
}
