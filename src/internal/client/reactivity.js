const STATE_SYMBOL = Symbol();
const UNINITIALIZED = Symbol();

/**
 * @template [T = any]
 * @typedef {{
 *  signals: Map<string | symbol, Signal<T[keyof T]>>;
 *  proxy: T;
 *  array: boolean;
 *  version: Signal<number>;
 *  target: T;
 * }} ProxyMetadata
 */

/**
 * @template T
 * @typedef {{ value: T }} Source
 */

/**
 * @template [T=unknown]
 * @typedef {{
 *  effects?: Set<Effect>;
 *  value: T;
 *  equals(this: Signal<T>, value: unknown): boolean;
 *  version: number;
 * }} Signal
 */

/**
 * @typedef {{
 *  deps?: Set<Signal>;
 *  fn: () => void;
 * }} Effect
 */

/**
 * @typedef {Text | Element | Comment} TemplateNode
 * @typedef {TemplateNode | TemplateNode[]} Dom;
 */

/**
 * Tracks if there is already a callback scheduled to be called later
 * It's to make only ONE trigger after many update requests
 */
let scheduled = false;

/**
 * This one is used to know which are the callbacks to call when the promise
 * resolves
 *
 * @type {Set<Effect>}
 */
let scheduledEffects = new Set();

/**
 * @type {{ removeListeners: (() => void)[] }[]}
 */
let currentContexts = [];

/**
 * @type {Effect | undefined}
 */
let currentEffect = undefined;

/** @returns {typeof currentContexts[number] | undefined} */
const currentContext = () => currentContexts[currentContexts.length - 1];

/**
 * This add a list of callbacks to be called when "flush" is called AND
 * it schedules a "flush" if not already scheduled
 *
 * @param {Set<Effect> | null} effects
 */
function schedule(effects) {
    if (!effects) return;
    effects.forEach((e) => scheduledEffects.add(e));
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(flush);
}

/**
 * Calls all the effects's callbacks
 * And clear them
 */
function flush() {
    scheduledEffects.forEach(executeEffect);
    scheduledEffects.clear();
    scheduled = false;
}

/**
 * @param {Effect} effect
 */
function executeEffect(effect) {
    if (effect.deps) {
        effect.deps.forEach((dep) => dep.effects?.delete(effect));
        effect.deps.clear();
    }

    currentEffect = effect;
    effect.fn();
    currentEffect = null;
}

/**
 * Lets you skipping all signals subscribtions for the current effect
 * during the call of the given callback
 *
 * Usefull for nesting effects and controlling deep reactivity
 *
 * @param {() => void} callback
 */
export function untrack(callback) {
    let previousEffect = currentEffect;
    currentEffect = null;
    callback();
    currentEffect = previousEffect;
}

/**
 * Pushes a "context" object to the "currentContexts" stack
 * to wrap all observers between this function and its "pop" function
 * inside this context
 *
 * Used to removed observers scoped to components, when a component destroys
 * it will "flush" all it's observers for all signals
 */
export function pushContext() {
    const previousCtx = currentContext();

    /**
     * @type {typeof currentContexts[number]}
     */
    const ctx = {
        removeListeners: [],
    };

    currentContexts.push(ctx);

    if (previousCtx) {
        previousCtx.removeListeners.push(flush);
    }

    function pop() {
        currentContexts.pop();
    }

    function flush() {
        ctx.removeListeners.forEach((listener) => listener());
        ctx.removeListeners.length = 0;
    }

    return { pop, flush };
}

/**
 * This function has a side effect of making its triggered signals to subscribe
 * to the given callback during its call
 *
 * Which will make the given callback scheduled on any updates of those signals
 *
 * @param {() => void} callback
 */
export function effect(callback) {
    const previous = currentEffect;
    currentEffect = {
        fn: callback,
        deps: null,
    };
    callback();
    currentEffect = previous;
}

/**
 * Creates a signals that updates depending on the used
 * signals in the given callback
 *
 * @template T
 * @param {() => T} callback
 * @returns {Source<T>}
 */
export function derived(callback) {
    const previous = currentEffect;
    currentEffect = {
        fn: () => (signal.value = callback()),
        deps: null,
    };

    const signal = source(callback());

    currentEffect = previous;

    return signal;
}

/**
 * @template T
 * @param {T} value
 * @returns {Signal<T>}
 */
function createSignal(value) {
    /** @type {Signal<T>} */
    const signal = {
        effects: undefined,
        equals(value) {
            return this.value === value;
        },
        value,
        version: 0,
    };

    return signal;
}

/**
 * Creates a source of signals
 * When getting the wrapped value it will gap the currentEffect to be subscribed
 * to this source
 *
 * @template T
 * @param {T} value
 * @returns {Source<T>}
 */
export function source(value) {
    const signal = createSignal(value);

    return {
        get value() {
            return get(signal);
        },

        /**
         * setting its value will signal effects to trigger
         */
        set value(value) {
            set(signal, value);
        },
    };
}

/**
 * @template T
 * @param {Signal<T>} signal
 */
function get(signal) {
    const effect = currentEffect;
    if (effect) {
        (signal.effects ??= new Set()).add(effect);
        const ctx = currentContext();
        if (ctx) {
            ctx.removeListeners.push(() => {
                signal.effects.delete(effect);
            });
        }
    }

    return signal.value;
}

/**
 * @template T
 * @param {Signal<T>} signal
 * @param {T} value
 */
function set(signal, value) {
    if (!signal.equals(value)) {
        signal.value = value;
        signal.version++;
        schedule(signal.effects);
    }

    return signal.value;
}

/**
 * @param {Signal<any>} signal
 * @param {1 | -1} [d]
 */
function updateVersion(signal, d = 1) {
    set(signal, signal.value + d);
}

/**
 * @type {ProxyHandler}
 */
const stateProxyHandler = {
    defineProperty(target, prop, descriptor) {
        if (descriptor.value) {
            /** @type {ProxyMetadata} */
            const metadata = target[STATE_SYMBOL];

            const signal = metadata.signals.get(prop);
            if (signal !== undefined) set(signal, proxy(descriptor.value));
        }

        return Reflect.defineProperty(target, prop, descriptor);
    },

    deleteProperty(target, prop) {
        /** @type {ProxyMetadata} */
        const metadata = target[STATE_SYMBOL];
        const signal = metadata.signals.get(prop);
        const isArray = metadata.array;
        const boolean = delete target[prop];

        // If we have mutated an array directly, and the deletion
        // was successful we will also need to update the length
        // before updating the field or the version. This is to
        // ensure any effects observing length can execute before
        // effects that listen to the fields – otherwise they will
        // operate an an index that no longer exists.
        if (isArray && boolean) {
            const ls = metadata.signals.get("length");
            const length = target.length - 1;
            if (ls !== undefined && ls.value !== length) {
                set(ls, length);
            }
        }
        if (signal !== undefined) set(signal, UNINITIALIZED);

        if (boolean) {
            updateVersion(metadata.version);
        }

        return boolean;
    },

    get(target, prop, receiver) {
        if (prop === STATE_SYMBOL) {
            return Reflect.get(target, STATE_SYMBOL);
        }

        /** @type {ProxyMetadata} */
        const metadata = target[STATE_SYMBOL];
        let signal = metadata.signals.get(prop);

        // create a source, but only if it's an own property and not a prototype property
        if (
            signal === undefined &&
            (!(prop in target) ||
                Object.getOwnPropertyDescriptor(target, prop)?.writable)
        ) {
            signal = createSignal(proxy(target[prop]));
            metadata.signals.set(prop, signal);
        }

        if (signal !== undefined) {
            const value = get(signal);
            return value === UNINITIALIZED ? undefined : value;
        }

        return Reflect.get(target, prop, receiver);
    },

    getOwnPropertyDescriptor(target, prop) {
        const descriptor = Reflect.getOwnPropertyDescriptor(target, prop);
        if (descriptor && "value" in descriptor) {
            /** @type {ProxyMetadata} */
            const metadata = target[STATE_SYMBOL];
            const signal = metadata.signals.get(prop);

            if (signal) {
                descriptor.value = get(signal);
            }
        }

        return descriptor;
    },

    has(target, prop) {
        if (prop === STATE_SYMBOL) {
            return true;
        }
        /** @type {ProxyMetadata} */
        const metadata = target[STATE_SYMBOL];
        const has = Reflect.has(target, prop);

        let signal = metadata.signals.get(prop);
        if (
            signal !== undefined ||
            (currentEffect !== undefined &&
                (!has ||
                    Object.getOwnPropertyDescriptor(target, prop)?.writable))
        ) {
            if (signal === undefined) {
                signal = createSignal(
                    has ? proxy(target[prop]) : UNINITIALIZED,
                );
                metadata.signals.set(prop, signal);
            }
            const value = get(signal);
            if (value === UNINITIALIZED) {
                return false;
            }
        }
        return has;
    },

    set(target, prop, value, receiver) {
        /** @type {ProxyMetadata} */
        const metadata = target[STATE_SYMBOL];
        let signal = metadata.signals.get(prop);

        if (signal === undefined) {
            // the read creates a signal
            untrack(() => receiver[prop]);
            signal = metadata.signals.get(prop);
        }

        if (signal !== undefined) {
            set(signal, proxy(value));
        }

        const isArray = metadata.array;
        const notHas = !(prop in target);

        // variable.length = value -> clear all signals with index >= value
        if (isArray && prop === "length") {
            for (let i = value; i < target.length; i += 1) {
                const signal = metadata.signals.get(i + "");
                if (signal !== undefined) set(signal, UNINITIALIZED);
            }
        }

        // Set the new value before updating any signals so that any listeners get the new value
        target[prop] = value;

        if (notHas) {
            // If we have mutated an array directly, we might need to
            // signal that length has also changed. Do it before updating metadata
            // to ensure that iterating over the array as a result of a metadata update
            // will not cause the length to be out of sync.
            if (isArray) {
                const ls = metadata.signals.get("length");
                const length = target.length;
                if (ls !== undefined && ls.value !== length) {
                    set(ls, length);
                }
            }
            updateVersion(metadata.version);
        }

        return true;
    },

    ownKeys(target) {
        /** @type {ProxyMetadata} */
        const metadata = target[STATE_SYMBOL];

        get(metadata.version);
        return Reflect.ownKeys(target);
    },
};

/**
 * Same as source but makes keys of an object the sources
 *
 * @template T
 * @param {T} value
 * @returns {T}
 */
export function proxy(value) {
    if (typeof value === "object" && value != null && !Object.isFrozen(value)) {
        // If we have an existing proxy, return it...
        if (STATE_SYMBOL in value) {
            const metadata = /** @type {ProxyMetadata} */ (value[STATE_SYMBOL]);

            // ...unless the proxy belonged to a different object, because
            // someone copied the state symbol using `Reflect.ownKeys(...)`
            if (metadata.target === value || metadata.proxy === value) {
                return metadata.proxy;
            }
        }

        const proxy = new Proxy(value, stateProxyHandler);

        Object.defineProperty(value, STATE_SYMBOL, {
            /** @type {ProxyMetadata} */
            value: {
                signals: new Map(),
                version: createSignal(0),
                array: Array.isArray(value),
                proxy,
                target: value,
            },
            writable: true,
            enumerable: false,
        });

        return proxy;
    }

    return value;
}

/**
 * Should __ONLY__ be used during development
 *
 * @param {() => any} callback
 */
export function inspect(callback) {
    const fn = () => {
        console.log(JSON.parse(JSON.stringify(callback())));
    };

    currentEffect = {
        deps: null,
        fn,
    };
    JSON.stringify(callback()); // deep read
    currentEffect = null;
    fn();
}

/* - ---  DOM HELPERS  --- - */

/**
 * This lets you sync a reactive array with a list of dom elements!
 *
 * @template T
 * @param {Comment} anchor this is from where it will append elements
 * @param {() => T[]} get function to get the reactive array
 * @param {(item: T, array: T[], index: () => number) => DocumentFragment | TemplateNode} render
 * @param {() => DocumentFragment | TemplateNode} [emptyRender=null]
 */
export function eachBlock(anchor, get, render, emptyRender = null) {
    /**
     * @type {Map<T, {
     *   index: Source<number>;
     *   dom: Node[];
     *   ctx: ReturnType<typeof pushContext>;
     * }>}
     */
    const pairs = new Map();
    const ctx = currentContext();

    /**
     * @type {{ dom: Node[]; ctx: ReturnType<typeof pushContext> }=}
     */
    let emptyCtx;

    if (ctx) {
        // If a component deletes or if the "each" is used inside an item of another "each"
        // It should clean everything
        ctx.removeListeners.push(() => {
            pairs.forEach((o) => o.ctx.flush());
            emptyCtx?.ctx.flush();
        });
    }

    // This ignore effects is usefull if you use "each" in another effects
    untrack(() => {
        effect(() => {
            const array = get();

            // We don't want this effect to observe signals used inside the given render callbacks
            untrack(() => {
                pairs.forEach((v, item) => {
                    if (!array.includes(item)) {
                        removeNodes(v.dom);
                        v.ctx.flush();
                        pairs.delete(item);
                    }
                });

                if (!array.length && emptyRender && !emptyCtx) {
                    const ctx = pushContext();
                    const root = emptyRender();
                    const dom = getElements(root);
                    anchor.before(root);
                    ctx.pop();
                    emptyCtx = { dom, ctx };
                } else if (array.length) {
                    if (emptyCtx) {
                        emptyCtx.ctx.flush();
                        removeNodes(emptyCtx.dom);
                    }
                    emptyCtx = undefined;

                    /**
                     * @type {Node}
                     */
                    let previousFirstElement = anchor;

                    for (let i = array.length - 1; i >= 0; i--) {
                        const item = array[i];
                        let pair = pairs.get(item);

                        if (!pair) {
                            const index = source(i);
                            const ctx = pushContext();
                            const root = render(item, array, () => index.value);
                            const dom = getElements(root);
                            ctx.pop();

                            pair = { index, ctx, dom };

                            pairs.set(item, pair);
                            previousFirstElement.before(root);
                        } else if (pair.index.value !== i) {
                            pair.index.value = i;
                            previousFirstElement.before(...pair.dom);
                        }

                        previousFirstElement = pair.dom[0];
                    }
                }
            });
        });
    });
}

/**
 * Allows you to conditionally render reactive element from
 * reactive conditions!
 *
 * @param {Comment} anchor this is from where it will add the result element
 * @param {() => boolean} conditions you can use your signals in this function, must return a boolean
 * @param {() => Dom | DocumentFragment} consequentRender called when "conditions" returns true
 * @param {() => Dom | DocumentFragment} [alternateRender=null] called when "conditions" returns false
 */
export function ifBlock(
    anchor,
    conditions,
    consequentRender,
    alternateRender = null,
) {
    /**
     * @type {{ dom: Node[]; ctx: ReturnType<typeof pushContext> }=}
     */
    let current;

    function flush() {
        if (current) {
            current.ctx.flush();
            removeNodes(current.dom);
        }
    }

    const ctx = currentContext();

    if (ctx) {
        ctx.removeListeners.push(flush);
    }

    let result;

    effect(() => {
        if (result === (result = !!conditions())) return;

        untrack(() => {
            flush();

            const render = result ? consequentRender : alternateRender;

            if (render) {
                const ctx = pushContext();
                const root = render();
                const dom = getElements(root);
                anchor.before(root);
                ctx.pop();
                current = { dom, ctx };
            } else {
                current = undefined;
            }
        });
    });
}

/**
 * @param {TemplateNode} value
 * @returns {Node[]}
 */
function getElements(value) {
    if (value instanceof DocumentFragment) {
        return [...value.childNodes];
    }

    return [value];
}

/**
 * @param {Node[]=} nodes
 */
function removeNodes(nodes) {
    nodes?.forEach((n) => {
        if (n.isConnected) {
            n.parentElement?.removeChild(n);
        }
    });
}

/**
 * Easy way to rapidly create many elements and walk
 * trough it to get wanted nodes
 *
 * Will ignores text nodes that only that are between nodes have whitespaces with at least on new line inside that whitespace
 */
export function template(content = "") {
    content = content.replace(/(?<=>)\s*\n\s*(?=<)/g, "").trim(); // Removes only whitespaces with at least one new line inside

    const template = document.createElement("template");
    template.innerHTML = content;
    const walker = document.createTreeWalker(template.content);

    return /** @type {const} */ ([
        template.content,
        {
            /**
             * @override
             * @template {typeof Node | typeof Element | typeof Comment} T
             * @param {T} type
             * @returns {InstanceType<T>}
             */
            next(moveCount = 1, type = null) {
                for (let i = 0; i < moveCount; i++) {
                    walker.nextNode();
                }

                if (!(walker.currentNode instanceof (type ?? Node))) {
                    throw new Error(
                        `Expected ${type.name} but got "${walker.currentNode.nodeName}"`,
                    );
                }

                // @ts-ignore
                return walker.currentNode;
            },
        },
    ]);
}
