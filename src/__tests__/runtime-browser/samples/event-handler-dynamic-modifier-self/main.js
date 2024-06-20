/**
 * @param {import("@pivotass/zvelte").Args<{
 *  inner_clicked: boolean;
 *  f: () => void;
 * }>} args
 */
export default function init({ props }) {
    function handle_click() {
        props.inner_clicked = true;
    }

    props.f = handle_click;
}
