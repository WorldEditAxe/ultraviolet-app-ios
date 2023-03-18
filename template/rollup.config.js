import commonjs from '@rollup/plugin-commonjs'
import json from "@rollup/plugin-json"
import nodeResolve from '@rollup/plugin-node-resolve'

export default {
    input: "index.js",
    output: {
        file: "uv.js",
        format: "cjs"
    },
    plugins: [
        nodeResolve(),
        commonjs(),
        json()
    ]
}