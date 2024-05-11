/**
 * @type {Map<any, any>}
 */
const components = new Map();

export function getComponentByKey(key) {
    return components.get(key);
}

/**
 * @param {any} key
 * @param {any} component
 */
export function registerComponent(key, component) {
    components.set(key, component);
}
