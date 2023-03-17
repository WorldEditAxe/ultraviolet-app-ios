import EventEmitter from "events";
import http from "http"
import { Socket } from "net";
import { Duplex } from "stream";
import { WebSocket } from "ws";
import Logger from "./logger.js";
import { CConnectionEndPacket } from "./packets/ready/CConnectionEndPacket.js";
import { SConnectionEndPacket } from "./packets/ready/SConnectionEndPacket.js";
import { Protocol } from "./protocol.js";
import { StreamWrapper } from "./stream_wrapper.js";

const endPacketId = (new CConnectionEndPacket()).id
const a
const logger = new Logger("ConnectionHandler")

export class RemoteBackend extends EventEmitter {
    socket: WebSocket
    handler: StreamWrapper
    connections: UpstreamConnection[]
    state: ConnectionState = ConnectionState.CONNECTED
    freedConnectionIds: number[] = []
    nextConnectionId: number = 1

    constructor(socket: WebSocket, handler: StreamWrapper) {
        super()
        this.socket = socket
        this.handler = handler
        this.connections = []
        this._bindListeners()
    }

    private _bindListeners() {
        this.handler.once('end', () => {
            logger.info("Upstream server disconnected from agent!")
            this.state = ConnectionState.DISCONNECTED
            this.connections.forEach(c => {
                if (!c.destroyed) {
                    c.destroy()
                    this.emit('connectionEnd', c)
                }
            })
            this.connections = []
            this.freedConnectionIds = []
            this.nextConnectionId = 1
            this.emit('end')
            global.BACKEND = null
        })
        this.handler.on('packet', (id, data) => {
            if (id == 0) {
                const pId = Protocol.readVarInt(data)
                if (pId.value == endPacketId) {
                    const cEndPacket = new SConnectionEndPacket().from(pId.newBuffer),
                        connection = this.connections.filter(c => c.channelId == cEndPacket.channelId!)[0]
                    if (connection) {
                        connection.destroy()
                        this.connections = this.connections.splice(this.connections.indexOf(connection), 1)
                        this.returnConnectionId(connection.channelId)
                        this.emit('connectionEnd', connection)
                    }
                }
            }
        })
    }

    getNextConnectionId(): number {
        if (this.freedConnectionIds.length > 0) {
            const end = this.freedConnectionIds[0]
            this.freedConnectionIds = this.freedConnectionIds.splice(0, 1)
            return end
        } else {
            const ret = this.nextConnectionId
            this.nextConnectionId++
            return ret
        }
    }

    returnConnectionId(cId: number) {
        if (this.freedConnectionIds.filter(i => i == cId).length == 0) {
            this.freedConnectionIds.push(cId)
        } else {
            logger.warn("returnConnectionId is attempting to return a channel ID already in array!?")
        }
    }
}

export declare interface RemoteBackend {
    on(event: 'ready', listener: Function): this
    once(event: 'ready', listener: Function): this

    on(event: 'end', listener: Function): this
    once(event: 'end', listener: Function): this

    on(event: 'connectionEnd', listener: (connection: UpstreamConnection) => void | Function): this
    once(event: 'connectionEnd', listener: (connection: UpstreamConnection) => void | Function): this

    on(event: 'connectionOpen', listener: (connection: UpstreamConnection) => void | Function): this
    once(event: 'connectionOpen', listener: (connection: UpstreamConnection) => void | Function): this
}

export class UpstreamConnection extends Duplex {
    backend: RemoteBackend
    channelId: number
    isClosed: boolean = false
    _dataCb?: Function

    constructor(connectionId: number, self: RemoteBackend) {
        super()
        this.channelId = connectionId
        this.backend = self

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
        const destroyPacket = new SConnectionEndPacket()
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
        this._destroy(null)
        if (cb != null) (cb as Function)()
        return this
    }
}

export enum ConnectionState {
    CONNECTED,
    DISCONNECTED
}