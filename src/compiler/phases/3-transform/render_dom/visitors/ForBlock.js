import {
    EACH_INDEX_REACTIVE,
    EACH_IS_CONTROLLED,
    EACH_ITEM_IMMUTABLE,
    EACH_ITEM_REACTIVE,
} from "../../../constants.js";
import * as b from "../builders.js";

/**
 * @param {import('#ast').ForBlock} node
 * @param {import('../types.js').ComponentContext} context
 */
export function ForBlock(node, { state, visit, path }) {
    const meta = node.metadata;
    if (!meta.is_controlled) {
        state.template.push("<!>");
    }

    const call = b.call("$.each", state.node);

    // The runtime needs to know what kind of for block this is in order to optimize for the
    // key === item (we avoid extra allocations). In that case, the item doesn't need to be reactive.
    // We can guarantee this by knowing that in order for the item of the for block to change, they
    // would need to mutate the key/item directly in the array. Given that in runes mode we use ===
    // equality, we can apply a fast-path (as long as the index isn't reactive).
    let forType = EACH_ITEM_IMMUTABLE;
    let for_item_is_reactive = true;

    /**
     * @type {import('estree').Expression}
     */
    let key = b.id("$.index");

    if (
        node.key &&
        (node.key.type !== "Identifier" ||
            !node.index ||
            node.key.name !== node.index.name)
    ) {
        // forType |= EACH_KEYED;

        key = b.arrow([b.id("$$key"), b.id("$$index")], b.id("$$key"));

        forType |= EACH_INDEX_REACTIVE;

        if (
            node.key.type === "Identifier" &&
            node.context.type === "Identifier" &&
            node.context.name === node.key.name &&
            (forType & EACH_INDEX_REACTIVE) === 0
        ) {
            // Fast-path for when the key === item
            for_item_is_reactive = false;
        } else {
            forType |= EACH_ITEM_REACTIVE;
        }
    } else {
        forType |= EACH_ITEM_REACTIVE;
    }

    if (meta.is_controlled) {
        forType |= EACH_IS_CONTROLLED;
    }

    const nonPropSources = [...state.nonPropSources];
    const overrides = { ...state.overrides };

    overrides.loop = b.id("loop");

    if (node.index) {
        nonPropSources.push(node.index.name);
    }

    if (for_item_is_reactive) {
        overrides[node.context.name] = b.call("$.get", node.context);
    }

    // @ts-ignore
    const body = /** @type {import('estree').BlockStatement} */ (
        visit(node.body, {
            ...state,
            nonPropSources,
            overrides,
        })
    );

    const isInForBlock = path.some((node) => node.type === "ForBlock");

    const array = b.call(
        "$.iterable",
        /** @type {import("estree").Expression} */ (visit(node.expression)),
    );
    const unwrapIndex = b.id("$$index");
    const loopInit = [];

    if (isInForBlock) {
        state.init.push(b.var(b.id("parentLoop"), b.id("loop")));
    }

    loopInit.push(
        b.var(
            b.id("loop"),
            b.call(
                "$.loop",
                b.thunk(unwrapIndex),
                b.thunk(array),
                isInForBlock ? b.id("parentLoop") : b.literal(null),
            ),
        ),
    );

    if (node.index) {
        const expression = b.member(
            b.call(
                "Object.keys",
                /** @type {import("estree").Expression} */ (
                    visit(node.expression)
                ),
            ),
            unwrapIndex,
            true,
        );

        loopInit.push(
            b.var(node.index.name, b.call("$.derived", b.thunk(expression))),
        );
    }

    body.body.unshift(...loopInit);

    call.arguments.push(
        b.literal(forType),
        b.thunk(array),
        key,
        b.arrow(
            [b.id("$$anchor"), b.id(node.context.name), b.id("$$index")],
            body,
        ),
    );

    if (node.fallback) {
        // @ts-ignore
        const fallback = /** @type {import('estree').BlockStatement} */ (
            visit(node.fallback)
        );

        call.arguments.push(b.arrow([b.id("$$anchor")], fallback));
    }

    state.init.push(call);
}
