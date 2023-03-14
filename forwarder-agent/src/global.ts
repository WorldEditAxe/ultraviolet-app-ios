import http from "http"
import { SelfBackend } from "./client.js"
import { WebSocketServer } from "ws"
import config from "./config.js"

declare global {
    var SERVER: http.Server
    var WS: WebSocketServer
    var CONFIG: typeof config
    var BACKEND: SelfBackend | null
}

export {}