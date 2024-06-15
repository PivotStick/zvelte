import { effect } from "@pivotass/zvelte";

/**
 * @typedef {{
 *  content1: string;
 *  content2: string;
 *  content: string;
 *  show: boolean;
 * }} Props
 *
 * @param {import("@pivotass/zvelte").Args<Props>} args
 */
export default function init({ props, scope }) {
    scope.toggle = () => {
        props.show = !props.show;
    };

    effect(() => {
        props.content = props.show ? props.content1 : props.content2;
    });
}
