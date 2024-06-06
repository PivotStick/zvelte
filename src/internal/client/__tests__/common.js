import { test as _test } from "@playwright/test";

/**
 * @param {Parameters<typeof _test>[2]} body
 */
export function test(title, pathname, body) {
    return _test(title, async ({ page }, testInfo) => {
        await page.goto(`http://localhost:3000${pathname}`);
        await page.waitForSelector("body.__ready");

        await body({ page }, testInfo);
    });
}
