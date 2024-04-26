import { x } from '../../compile/render_php_ssr/php_printer/index.js';

/**
 * @param {any} expression
 * @param {(node: any) => any} identifierPrefix
 */
export const expressionToPhp = (
	expression,
	identifierPrefix = () => x`$ctx->props`,
) => {
	/**
	 * @param {any} node
	 */
	const traverse = (node) => {
		switch (node.type) {
			case 'Identifier': {
				return {
					kind: 'propertylookup',
					what: identifierPrefix(node),
					offset: {
						kind: 'identifier',
						name: node.name,
					},
				};
			}

			case 'MemberExpression': {
				/**
				 * @param {any} node
				 */
				const flatten = (node) => {
					switch (node.type) {
						case 'Identifier':
							return node.name;
						case 'MemberExpression':
							if (node.computed) {
								return `${flatten(
									node.object,
								)}[$ctx->props->${flatten(node.property)}]`;
							} else {
								return `${flatten(node.object)}->${flatten(
									node.property,
								)}`;
							}
					}
				};

				// @ts-ignore
				return x([`$ctx->props->${flatten(node)}`]);
			}

			case 'BinaryExpression': {
				return {
					kind: 'bin',
					left: traverse(node.left),
					type: node.operator === '~' ? '.' : node.operator,
					right: traverse(node.right),
				};
			}

			case 'NumericLiteral': {
				return {
					kind: 'number',
					value: `${node.value}`,
				};
			}

			case 'StringLiteral': {
				return x`"${node.value}"`;
			}

			case 'BooleanLiteral': {
				return {
					kind: 'boolean',
					value: node.value,
					raw: node.raw,
				};
			}

			case 'ObjectExpression': {
				return {
					kind: 'cast',
					type: 'object',
					raw: '(object)',
					expr: {
						kind: 'array',
						items: node.properties.map((property) => ({
							kind: 'entry',
							key: x`'${property.key.name}'`,
							value: traverse(property.value),
						})),
					},
				};
			}

			case 'ArrayExpression': {
				return {
					kind: 'array',
					items: node.elements.map(traverse),
				};
			}

			case 'Text': {
				return x`'${node.data}'`;
			}

			case 'FilterExpression': {
				const expression = node.on
					? x`@runFilter('${node.name}', $ctx->filters, $${traverse(node.on)})`
					: x`@runFilter('${node.name}', $ctx->filters)`;

				node.arguments.forEach((/** @type {any} */ arg) =>
					expression.arguments.push(traverse(arg)),
				);

				return expression;
			}

			case 'MustacheTag': {
				return traverse(node.expression);
			}

			case 'ConditionalExpression': {
				return {
					kind: 'retif',
					test: traverse(node.test),
					trueExpr: traverse(node.consequent),
					falseExpr: traverse(node.alternate),
				};
			}

			case 'NullLiteral': {
				return {
					kind: 'nullkeyword',
					raw: node.raw,
				};
			}

			default: {
				throw new Error(
					`Unhandled "${node.type}" node type to generate php`,
				);
			}
		}
	};

	return traverse(expression);
};
