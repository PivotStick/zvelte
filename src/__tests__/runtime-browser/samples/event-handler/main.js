/**
 * @param {import("@pivotass/zvelte").Args<{ visible: boolean; }>} args
 */
export default function init({ scope, props }) {
    props.visible = false;

    scope.toggle = () => {
        props.visible = !props.visible;
    };
}
