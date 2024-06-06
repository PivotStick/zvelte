// @ts-check
import { expect } from "@playwright/test";
import { test } from "../common";

test("has hello world", "/hello-world", async ({ page }) => {
    const body = page.locator("body");

    expect(await body.innerText()).toBe("Hello World");
});
