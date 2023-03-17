import os from "os"
import varint from "varint"
import * as msgpack from "msgpackr"
import { Duplex } from "stream"
import IPacket from "./IPacket.js"
import { WebSocket } from "ws"

// This file contains implementations of all
// the basic datatypes of the Polly framework.
// Refer to "protocol.md - Data Types (Bare)" for more information.

export namespace Protocol {
    export const ENDIANESS: 'BE' | 'LE' = os.endianness()

    export type ReadResult<T> = {
        newBuffer: Buffer,
        value: T
    }

    // serves no "real" typing purpose, used to represent a fixed-size buffer
    // TypeScript will not utilize the generic
    export type BoundedBuffer<T extends number> = Buffer

    export enum ProtocolDatatype {
        UBYTE,
        BYTE,
        BOOLEAN,
        VARINT,
        VARLONG,
        STRING,
        ARRAY,
        MAP,
        BYTE_ARRAY,
        COMPLEX
    }

    // The bulkWrite() function allows you to quickly and easily write a packet.
    // Just provide a buffer and a schematic and the packet will get automatically serialized!
    export function bulkWrite(data: any[], schema: ProtocolDatatype[]): Buffer {
        if (data.length != schema.length)
            throw new TypeError(`Arguments data (${data.length}) and schema (${schema.length}) do not have the same array size!`)
        let buff = Buffer.alloc(0)

        for (let i = 0; i < schema.length; i++) {
            let d = data[i], dt = schema[i]
            switch(dt) {
                default:
                    throw new Error("Unknown protocol datatype enum!")
                case ProtocolDatatype.UBYTE:
                    (() => {
                        buff = Buffer.concat([buff, Protocol.writeUByte(d)])
                    })()
                    break
                case ProtocolDatatype.BYTE:
                    (() => {
                        buff = Buffer.concat([buff, Protocol.writeByte(d)])
                    })()
                    break
                case ProtocolDatatype.BOOLEAN:
                    (() => {
                        buff = Buffer.concat([buff, Protocol.writeBoolean(d)])
                    })()
                    break
                case ProtocolDatatype.VARINT:
                    (() => {
                        buff = Buffer.concat([buff, Protocol.writeVarInt(d)])
                    })()
                    break
                case ProtocolDatatype.VARLONG:
                    (() => {
                        buff = Buffer.concat([buff, Protocol.writeVarLong(d)])
                    })()
                    break
                case ProtocolDatatype.STRING:
                    (() => {
                        buff = Buffer.concat([buff, Protocol.writeString(d)])
                    })()
                    break
                case ProtocolDatatype.ARRAY:
                    (() => {
                        buff = Buffer.concat([buff, Protocol.writeArray(d)])
                    })()
                    break
                case ProtocolDatatype.MAP:
                    (() => {
                        buff = Buffer.concat([buff, Protocol.writeMap(d)])
                    })()
                    break
                case ProtocolDatatype.BYTE_ARRAY:
                    (() => {
                        buff = Buffer.concat([buff, Protocol.writeByteArray(d)])
                    })()
                    break
                case ProtocolDatatype.COMPLEX:
                    (() => {
                        buff = Buffer.concat([buff, Protocol.writeComplex(d)])
                    })()
                    break
            }
        }
        return buff
    }

    // The bulkRead() function allows you to quickly and easily read a packet.
    // Just provide a buffer and a schematic and the packet will get automatically parsed!
    export function bulkRead(buff: Buffer, schema: ProtocolDatatype[]): unknown[] {
        const retObj = []
        let buffer = buff

        for (const dt of schema) {
            switch(dt) {
                default:
                    throw new Error("Unknown protocol datatype enum!")
                case ProtocolDatatype.UBYTE:
                    (() => {
                        const res = Protocol.readUByte(buffer)
                        buffer = res.newBuffer
                        retObj.push(res.value)
                    })()
                    break
                case ProtocolDatatype.BYTE:
                    (() => {
                        const res = Protocol.readByte(buffer)
                        buffer = res.newBuffer
                        retObj.push(res.value)
                    })()
                    break
                case ProtocolDatatype.BOOLEAN:
                    (() => {
                        const res = Protocol.readBoolean(buffer)
                        buffer = res.newBuffer
                        retObj.push(res.value)
                    })()
                    break
                case ProtocolDatatype.VARINT:
                    (() => {
                        const res = Protocol.readVarInt(buffer)
                        buffer = res.newBuffer
                        retObj.push(res.value)
                    })()
                    break
                case ProtocolDatatype.VARLONG:
                    (() => {
                        const res = Protocol.readVarLong(buffer)
                        buffer = res.newBuffer
                        retObj.push(res.value)
                    })()
                    break
                case ProtocolDatatype.STRING:
                    (() => {
                        const res = Protocol.readString(buffer)
                        buffer = res.newBuffer
                        retObj.push(res.value)
                    })()
                    break
                case ProtocolDatatype.ARRAY:
                    (() => {
                        const res = Protocol.readArray(buffer)
                        buffer = res.newBuffer
                        retObj.push(res.value)
                    })()
                    break
                case ProtocolDatatype.MAP:
                    (() => {
                        const res = Protocol.readMap(buffer)
                        buffer = res.newBuffer
                        retObj.push(res.value)
                    })()
                    break
                case ProtocolDatatype.BYTE_ARRAY:
                    (() => {
                        const res = Protocol.readByteArray(buffer)
                        buffer = res.newBuffer
                        retObj.push(res.value)
                    })()
                    break
                case ProtocolDatatype.COMPLEX:
                    (() => {
                        const res = Protocol.readComplex(buffer)
                        buffer = res.newBuffer
                        retObj.push(res.value)
                    })()
                    break
            }
        }
        return retObj
    }

    export function reverseEndianess(buff: Buffer): Buffer { return buff.reverse() }

    export function writeUByte(byte: number): Buffer {
        const buff = Buffer.alloc(1)
        buff.writeUint8(byte)
        return buff
    }

    export function readUByte(buff: Buffer): ReadResult<number> {
        return {
            newBuffer: buff.subarray(1),
            value: buff.readUint8()
        }
    }

    export function writeByte(byte: number): Buffer {
        const buff = Buffer.alloc(1)
        buff.writeInt8(byte)
        return buff
    }

    export function readByte(buff: Buffer): ReadResult<number> {
        return {
            newBuffer: buff.subarray(1),
            value: buff.readInt8()
        }
    }

    export function writeBoolean(bool: boolean): Buffer {
        return Buffer.from([bool ? 0x01 : 0x00])
    }

    export function readBoolean(buff: Buffer): ReadResult<boolean> {
        return {
            newBuffer: buff.subarray(1),
            value: buff[0] == 0x01 ? true : false
        }
    }

    /* NOTE: interpret bitfields with classes implementing this interface */
    export interface Bitfield {
        from(bitfield: Buffer | number, offset?: number): this
        toBuffer(): Buffer
    }

    export function writeVarInt(num: number): Buffer {
        return Buffer.from(varint.encode(num))
    }

    export function readVarInt(buff: Buffer): ReadResult<number> & { readBytes: number } {
        const rr = varint.decode(buff)
        return {
            newBuffer: buff.subarray(varint.decode.bytes),
            readBytes: varint.decode.bytes!, 
            value: rr
        }
    }

    export function writeVarLong(num: number): Buffer {
        return Protocol.writeVarInt(num)
    }

    export function readVarLong(buff: Buffer): ReadResult<number> & { readBytes: number } {
        return Protocol.readVarInt(buff)
    }

    export function writeString(str: string): Buffer {
        const bufferized = Buffer.from(str), len = Protocol.writeVarInt(bufferized.length)
        return Buffer.concat([len, bufferized])
    }

    export function readString(buff: Buffer): ReadResult<string> {
        const len = Protocol.readVarInt(buff), str = len.newBuffer.subarray(0, len.value)
        return {
            newBuffer: len.newBuffer.subarray(len.value),
            value: str.toString()
        }
    }

    export function writeArray(data: Buffer[]): Buffer {
        let buff = Buffer.alloc(0)
        for (const value of data) {
            buff = Buffer.concat([buff, Protocol.writeVarInt(value.length), value])
        }
        buff = Buffer.concat([Protocol.writeVarInt(buff.length), buff])
        return buff
    }

    export function readArray(buff: Buffer): ReadResult<Buffer[]> {
        const totalLen = Protocol.readVarInt(buff), ret: Buffer[] = []
        let arrayBuff = totalLen.newBuffer.subarray(0, totalLen.value)
        while (true) {
            if (arrayBuff.length <= 0) break
            const elementLen = Protocol.readVarInt(arrayBuff)
            ret.push(elementLen.newBuffer.subarray(0, elementLen.value))
            arrayBuff = elementLen.newBuffer.subarray(elementLen.value)
        }
        return {
            newBuffer: buff.subarray(totalLen.value),
            value: ret
        }
    }

    export function writeMap(map: { [k: string]: Buffer } | Map<string, Buffer>): Buffer {
        const obj = map instanceof Map ? map.entries() : Object.entries(map)
        let buff = Buffer.alloc(0)
        for (const [k, v] of obj) {
            buff = Buffer.concat([buff, Protocol.writeString(k), Protocol.writeVarInt((v as Buffer).length), v])
        }
        buff = Buffer.concat([Protocol.writeVarInt(buff.length), buff])
        return buff
    }

    export function readMap(buff: Buffer): ReadResult<{ [k: string]: Buffer }> {
        let mapLen = Protocol.readVarInt(buff), 
            mapBuff = mapLen.newBuffer.subarray(0, mapLen.value),
            retObj = {}

        while (true) {
            if (mapBuff.length <= 0) break
            const name = Protocol.readString(mapBuff),
                dataLen = Protocol.readVarInt(name.newBuffer),
                value = dataLen.newBuffer.subarray(0, dataLen.value)
            // @ts-expect-error
            retObj[name.value] = value
            mapBuff = dataLen.newBuffer.subarray(dataLen.value)
        }    
        return {
            newBuffer: mapLen.newBuffer.subarray(mapLen.value),
            value: retObj
        }
    }

    export function writeByteArray(bytes: Buffer): Buffer {
        return Buffer.concat([Protocol.writeVarInt(bytes.length), bytes])
    }

    export function readByteArray(buff: Buffer): ReadResult<Buffer> {
        const buffLen = Protocol.readVarInt(buff), data = buffLen.newBuffer.subarray(0, buffLen.value)
        return {
            newBuffer: buffLen.newBuffer.subarray(buffLen.value),
            value: data
        }
    }

    export function writeComplex(obj: Object | Map<string, unknown>): Buffer {
        const object = msgpack.encode(obj instanceof Map ? Object.fromEntries(obj.entries()) : obj)
        return Buffer.concat([Protocol.writeVarInt(object.length), object])
    }

    export function readComplex(buff: Buffer): ReadResult<Object> {
        const complexLen = Protocol.readVarInt(buff), obj = msgpack.decode(complexLen.newBuffer.subarray(0, complexLen.value))
        return {
            newBuffer: complexLen.newBuffer.subarray(complexLen.value),
            value: obj
        }
    }
}