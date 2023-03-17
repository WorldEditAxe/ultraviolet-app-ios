import EventEmitter from "events";
import config from "./config.js"
import { Socket } from "net";
import { Duplex } from "stream";
import { WebSocket } from "ws";
import Logger from "./logger.js";
import { BRANDING, PROTO_VERSION } from "./meta.js";
import CIdentifyPacket from "./packets/identify/CIdentifyPacket.js";
import SIdentifyFailurePacket, { IdentifyFailureReason } from "./packets/identify/SIdentifyFailurePacket.js";
import SIdentifySuccessPacket from "./packets/identify/SIdentifySuccessPacket.js";
import { CConnectionEndPacket } from "./packets/ready/CConnectionEndPacket.js";
import { SConnectionEndPacket } from "./packets/ready/SConnectionEndPacket.js";
import SNewConnectionPacket from "./packets/ready/SNewConnectionPacket.js";
import { Protocol } from "./protocol.js";
import IPacket from "./IPacket.js";
import { StreamWrapper } from "./stream_wrapper.js";
import { CCAckConnectionOpenPacket } from "./packets/ready/CAckConnectionOpenPacket.js";

const endPacketId = (new SConnectionEndPacket()).id
const newConnectionPacketId = (new SNewConnectionPacket()).id
const logger = new Logger("ConnectionManager")

export class SelfBackend extends EventEmitter {
    socket: WebSocket
    handler: StreamWrapper
    connections: DownstreamConnection[]
    state: ConnectionState = ConnectionState.CONNECTED

    constructor(socket: WebSocket, handler: StreamWrapper) {
        super()
        this.socket = socket
        this.handler = handler
        this.connections = []
        this._performHandshake()
            .then(() => this._bindListeners())
    }

    private _bindListeners() {
        this.handler.once('end', () => {
            logger.info(`Remote WebSocket connection closed, exiting!`)
            this.connections.forEach(c => {
                if (!c.destroyed) {
                    c.destroy()
                    this.emit('connectionEnd', c)
                }
            })
            this.connections = []
            this.emit('end')
            process.exit(1)
        })
        this.handler.on('packet', (id, packet) => {
            if (id == 0) {
                const id = Protocol.readVarInt(packet)
                if (id.value == endPacketId) {
                    const cEndPacket = new SConnectionEndPacket().from(id.newBuffer),
                        connection = this.connections.filter(c => c.channelId == cEndPacket.channelId!)[0]
                    this.emit('packet', cEndPacket)
                    if (connection) {
                        logger.info(`[CONNECTION_END] Connection with ID ${cEndPacket.channelId} was closed.`)
                        connection.destroy()
                        this.connections = this.connections.splice(this.connections.indexOf(connection), 1)
                        this.emit('connectionEnd', connection)
                    }
                } else if (id.value == newConnectionPacketId) {
                    const newConP = new SNewConnectionPacket().from(id.newBuffer),
                        socket = new Socket(),
                        downstreamCon = new DownstreamConnection(socket, newConP.channelId!, this)
                    this.emit('packet', newConP)
                    socket.connect({
                        host: config.serverIp,
                        port: config.serverPort
                    }, () => {
                        logger.info(`[CONNECTION] New downstream connection from [/${newConP.ip}:${newConP.port}]. (ID: ${newConP.channelId})`)
                    }).once('error', () => {
                        downstreamCon.destroy()
                    })
                    socket.on('data', d => downstreamCon.write(d))
                    downstreamCon.on('data', d => {
                        socket.write(d)
                    })
                    
                    const ack = new CCAckConnectionOpenPacket()
                    ack.channelId = newConP.channelId!
                    this.handler.writePacket(ack, 0)

                    socket.once('close', () => downstreamCon.destroy())
                    downstreamCon.once('close', () => downstreamCon.destroy())
                }
            }
        })
    }

    private async _performHandshake() {
        const Cidentify = new CIdentifyPacket()
        Cidentify.protoVer = PROTO_VERSION
        Cidentify.branding = BRANDING
        this.handler.writePacket(Cidentify, 0)
        
        const readIdentify = await this.handler.readPacket(0)
        if (readIdentify[0] == 0x00) {
            const success = new SIdentifySuccessPacket().from(readIdentify[1])
            if (success.protoVer! == PROTO_VERSION) {
                logger.info(`Login Success - connected to server with branding ${success.branding} running protocol version ${success.protoVer}!`)
                this.emit('ready')
            } else {
                logger.error(`Incompatible protocol versions: agent is running ${success.protoVer} but the backend is running ${PROTO_VERSION}!`)
                process.exit(1)
            }
        } else {
            const failure = new SIdentifyFailurePacket().from(readIdentify[1])
            logger.error(`Login Failure! Backend was disconnected for ${Object.keys(IdentifyFailureReason)[Object.values(IdentifyFailureReason).indexOf(failure.reason!)]}.`)
            logger.error(`Is the backend and agent both running on the same protocol version? The backend is running protocol version ${PROTO_VERSION}.`)
            process.exit(1)
        }
    }
}

export declare interface SelfBackend {
    on(event: 'ready', listener: Function): this
    once(event: 'ready', listener: Function): this

    on(event: 'packet', listener: (packet: IPacket) => void | Function): this
    once(event: 'packet', listener: (packet: IPacket) => void | Function): this

    on(event: 'end', listener: Function): this
    once(event: 'end', listener: Function): this

    on(event: 'connectionEnd', listener: (connection: DownstreamConnection) => void | Function): this
    once(event: 'connectionEnd', listener: (connection: DownstreamConnection) => void | Function): this

    on(event: 'connectionOpen', listener: (connection: DownstreamConnection) => void | Function): this
    once(event: 'connectionOpen', listener: (connection: DownstreamConnection) => void | Function): this
}

export class DownstreamConnection extends Duplex {
    backend: SelfBackend
    socket: Socket
    channelId: number
    isClosed: boolean = false
    _dataCb?: Function

    constructor(socket: Socket, connectionId: number, self: SelfBackend) {
        super()
        this.channelId = connectionId
        this.backend = self
        this.socket = socket

        const cb = (id: number, data: Buffer) => {
            if (id == this.channelId) {
                this.emit('data', data)
            }
        }

        this.backend.handler.on('packet', (id: number, data: Buffer) => cb(id, data))
        this._dataCb = cb

        this.backend.connections.push(this)
        this.backend.emit('connectionOpen', this)
    }
    
    public _write(chunk: any, encoding: BufferEncoding, callback: (error?: Error | null | undefined) => void): void {
        const data = chunk instanceof Buffer ? chunk : Buffer.from(chunk as string, encoding)
        this.backend.handler.writeRaw(data, this.channelId)
        callback()
    }

    public _read(): void {
        // handled by this._readCb
    }

    public _destroy(error?: Error | null, callback?: (error: Error | null) => void): void {
        const destroyPacket = new CConnectionEndPacket()
        destroyPacket.channelId = this.channelId
        this.backend.handler.writePacket(destroyPacket, 0)
        this.backend.handler.removeListener("packet", this._dataCb! as any)
        this.backend.connections = this.backend.connections.splice(this.backend.connections.indexOf(this), 1)
        this.isClosed = true
        if (callback) callback(error ?? null)
    }

    public end(cb?: (() => void) | undefined): this;
    public end(chunk: any, cb?: (() => void) | undefined): this;
    public end(chunk: any, encoding?: BufferEncoding | undefined, cb?: (() => void) | undefined): this;
    public end(chunk?: unknown, encoding?: unknown, cb?: unknown): this {
        if (chunk != null) {
            this.write(chunk, encoding as any)
        }
        // this._destroy(null)
        if (cb != null) (cb as Function)()
        return this
    }
}

export enum ConnectionState {
    CONNECTED,
    DISCONNECTED
}