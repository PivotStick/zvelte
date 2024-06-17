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
    return b.function_declaration(
        b.id("$$load"),
        [b.id("$$anchor"), b.id("$$props")],
        b.block([
            b.stmt(
                b.assignment(
                    "=",
                    b.id("$$props"),
                    b.call("$.proxy", b.id("$$props"))
                )
            ),
            b.var(b.id("fragment"), b.call("$.comment")),
            b.var(b.id("node"), b.call("$.first_child", b.id("fragment"))),
            b.var(
                b.id("promise"),
                b.call(
                    "$.load",
                    b.literal(endpoint),
                    b.member(b.id("$$props"), propId),
                    b.arrow(
                        [b.id("$$data")],
                        b.assignment(
                            "=",
                            b.member(b.id("$$props"), propId),
                            b.id("$$data")
                        )
                    )
                )
            ),
            b.stmt(
                b.call(
                    "$.await",
                    b.id("node"),
                    b.id("promise.get"),
                    // await
                    pendingId ?? b.literal(null),
                    // then
                    b.arrow(
                        [b.id("$$anchor"), b.id("$$data")],
                        b.block([
                            b.var("fragment", b.call("$.comment")),
                            b.var(
                                "node",
                                b.call("$.first_child", b.id("fragment"))
                            ),
                            b.stmt(
                                b.assignment(
                                    "=",
                                    b.member(b.id("$$props"), propId),
                                    b.id("$$data")
                                )
                            ),
                            b.stmt(
                                b.call(
                                    componentId,
                                    b.id("node"),
                                    b.id("$$props"),
                                    b.id("promise.refresh")
                                )
                            ),
                            b.stmt(
                                b.call(
                                    "$.append",
                                    b.id("$$anchor"),
                                    b.id("fragment")
                                )
                            ),
                        ])
                    ),
                    // catch
                    errorId ?? b.literal(null)
                )
            ),
            b.stmt(b.call("$.append", b.id("$$anchor"), b.id("fragment"))),
        ])
    );
}
