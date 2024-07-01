export let hydration = false;

export function setHydration(value = true) {
    hydration = value;
}

/**
 * @type {{ [x: string]: any; props: any; }}
 */
let context;

export function initProps(props) {
    return context;
}
