import * as b from "./builders.js";

/**
 * @param {{
 *  endpoint: string;
 *  componentId: import('estree').Identifier;
 *  propId: import('estree').Identifier;
 *  pendingId?: import('estree').Identifier;
 *  errorId?: import('estree').Identifier;
 * }} args
 */
export function buildLoadWrapper({
    endpoint,
    componentId,
    pendingId,
    errorId,
    propId,
}) {
    /**
     * @type {import("estree").Statement}
     */
    let error = b.stmt(
        b.call(
            "$$props.__$$error",
            b.id("$$anchor"),
            b.thunk(b.id("promise.error")),
            b.thunk(b.id("promise.refresh")),
        ),
    );

    if (errorId) {
        error = b.stmt(
            b.call(
                errorId,
                b.id("$$anchor"),
                b.object([
                    b.prop(
                        "get",
                        b.id("error"),
                        b.function(
                            null,
                            [],
                            b.block([b.return(b.id("promise.error"))]),
                        ),
                    ),
                ]),
                b.id("promise.refresh"),
            ),
        );
    }

    return b.function_declaration(
        b.id("$$load"),
        [b.id("$$anchor"), b.id("$$props")],
        b.block([
            b.stmt(
                b.assignment(
                    "=",
                    b.id("$$props"),
                    b.call("$.proxy", b.id("$$props")),
                ),
            ),
            b.var(b.id("fragment"), b.call("$.comment")),
            b.var(b.id("node"), b.call("$.first_child", b.id("fragment"))),
            b.var(
                b.id("promise"),
                b.call(
                    "$.init_load",
                    b.id("$$fetch"),
                    b.member(b.id("$$props"), b.id("__$$payload")),
                    b.member(b.id("$$props"), b.id("__$$initialLoad")),
                    b.arrow(
                        [b.id("$$data")],
                        b.call(
                            "Object.assign",
                            b.id("$$props"),
                            b.id("$$data"),
                        ),
                    ),
                ),
            ),
            b.stmt(
                b.call(
                    "$.if",
                    b.id("node"),
                    b.thunk(b.unary("!", b.id("promise.loading"))),
                    // then
                    b.arrow(
                        [b.id("$$anchor")],
                        b.block([
                            b.if(
                                b.id("promise.error"),
                                b.block([error]),
                                b.block([
                                    b.stmt(
                                        b.call(
                                            componentId,
                                            b.id("$$anchor"),
                                            b.id("$$props"),
                                            b.id("promise.refresh"),
                                        ),
                                    ),
                                ]),
                            ),
                        ]),
                    ),
                    // await
                    pendingId
                        ? b.logical(
                              b.id("$$props.__$$pending"),
                              "??",
                              pendingId,
                          )
                        : b.id("$$props.__$$pending"),
                ),
            ),
            b.stmt(b.call("$.append", b.id("$$anchor"), b.id("fragment"))),
        ]),
    );
}
