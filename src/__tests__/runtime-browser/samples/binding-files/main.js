import { onMount } from "@pivotass/zvelte";

/**
 * @param {import("@pivotass/zvelte").Args<{ files: undefined | FileList }>} args
 */
export default function init({ props, scope }) {
    props.files = undefined;

    onMount(() => {
        let list = new DataTransfer();
        let file = new File(["content"], "filename.jpg");
        list.items.add(file);
        props.files = list.files;
    });

    scope.reset = () => {
        props.files = new DataTransfer().files;
    };
}
