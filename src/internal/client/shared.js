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
