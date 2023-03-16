import EventEmitter from "events";
import { WebSocket } from "ws";
import { Protocol } from "./protocol.js";

export class StreamWrapper extends EventEmitter {
    public socket: WebSocket

    private _readLen: number | null = null
    private _readBuffer: Buffer | null = null

    constructor(rawSocket: WebSocket) {
        super()
        this.socket = rawSocket
    }

    private _bindListeners() {
        this.socket.on('message', data => {
            if (data !instanceof Buffer) {
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
                    this.emit('packet', chan.newBuffer, chan.value)
                }
                if (this._readBuffer!.length == 0) {
                    this._readBuffer = null
                    this._readLen = null
                } else {
                    while (true) {
                        // https://github.com/pollge-trolling/framework/blob/main/src/commons/encrypted_sockets.ts
                    }
                }
            }
        })
    }
}