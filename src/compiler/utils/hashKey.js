import { hash } from "./hash.js";

export function hashKey(key = "") {
    return "C_" + hash(key);
}
