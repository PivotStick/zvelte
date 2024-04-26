import { children, detach, endHydrating, startHydrating } from './dom.js';

export class ZoneComponent {
	/**
	 * @param {any} [props={}]
	 */
	$set(props = {}) {
		Object.assign(this.$$.ctx.props, props);
		this.$$.fragment.update();
	}
}

/**
 * @param {*} component
 * @param {*} options
 * @param {*} createFragment
 * @param {*} instantiate
 * @param {*} appendStyles
 */
export function init(
	component,
	options,
	createFragment,
	instantiate,
	appendStyles,
) {
	const props = options.props ?? {};

	const jsInstance = instantiate?.({
		getData: () => props,
		render: (newProps = {}) => {
			Object.assign(props, newProps);
			$$.fragment.update();
		},
	});

	const $$ = (component.$$ = {
		target: options.target,
		ctx: {
			vars: {},
			props,
			listeners: jsInstance?.listeners ?? {},
			filters: jsInstance?.filters ?? {},
		},
	});

	if (appendStyles) appendStyles();

	$$.fragment = createFragment?.($$.ctx) ?? false;

	if (options.target) {
		if (options.hydrate) {
			startHydrating();
			const nodes = children(options.target);
			$$.fragment && $$.fragment.claim(nodes);
			nodes.forEach(detach);
		} else {
			$$.fragment && $$.fragment.create();
		}
		mountComponent(component, options.target, options.anchor);
		endHydrating();
	}
}

export function mountComponent(component, target, anchor) {
	component.$$.fragment?.mount(target, anchor);
}

export function createComponent(block) {
	if (block) block.create();
}

/** @returns {void} */
export function claimComponent(block, parentNodes) {
	if (block) block.claim(parentNodes);
}

export function destroyComponent(component) {
	component.$$.fragment?.destroy();
}
