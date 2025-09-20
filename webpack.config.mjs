import TsconfigPathsPlugin from 'tsconfig-paths-webpack-plugin';
import TerserPlugin from 'terser-webpack-plugin';
import { fileURLToPath } from 'url';
import path from 'path';

// Required workaround for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const commonModuleRules = {
	rules: [
		{
			test: /\.ts$/,
			exclude: /node_modules/,
			use: 'ts-loader',
		},
		{
			test: /\.m?js$/,
			exclude: /node_modules/,
			use: {
				loader: 'babel-loader',
				options: {
					presets: ['@babel/preset-env'],
				},
			},
		},
	],
};

export default [
	{
		entry: './src/index.ts',
		output: {
			filename: 'bundle.js',
			path: path.resolve(__dirname, 'dist'),
		},
		resolve: {
			extensions: ['.ts', '.js'],
			plugins: [new TsconfigPathsPlugin({ configFile: './tsconfig.json' })],
		},
		mode: 'development',
		module: commonModuleRules,
		optimization: {
			minimize: false,
		},
	},
	{
		entry: './src/index.ts',
		output: {
			filename: 'bundle.min.js',
			path: path.resolve(__dirname, 'dist'),
		},
		resolve: {
			extensions: ['.ts', '.js'],
			plugins: [new TsconfigPathsPlugin({ configFile: './tsconfig.json' })],
		},
		mode: 'production',
		module: commonModuleRules,
		optimization: {
			minimize: true,
			minimizer: [new TerserPlugin()],
		},
	},
];
