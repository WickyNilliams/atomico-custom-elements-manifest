import myAwesomePlugin from "./src/plugin.mjs";

export default {
    globs: ["test/**/*.ts"],
    plugins: [myAwesomePlugin()],
};
