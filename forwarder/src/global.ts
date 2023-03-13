import http from "http"
import { UVClient } from "./client.js"
import { WebSocketServer } from "ws"
import config from "./config.js"

declare global {
    var SERVER: http.Server
    var WS: WebSocketServer
    var CONFIG: typeof config
    var BACKEND: UVClient | null
}

export {}