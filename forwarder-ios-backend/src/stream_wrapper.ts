import EventEmitter from "events";
import { WebSocket } from "ws";
import IPacket from "./IPacket.js";
import { Protocol } from "./protocol.js";

export class StreamWrapper extends EventEmitter {
    public socket: WebSocket
    public ended: boolean = false

    private _readLen: number | null = null
    private _readBuffer: Buffer | null = null

    constructor(rawSocket: WebSocket) {
        super()
        this.socket = rawSocket
        this._bindListeners()
    }

    public writePacket(packet: IPacket, channelId: number): void {
        this.writeRaw(Buffer.concat([
            Protocol.writeVarInt(packet.id),
            packet.to()
        ]), channelId)
    }

    public writeRaw(data: Buffer, channelId: number): void {
        const body = Buffer.concat([Protocol.writeVarInt(channelId), data])
        this.socket.send(Buffer.concat([
            Protocol.writeVarInt(body.length),
            body
        ]))
    }

    public readPacket(channelId: number, packetId?: number): Promise<[number, Buffer]> {
        return new Promise<[number, Buffer]>((res, rej) => {
            const endCb = () => {
                rej("Socket closed whilst waiting for data.")
            }, packetCb = (chan: number, data: Buffer) => {
                if (chan == channelId) {
                    const id = Protocol.readVarInt(data)
                    if (id.value == packetId || packetId == null) {
                        this.removeListener('packet', packetCb)
                        this.removeListener('end', endCb)
                        res([id.value, id.newBuffer])
                    }
                }
            }
            this.on('packet', packetCb)
            this.on('end', endCb)
        })
    }

    public readRaw(channelId: number): Promise<Buffer> {
        return new Promise<Buffer>((res, rej) => {
            const endCb = () => {
                rej("Socket closed whilst waiting for data.")
            }, packetCb = (chan: number, data: Buffer) => {
                if (chan == channelId) {
                    this.removeListener('packet', packetCb)
                    this.removeListener('end', endCb)
                    res(data)
                }
            }
            this.on('packet', packetCb)
            this.on('end', endCb)
        })
    }

    private _bindListeners(): void {
        this.socket.once('close', () => {
            this.ended = true
            this.emit('end')
            if (this._readLen != null) {
                this.emit('error', new Error("Socket closed whilst waiting for full packet to transmit."))
            }
        })
        this.socket.on('message', data => {
            console.log(1)
            if (data instanceof Buffer == false) {
                throw new TypeError("Non-buffer/binary data was sent via WebSocket.")
            } else {
                if (!this._readBuffer) {
                    const len = Protocol.readVarInt(data as Buffer)
                    this._readLen = len.value
                    this._readBuffer = len.newBuffer
                } else {
                    this._readBuffer = Buffer.concat([this._readBuffer, data as Buffer])
                }
                if (this._readLen! <= this._readBuffer!.length) {
                    const data = this._readBuffer!.subarray(0, this._readLen!),
                        chan = Protocol.readVarInt(data)
                    this._readBuffer = this._readBuffer!.subarray(this._readLen!)
                    this.emit('packet', chan.value, chan.newBuffer)
                }
                if (this._readBuffer!.length == 0) {
                    this._readBuffer = null
                    this._readLen = null
                } else {
                    while (true) {
                        // https://github.com/pollge-trolling/framework/blob/main/src/commons/encrypted_sockets.ts
                        const len = Protocol.readVarInt(this._readBuffer)
                        this._readLen = len.value
                        this._readBuffer = this._readBuffer!.subarray(len.readBytes)
                        if (this._readLen <= this._readBuffer!.length) {
                            const data = this._readBuffer!.subarray(0, this._readLen),
                                chan = Protocol.readVarInt(data)
                            this._readBuffer = this._readBuffer!.subarray(this._readLen)
                            this.emit('packet', chan.value, chan.newBuffer)
                        } else break
                        if (this._readBuffer.length <= 0) {
                            this._readBuffer = null
                            this._readLen =0
                            break
                        }
                    }
                }
            }
        })
    }
}

export declare interface StreamWrapper {
    on(event: 'packet', callback: (channelId: number, data: Buffer) => void | Function): this
    once(event: 'packet', callback: (channelId: number, data: Buffer) => void | Function): this
    removeListener(event: 'packet', callback: (channelId: number, data: Buffer) => void | Function): this

    on(event: 'end', callback: Function): this
    once(event: 'end', callback: Function): this
    removeListener(event: 'end', callback: Function): this
}