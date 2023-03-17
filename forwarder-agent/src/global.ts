import http from "http"
import { RemoteBackend } from "./client.js"
import { WebSocketServer } from "ws"
import config from "./config.js"

declare global {
    var SERVER: http.Server
    var WS: WebSocketServer
    var CONFIG: typeof config
    var BACKEND: RemoteBackend | null
}

export {}