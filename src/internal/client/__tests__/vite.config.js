import { defineConfig } from "vite";
import { access, readFile } from "fs/promises";

async function exists(path = "") {
    try {
        await access(path);
        return true;
    } catch {
        return false;
    }
}

export default defineConfig({
    plugins: [
        {
            name: "playwright-tests",
            transformIndexHtml(html, context) {
                return html.replace(
                    /%path%/g,
                    context.originalUrl.slice(1) + ".js",
                );
            },
            transform(code, id, options) {
                if (/\/tests\/[^/]+\.js$/.test(id)) {
                    return `
${code}

requestAnimationFrame(() => {
    document.body.classList.add("__ready");
});
`.trim();
                }
            },
            //             configureServer(server) {
            //                 server.middlewares.use(async (req, res, next) => {
            //                     const pathname = req.url?.split("?")[0] ?? "/";
            //                     const path = join(server.config.root, "tests", pathname);
            //
            //                     if (await exists(path)) {
            //                         const js = await readFile(path);
            //                         res.write(`
            //
            // `);
            //                         res.setHeader("Content-Type", "text/html")
            //                         res.end();
            //                     } else {
            //                         next();
            //                     }
            //                 });
            //             },
        },
    ],
});
