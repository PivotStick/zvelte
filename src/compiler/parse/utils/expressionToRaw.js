export const expressionToRaw = (expression) => {
	const traverse = (node) => {
		switch (node.type) {
			case 'Identifier': {
				return node.name;
			}

			case 'BinaryExpression': {
				return `${traverse(node.left)} ${node.operator} ${traverse(
					node.right,
				)}`;
			}

			case 'NumericLiteral': {
				return node.value;
			}

			case 'StringLiteral': {
				return `"${node.value}"`;
			}

			case 'FilterExpression': {
				const group = node.on.type === 'BinaryExpression';
				const on = group ? `(${traverse(node.on)})` : traverse(node.on);

				let expression = `${on}|${node.name}`;

				if (node.arguments.length) {
					expression += '(';
					expression += node.arguments
						.map((a) => traverse(a))
						.join(', ');
					expression += ')';
				}

				return expression;
			}
		}
	};

	return traverse(expression);
};
