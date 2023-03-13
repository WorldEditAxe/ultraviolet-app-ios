import http from "http"
import { UVClient } from "./client.js"
import config from "./config.js"

declare global {
    var SERVER: http.Server
    var CONFIG: typeof config
    var BACKEND: UVClient
}

export {}