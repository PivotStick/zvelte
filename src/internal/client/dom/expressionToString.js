import { walk } from "zimmerframe";

/**
 * @param {import("#ast").Expression} expression
 */
export function expressionToString(expression) {
    let string = "";

    walk(
        expression,
        {},
        {
            Identifier(node) {
                string += node.name;
            },
            NullLiteral(node) {
                string += node.raw;
            },
            StringLiteral(node) {
                string += node.raw;
            },
            BooleanLiteral(node) {
                string += node.raw;
            },
            NumericLiteral(node) {
                string += node.raw;
            },
            MemberExpression(node, { visit }) {
                visit(node.object);
                if (node.computed) {
                    string += "[";
                    visit(node.property);
                    string += "]";
                } else {
                    string += ".";
                    visit(node.property);
                }
            },
            LogicalExpression(node, { visit }) {
                visit(node.left);
                string += ` ${node.operator} `;
                visit(node.right);
            },
            BinaryExpression(node, { visit }) {
                visit(node.left);
                string += ` ${node.operator} `;
                visit(node.right);
            },
            ConditionalExpression(node, { visit }) {
                visit(node.test);
                string += ` ? `;
                visit(node.consequent);
                string += ` : `;
                visit(node.alternate);
            },
            FilterExpression(node, { visit }) {
                visit(node.name);
                string += "(";
                for (let i = 0; i < node.arguments.length; i++) {
                    const arg = node.arguments[i];
                    visit(arg);
                    if (i !== node.arguments.length - 1) {
                        string += ", ";
                    }
                }
                string += ")";
            },
            CallExpression(node, { visit }) {
                visit(node.callee);
                string += "(";
                for (let i = 0; i < node.arguments.length; i++) {
                    const arg = node.arguments[i];
                    visit(arg);
                    if (i !== node.arguments.length - 1) {
                        string += ", ";
                    }
                }
                string += ")";
            },
            RangeExpression(node, { visit }) {
                visit(node.from);
                string += "..";
                visit(node.to);
            },
            UnaryExpression(node, { visit }) {
                string += node.operator;
                if (node.operator === "not") {
                    string += " ";
                }
                visit(node.argument);
            },
            ArrowFunctionExpression(node, { visit }) {
                string += "(";
                for (let i = 0; i < node.params.length; i++) {
                    const param = node.params[i];
                    visit(param);
                    if (i !== node.params.length - 1) {
                        string += ", ";
                    }
                }
                string += ") => ";
                visit(node.body);
            },
            ArrayExpression(node, { visit }) {
                string += "[";
                for (let i = 0; i < node.elements.length; i++) {
                    const element = node.elements[i];
                    visit(element);
                    if (i !== node.elements.length - 1) {
                        string += ", ";
                    }
                }
                string += "]";
            },
            ObjectExpression(node, { visit }) {
                string += "{ ";
                for (let i = 0; i < node.properties.length; i++) {
                    const property = node.properties[i];
                    visit(property.key);
                    string += ": ";
                    visit(property.value);
                    if (i !== node.properties.length - 1) {
                        string += ", ";
                    }
                }
                string += " }";
            },
            InExpression(node, { visit }) {
                visit(node.left);
                if (node.not) {
                    string += " not in ";
                } else {
                    string += " in ";
                }
                visit(node.right);
            },
            IsExpression(node, { visit }) {
                visit(node.left);
                string += " is ";
                if (node.not) {
                    string += "not ";
                }
                visit(node.right);
            },
        }
    );

    return string;
}
