import path from "path";
import { fileURLToPath } from "url";
import TerserPlugin from "terser-webpack-plugin";

// Required workaround for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const commonModuleRules = {
    rules: [
        {
            test: /\.m?js$/,
            exclude: /node_modules/,
            use: {
                loader: "babel-loader",
                options: {
                    presets: ["@babel/preset-env"],
                },
            },
        },
    ],
};

export default [
    {
        entry: "./src/index.js",
        output: {
            filename: "bundle.js",
            path: path.resolve(__dirname, "dist"),
        },
        mode: "development",
        module: commonModuleRules,
        optimization: {
            minimize: false,
        },
    },
    {
        entry: "./src/index.js",
        output: {
            filename: "bundle.min.js",
            path: path.resolve(__dirname, "dist"),
        },
        mode: "production",
        module: commonModuleRules,
        optimization: {
            minimize: true,
            minimizer: [new TerserPlugin()],
        },
    },
];
