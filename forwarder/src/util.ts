import config from "./config.js"
import http from "http"
import URL from "url";
import { UpgradeErrorCode } from "./enums.js";
import { UpgradeFailure } from "./structs.js";
import { Socket } from "net";
import { WebSocket } from "ws";
import Logger from "./logger.js";
import CIdentifyPacket from "./packets/identify/CIdentifyPacket.js";
import { Protocol } from "./protocol.js";
import { PROTO_VERSION } from "./meta.js";
import SIdentifyFailurePacket, { IdentifyFailureReason } from "./packets/identify/SIdentifyFailurePacket.js";
import { UVClient } from "./client.js";

const logger = new Logger("ConnectionHandler")

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
                        let resolved = false
                        setTimeout(() => {
                            if (!resolved) {
                                logger.warn(`Connection from [/${socket.remoteAddress}:${socket.remotePort}] timed out whilst authenticating!`)
                                socket.end()
                            }
                        }, 30000)
                        const ws = await new Promise<WebSocket>(res => {
                            WS.handleUpgrade(req, socket, head, ws => res(ws))
                        })
                        const Cidentify = new CIdentifyPacket().from((await Protocol.readPacket(ws))[2])
                        if (Cidentify.protoVer! === PROTO_VERSION) {
                            const uvClient = new UVClient(ws)
                            
                        } else {
                            const SError = new SIdentifyFailurePacket()
                            SError.reason = IdentifyFailureReason.BAD_VERSION
                            Protocol.writePacket(ws, 0, SError)
                            ws.close()
                        }
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