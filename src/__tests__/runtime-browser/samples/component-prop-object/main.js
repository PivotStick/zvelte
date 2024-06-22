/**
 * @param {import("@pivotass/zvelte").Args<any>} args
 */
export default function init({ scope, props }) {
    props.x ??= { y: 0 };

    scope.increment = () => {
        props.x.y++;
    };
}
