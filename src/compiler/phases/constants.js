export const EACH_ITEM_REACTIVE = 1;
export const EACH_INDEX_REACTIVE = 1 << 1;
export const EACH_KEYED = 1 << 2;

export const EACH_IS_CONTROLLED = 1 << 3;
export const EACH_IS_ANIMATED = 1 << 4;
export const EACH_IS_STRICT_EQUALS = 1 << 6;

export const TRANSITION_IN = 1;
export const TRANSITION_OUT = 1 << 1;
export const TRANSITION_GLOBAL = 1 << 2;

export const TEMPLATE_FRAGMENT = 1;
export const TEMPLATE_USE_IMPORT_NODE = 1 << 1;

export const UNINITIALIZED = Symbol();

export const HYDRATION_START = "[";
export const HYDRATION_END = "]";
export const HYDRATION_ANCHOR = "";
export const HYDRATION_END_ELSE = `${HYDRATION_END}!`; // used to indicate that an `{% else %}...` block was rendered

export const PROPS_IS_IMMUTABLE = 1;
export const PROPS_IS_RUNES = 1 << 1;
export const PROPS_IS_UPDATED = 1 << 2;
export const PROPS_IS_LAZY_INITIAL = 1 << 3;
