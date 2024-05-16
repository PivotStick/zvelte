import { print } from "esrap";
import * as b from "./builders.js";
import { isVoid } from "../../../shared/utils/names.js";

const $$anchor = b.id("$$anchor");
const $$props = b.id("$$props");

/**
 * @type {import("../types.js").Transformer}
 */
export function renderDom(ast, options, meta) {
    const fn = b.fn(options.filename.replace(/\..*$/, ""));

    fn.params.push($$anchor, $$props);

    /**
     * @type {import("estree").VariableDeclaration[]}
     */
    const rootTemplates = [];

    renderBlock(fn.body, ast, createCtx({ rootTemplates }));

    return print({
        type: "Program",
        sourceType: "module",
        body: [
            {
                type: "ImportDeclaration",
                source: {
                    type: "Literal",
                    value: "@pivotass/zvelte/internal/client",
                },
                specifiers: [
                    {
                        type: "ImportNamespaceSpecifier",
                        local: b.id("$"),
                    },
                ],
            },
            ...rootTemplates,
            {
                type: "ExportDefaultDeclaration",
                declaration: fn,
            },
        ],
    });
}

/**
 * @typedef {ReturnType<typeof createCtx>} Ctx
 */

/**
 * @param {{
 *  rootTemplates: import("estree").VariableDeclaration[]
 * }} args
 */
function createCtx({ rootTemplates }) {
    /** @type {import("estree").TemplateElement[]} */
    const templateStack = [];
    /** @type {import("estree").BlockStatement[]} */
    const blockStack = [];

    /**
     * @type {import("estree").Identifier[][]}
     */
    const scopeVars = [[]];
    /**
     * @type {import("estree").Identifier[]}
     */
    const declaredVars = [];

    function block() {
        return blockStack[blockStack.length - 1];
    }

    /**
     * @param {import("estree").Identifier | import("estree").MemberExpression | import("estree").ClassExpression | import("estree").SimpleLiteral | import("estree").RegExpLiteral | import("estree").BigIntLiteral | import("estree").ArrayExpression | import("estree").ArrowFunctionExpression | import("estree").AssignmentExpression | import("estree").AwaitExpression | import("estree").BinaryExpression | import("estree").SimpleCallExpression | import("estree").NewExpression | import("estree").ChainExpression | import("estree").ConditionalExpression | import("estree").FunctionExpression | import("estree").ImportExpression | import("estree").LogicalExpression | import("estree").MetaProperty | import("estree").ObjectExpression | import("estree").SequenceExpression | import("estree").TaggedTemplateExpression | import("estree").TemplateLiteral | import("estree").ThisExpression | import("estree").UnaryExpression | import("estree").UpdateExpression | import("estree").YieldExpression} expression
     */
    function stmt(expression) {
        block().body.push(b.stmt(expression));
    }

    return {
        scope: {
            get current() {
                return scopeVars[scopeVars.length - 1];
            },
            get currentVar() {
                let scope = this.current;
                if (scope.length === 0) {
                    scope = scopeVars[scopeVars.length - 2];
                }
                return scope[scope.length - 1];
            },
            get firstChild() {
                const scope = this.current;
                return scope.length === 0;
            },
            pop() {
                scopeVars.pop();
            },
            push() {
                scopeVars.push([]);
            },
            /**
             * @param {import("estree").Identifier} name
             * @param {import("estree").Expression=} init
             */
            declare(name, init) {
                const scope = this.current;
                let suffix = "";

                for (let i = declaredVars.length - 1; i >= 0; i--) {
                    const [id, count] = declaredVars[i].name.split("_");
                    if (id === name.name) {
                        suffix = count ? `_${Number(count) + 1}` : "_1";
                        break;
                    }
                }

                name.name += suffix;

                scope.push(name);
                declaredVars.push(name);
                block().body.push(b.let(name, init));
            },
        },
        get block() {
            return block();
        },
        append: stmt,
        template: {
            get id() {
                const declaration =
                    rootTemplates[rootTemplates.length - 1].declarations[0];
                return /** @type {import("estree").Identifier} */ (
                    declaration.id
                );
            },
            /**
             * @param {import("estree").BlockStatement} block
             */
            push(block) {
                let suffix = "";
                if (rootTemplates.length) {
                    suffix = `_${rootTemplates.length}`;
                }

                const templateLiteral = b.templateLiteral();
                const rootTemplate = b.rootTemplate(
                    `root${suffix}`,
                    templateLiteral,
                    true,
                );
                const template = b.templateElement();

                templateLiteral.quasis.push(template);

                blockStack.push(block);
                rootTemplates.push(rootTemplate);
                templateStack.push(template);
            },

            pop() {
                blockStack.pop();
                rootTemplates.pop();
                templateStack.pop();
            },

            /**
             * @param {string} text
             */
            append(text) {
                const current = templateStack[templateStack.length - 1];
                current.value.raw += text;
            },
        },
    };
}

/**
 * @param {import("estree").BlockStatement} block
 * @param {Exclude<import("#ast").Any, import("#ast").Expression>} node
 * @param {Ctx} ctx
 */
function renderBlock(block, node, ctx) {
    ctx.template.push(block);
    ctx.append(b.internal("push", [$$props, b.literal(true)]));
    handle(node, ctx);
    ctx.append(b.internal("pop"));
}

/**
 * @param {Exclude<import("#ast").Any, import("#ast").Expression>} node
 * @param {Ctx} ctx
 */
function handle(node, ctx) {
    switch (node.type) {
        case "Root": {
            const fragment = b.id("fragment");
            ctx.scope.declare(fragment, b.call(ctx.template.id));
            handle(node.fragment, ctx);
            ctx.append(b.internal("append", [$$anchor, fragment]));
            break;
        }

        case "Fragment":
            ctx.scope.push();
            node.nodes.forEach((fragment) => handle(fragment, ctx));
            ctx.scope.pop();
            break;

        case "Text": {
            const textVar = b.id(`text`);

            ctx.scope.declare(
                textVar,
                b.internal(ctx.scope.firstChild ? "first_child" : "sibling", [
                    ctx.scope.currentVar,
                    b.literal(1),
                ]),
            );

            ctx.template.append(node.data);
            break;
        }

        case "Element": {
            const elVar = b.id(`${node.name}`);
            ctx.scope.declare(
                elVar,
                b.internal(ctx.scope.firstChild ? "first_child" : "sibling", [
                    ctx.scope.currentVar,
                ]),
            );
            ctx.template.append(`<${node.name}`);
            if (isVoid(node.name)) {
                ctx.template.append(`/>`);
            } else {
                ctx.template.append(`>`);
                handle(node.fragment, ctx);
                ctx.template.append(`</${node.name}>`);
            }
            break;
        }

        default:
            throw new Error(`"${node.type}" not handled in js render`);
    }
}

/**
 * @param {import("#ast").Expression} node
 */
function expression(node) {
    switch (node.type) {
        default:
            throw new Error(
                `"${node.type}" expression not handled in js render`,
            );
    }
}
