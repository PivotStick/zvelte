/**
 * @template T
 * @param {string} identifier
 * @param {Record<string, any>[]} scope
 * @param {T=} fallback
 */
export function findScopeFrom(identifier, scope, fallback) {
    if (!Array.isArray(scope))
        throw new Error(`Scope must be a stack of objects`);

    for (let i = scope.length - 1; i >= 0; i--) {
        if (typeof scope[i] === "object" && identifier in scope[i]) {
            return scope[i];
        }
    }

    return fallback;
}

/**
 * @param {string} identifier
 * @param {Record<string, any>[]} scope
 */
export function searchInScope(identifier, scope) {
    return findScopeFrom(identifier, scope)?.[identifier];
}

/**
 * @param {Record<string, any>[]} scope
 * @param {any} [newScope={}]
 */
export function pushNewScope(scope, newScope = {}) {
    return [...scope, newScope];
}

/**
 * @param {Node | undefined} target
 * @param {string} styleSheetId
 * @param {string} styles
 */
export async function append_styles(target, styleSheetId, styles) {
    const appendStylesTo = getRootForStyle(target);

    if (!appendStylesTo.getElementById(styleSheetId)) {
        const style = document.createElement("style");
        style.id = styleSheetId;
        style.textContent = styles;

        /** @type {Document} */ (
            // @ts-ignore
            appendStylesTo.head || appendStylesTo
        ).appendChild(style);
    }
}

/**
 * @param {Node=} node
 */
function getRootForStyle(node) {
    if (!node) return document;
    const root = node.getRootNode ? node.getRootNode() : node.ownerDocument;
    if (root && /** @type {ShadowRoot} */ (root).host) {
        return /** @type {ShadowRoot} */ (root);
    }
    return /** @type {Document} */ (node.ownerDocument);
}
