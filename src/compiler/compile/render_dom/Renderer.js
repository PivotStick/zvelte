import { walk } from "estree-walker";
import { Fragment } from "./wrappers/Fragment.js";
import { b, print, x } from "code-red";
import { Stylesheet } from "./Stylesheet.js";
import Block from "./Block.js";

export default class Renderer {
    /**
     * @type {Array<Block | import("estree").Node | import("estree").Node[]>}
     */
    blocks = [];
    /**
     * @type {Set<string>}
     */
    helpers = new Set();

    uuid = 0;

    /**
     * @type {import("estree").ImportDeclaration[]}
     */
    imports = [];

    /**
     * @type {string[]}
     */
    ctxVars = [];

    /**
     * @param {*} ast
     * @param {import('../../../../types/index.js').CompilerOptions} options
     * @param {*} meta
     */
    constructor(ast, options, meta) {
        this.options = options;

        this.fragmentBlock = this.createBlock({
            name: "createFragment",
        });

        if (meta.js) {
            /**
             * @type {import("estree").Identifier}
             */
            this.jsInstantiate = {
                type: "Identifier",
                name: "instantiate",
            };

            this.addImport(this.jsInstantiate, meta.js);
        }

        if (ast.css) {
            this.stylesheet = new Stylesheet(ast);
        }

        this.fragment = new Fragment(this, this.fragmentBlock, null, ast.html);
        this.fragment.render(this.fragmentBlock, null);
    }

    /**
     * @param {ConstructorParameters<typeof Block>[0]} options
     */
    createBlock(options) {
        options.name = this.getUniqueName(options.name);
        options.renderer = this;
        const block = new Block(options);
        this.addBlock(block);
        return block;
    }

    /**
     * @param {import("estree").Identifier} defaultName
     * @param {string} source
     */
    addImport(defaultName, source) {
        if (!this.imports.find((i) => i.source.value === source)) {
            this.imports.push({
                type: "ImportDeclaration",
                specifiers: [
                    {
                        type: "ImportDefaultSpecifier",
                        local: defaultName,
                    },
                ],
                source: {
                    type: "Literal",
                    value: source,
                    raw: `"${source}"`,
                },
            });
        }
    }

    /**
     * @param {Renderer["blocks"][number]} block
     */
    addBlock(block) {
        this.blocks.unshift(block);
    }

    render() {
        const componentName = {
            type: "Identifier",
            name: this.options.componentName ?? "Component",
        };

        const blocks = this.blocks.flatMap((block) => {
            if (block instanceof Block) {
                return block.render();
            }

            return block;
        });

        const ctxVars = this.ctxVars;

        walk(
            // @ts-ignore
            { type: "Program", body: blocks },
            {
                enter(node) {
                    if (
                        node.type === "MemberExpression" &&
                        node.property.type === "Identifier" &&
                        node.object.type === "MemberExpression" &&
                        node.object.property.type === "Identifier" &&
                        node.object.property.name === "props" &&
                        ctxVars.includes(node.property.name)
                    ) {
                        node.object.property.name = "vars";
                    }
                },
            },
        );

        const body = b`
            ${this.imports}

            ${
                this.stylesheet
                    ? x`function addCss(target) {
            @appendStyles(target, "${
                this.stylesheet.id
            }", \`${this.stylesheet.render()}\`)
          }`
                    : null
            }

            ${blocks}

            export default class ${componentName} extends @ZoneComponent {
                constructor(options) {
                    super();
                    
                    @init(
                      this,
                      options,
                      ${this.fragmentBlock.name},
                      ${
                          this.jsInstantiate
                              ? x`${this.jsInstantiate}`
                              : x`null`
                      },
                      ${this.stylesheet ? x`addCss` : x`null`},
                    );
                }
            }
        `;

        /**
         * @type {import('estree').Program}
         */
        const program = {
            type: "Program",
            // @ts-ignore
            body,
        };

        walk(program, {
            enter: (node) => {
                if (node.type === "Identifier") {
                    if (node.name.startsWith("@")) {
                        const name = node.name.slice(1);
                        this.helpers.add(name);
                        node.name = name;
                    }
                }
            },
        });

        if (this.helpers.size) {
            program.body.unshift({
                type: "ImportDeclaration",
                // @ts-ignore
                specifiers: [...this.helpers].map((identifier) => ({
                    type: "ImportSpecifier",
                    imported: x`${identifier}`,
                    local: x`${identifier}`,
                })),
                // @ts-ignore
                source: x`"${this.options.zonePath ?? "@zone/internal"}"`,
            });
        }

        return print(program);
    }

    /**
     * @param {string} name
     */
    getUniqueName(name) {
        return `${name}_${this.uuid++}`;
    }
}
