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
import { DownstreamConnection, SelfBackend } from "./client.js";
import SNewConnectionPacket from "./packets/ready/SNewConnectionPacket.js";

const logger = new Logger("ConnectionHandler")

export namespace HTTPUtil {
    export async function route(req: http.IncomingMessage, res: http.ServerResponse) {
        const url = new URL.URL(req.url!, `http://${req.headers.host!}`)
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
                            const uvClient = new SelfBackend(ws)
                            global.BACKEND = uvClient
                            logger.info(`Login Success! Client [/${socket.remoteAddress}:${socket.remotePort}] has successfullly logged in as the upstream server.`)
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

    /* NOTE: these are to be converted back into a TCP connection */

    export function forwardHTTP(req: http.IncomingMessage, res: http.ServerResponse) {
        const headers = req.headers,
            route = new URL.URL(req.url!, `http://${req.headers.host!}`),
            cId = BACKEND!.getNextConnectionId(),
            packet = new SNewConnectionPacket(),
            virtualDuplex = new DownstreamConnection(cId, BACKEND!)
        packet.channelId = cId
        packet.ip = req.socket.remoteAddress
        packet.port = req.socket.remotePort
        Protocol.writePacket(BACKEND!.socket, 0, packet)
        const httpConnection = http.request(route, {
            // any duplex is ok
            createConnection: () => virtualDuplex as any,
            host: 'localhost',
            method: req.method,
            headers: headers
        }, httpRes => {
            res.writeHead(httpRes.statusCode!, httpRes.statusMessage, httpRes.headers)
            req.on('data', d => httpConnection.write(d))
            httpRes.on('data', d => res.write(d))
            req.once('close', () => {
                virtualDuplex.destroy()
                httpConnection.end()
            })
            httpRes.once('close', () => {
                if (!virtualDuplex.destroyed)
                    virtualDuplex.destroy()
                res.end()
            })
        })
        httpConnection.once('error', () => {
            res.end()
        })
        req.once('error', () => {
            httpConnection.end()
        })
    }

    export function forwardWS(req: http.IncomingMessage, socket: Socket, head: Buffer) {
        if (WS.shouldHandle(req)) {
            WS.handleUpgrade(req, socket, head, (ws, req) => {
                const headers = req.headers,
                    route = new URL.URL(req.url!, `http://${req.headers.host!}`),
                    cId = BACKEND!.getNextConnectionId(),
                    packet = new SNewConnectionPacket(),
                    virtualDuplex = new DownstreamConnection(cId, BACKEND!)
                packet.channelId = cId
                packet.ip = req.socket.remoteAddress
                packet.port = req.socket.remotePort
                Protocol.writePacket(BACKEND!.socket, 0, packet)
                const wsConnection = new WebSocket(route, {
                    // any duplex is ok
                    createConnection: () => virtualDuplex as any,
                    host: 'localhost',
                    method: req.method,
                    headers: headers
                })

                wsConnection.on('ping', data => {
                    ws.ping(data)
                })
                wsConnection.on('pong', data => {
                    ws.pong(data)
                })
                ws.on('ping', data => {
                    wsConnection.ping(data)
                })
                ws.on('pong', data => {
                    wsConnection.pong(data)
                })
                wsConnection.on('message', data => {
                    ws.send(data)
                })
                ws.on('message', data => {
                    wsConnection.send(data)
                })

                wsConnection.once('close', (code) => {
                    ws.close(code)
                })
                ws.once('close', code => {
                    wsConnection.close(code)
                })
                wsConnection.once('error', () => {
                    ws.close()
                })
                ws.once('error', () => {
                    wsConnection.close()
                })
            })
        } else {
            socket.end()
        }
    }
}