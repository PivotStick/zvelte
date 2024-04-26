import { x } from 'code-red';

/**
 * @param {any} expression
 * @param {(node: any) => any} identifierPrefix
 */
export const expressionToJS = (
	expression,
	identifierPrefix = () => x`#ctx.props`,
) => {
	/**
	 * @param {any} node
	 */
	const traverse = (node) => {
		console.log(node);
		switch (node.type) {
			case 'Identifier': {
				return x`${identifierPrefix(node)}.${node.name}`;
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
							return `${flatten(node.object)}.${flatten(
								node.property,
							)}`;
					}
				};

				return x([`#ctx.props.${flatten(node)}`]);
			}

			case 'BinaryExpression': {
				return {
					type: 'BinaryExpression',
					left: traverse(node.left),
					operator: node.operator === '~' ? '+' : node.operator,
					right: traverse(node.right),
				};
			}

			case 'NumericLiteral': {
				return x`${node.value}`;
			}

			case 'StringLiteral': {
				return x`"${node.value}"`;
			}

			case 'Text': {
				return x`"${node.data}"`;
			}

			case 'FilterExpression': {
				const expression = node.on
					? x`@runFilter("${node.name}", #ctx.filters, ${traverse(node.on)})`
					: x`@runFilter("${node.name}", #ctx.filters)`;

				node.arguments.forEach((/** @type {any} */ arg) =>
					expression.arguments.push(traverse(arg)),
				);

				return expression;
			}

			case 'CallExpression': {
				return x`${traverse(node.name)}(${node.arguments.map((a) => traverse(a))})`;
			}

			case 'ObjectExpression': {
				return {
					type: 'ObjectExpression',
					properties: node.properties.map((prop) => ({
						type: 'Property',
						key: {
							type: 'Identifier',
							name: prop.key.name,
						},
						value: traverse(prop.value),
					})),
				};
			}

			case 'ArrayExpression': {
				return {
					type: 'ArrayExpression',
					elements: node.elements.map(traverse),
				};
			}

			case 'BooleanLiteral': {
				return {
					type: 'Literal',
					value: node.value,
					raw: node.raw,
				};
			}

			case 'MustacheTag': {
				return traverse(node.expression);
			}

			case 'ConditionalExpression': {
				return {
					type: 'ConditionalExpression',
					test: traverse(node.test),
					consequent: traverse(node.consequent),
					alternate: traverse(node.alternate),
				};
			}

			case 'NullLiteral': {
				return {
					type: 'Literal',
					value: node.value,
					raw: node.raw,
				};
			}

			default: {
				throw new Error(
					`Unhandled "${node.type}" node type to generate JS`,
				);
			}
		}
	};

	return traverse(expression);
};
