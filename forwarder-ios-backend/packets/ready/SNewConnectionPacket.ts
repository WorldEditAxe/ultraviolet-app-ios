import IPacket from "../../IPacket.js";
import { Protocol } from "../../protocol.js";

export default class SNewConnectionPacket implements IPacket {
    id: number = 0x00
    boundTo: "CLIENT" | "SERVER" = "CLIENT"

    ip?: string
    port?: number
    channelId?: number

    from(buff: Buffer): this {
        const read = Protocol.bulkRead(buff, [
            Protocol.ProtocolDatatype.STRING,
            Protocol.ProtocolDatatype.VARINT,
            Protocol.ProtocolDatatype.VARINT
        ])
        this.ip = read[0] as string
        this.port = read[1] as number
        this.channelId = read[2] as number
        return this
    }

    to(): Buffer {
        return Protocol.bulkWrite([
            this.ip!,
            this.port!,
            this.channelId!
        ], [
            Protocol.ProtocolDatatype.STRING,
            Protocol.ProtocolDatatype.VARINT,
            Protocol.ProtocolDatatype.VARINT
        ])
    }
}