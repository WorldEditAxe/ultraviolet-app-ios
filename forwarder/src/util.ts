import config from "./config.js"
import http from "http"
import URL from "url";
import { UpgradeErrorCode } from "./enums.js";
import { UpgradeFailure } from "./structs.js";
import { Socket } from "net";
import { WebSocket } from "ws";

export namespace HTTPUtil {
    export async function route(req: http.IncomingMessage, res: http.ServerResponse) {
        const url = URL.parse(req.url!)
        if (HTTPUtil.isGatewayConnectionAttempt(url.pathname!)) {
            res.writeHead(400)
                .end(JSON.stringify({
                    error: UpgradeErrorCode.ERR_NOT_WS_CON,
                    message: "Non-WebSocket upgrade request made to gateway connect route."
                } as UpgradeFailure))
        } else {
            if (!BACKEND) {
                res.writeHead(502)
                    .end("Hello! This server is not connected to an Ultraviolet iOS backend. Pair your backend instance for this website to work.")
            } else {
                HTTPUtil.forwardHTTP(req, res)
            }
        }
    }

    export function isGatewayConnectionAttempt(route: string): boolean {
        return route == `/gateway/${Math.floor(Date.now() / 10000)}`
    }

    export async function handleUpgrade(req: http.IncomingMessage, socket: Socket, head: Buffer) {
        const url = URL.parse(req.url!)
        if (HTTPUtil.isGatewayConnectionAttempt(url.pathname!)) {
            if (req.headers["sec-auth-key"] === config.password || !config.password) {
                if (BACKEND) {
                    socket.end()
                } else {
                    if (WS.shouldHandle(req)) {
                        const ws = await new Promise<WebSocket>(res => {
                            WS.handleUpgrade(req, socket, head, ws => res(ws))
                        })

                    } else {
                        socket.end()
                    }
                }
            } else {
                socket.end()
            }
        } else {
            if (BACKEND) {
                HTTPUtil.forwardWS(req, socket, head)
            } else {
                socket.end()
            }
        }
    }

    export function forwardHTTP(req: http.IncomingMessage, res: http.ServerResponse) {

    }

    export function forwardWS(req: http.IncomingMessage, socket: Socket, head: Buffer) {

    }
}