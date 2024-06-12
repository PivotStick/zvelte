import { effect } from "../../../../internal/client/index.js";

/**
 * @param {import("@pivotass/zvelte").Args<{ count: number; doubled: number }>} args
 */
export default function init({ scope, props }) {
    props.count = 0;

    effect(() => {
        props.doubled = props.count * 2;
    });

    scope.increment = () => {
        props.count++;
    };
}
