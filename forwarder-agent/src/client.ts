import EventEmitter from "events";
import http from "http"
import { Socket } from "net";
import { Duplex } from "stream";
import { WebSocket } from "ws";
import Logger from "./logger.js";
import { SConnectionEndPacket } from "./packets/ready/SConnectionEndPacket.js";
import { StreamWrapper } from "./stream_wrapper.js";

const endPacketId = (new SConnectionEndPacket()).id
const logger = new Logger("ConnectionHandler")

export class SelfBackend extends EventEmitter {
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
                if (data[0] == endPacketId) {
                    const cEndPacket = new SConnectionEndPacket().from(data),
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
            this.freedConnectionIds = this.freedConnectionIds.slice(1)
            return end
        } else {
            const ret = this.nextConnectionId
            this.nextConnectionId++
            return ret
        }
    }

    returnConnectionId(cId: number) {
        this.freedConnectionIds.push(cId)
    }
}

export declare interface SelfBackend {
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
    backend: SelfBackend
    channelId: number
    isClosed: boolean = false
    
    constructor(channelId: number, uvClient: SelfBackend) {
        super()
        this.channelId = channelId
        this.backend = uvClient
        this._bindListeners()
        this.backend.connections.push(this)
        this.backend.emit('connectionOpen', this)
    }

    private _bindListeners() {
        this.backend.handler.on('packet', this._readCb)
    }

    private _readCb(id: number, data: Buffer) {
        if (id == this.channelId) {
            this.push(data)
        }
    }

    public _write(chunk: any, encoding: BufferEncoding, callback: (error?: Error | null | undefined) => void): void {
        const data = chunk instanceof Buffer ? chunk : Buffer.from(chunk as string, encoding)
        this.backend.handler.writeRaw(data, this.channelId)
        callback()
    }

    public _read(size: number): void {
        // data is already pushed to the read buffer via the listener
    }

    public _destroy(error: Error | null, callback: (error: Error | null) => void, ): void {
        const destroyPacket = new SConnectionEndPacket()
        destroyPacket.channelId = this.channelId
        this.backend.handler.writePacket(destroyPacket, 0)
        this.backend.handler.removeListener('packet', this._readCb)
        this.backend.connections = this.backend.connections.splice(this.backend.connections.indexOf(this), 1)
        this.backend.returnConnectionId(this.channelId)
        this.isClosed = true
    }
}

export enum ConnectionState {
    CONNECTED,
    DISCONNECTED
}