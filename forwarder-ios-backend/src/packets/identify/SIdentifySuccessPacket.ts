import IPacket from "../../IPacket.js";
import { Protocol } from "../../protocol.js";

export default class SIdentifySuccessPacket implements IPacket {
    id: number = 0x00
    boundTo: "CLIENT" | "SERVER" = "SERVER"

    branding?: string
    protoVer?: number
    url?: string

    from(buff: Buffer): this {
        const readResult = Protocol.bulkRead(buff, [Protocol.ProtocolDatatype.STRING, Protocol.ProtocolDatatype.VARINT, Protocol.ProtocolDatatype.STRING])
        this.branding = readResult[0] as string
        this.protoVer = readResult[1] as number
        this.url = readResult[2] as string
        return this
    }

    to(): Buffer {
        return Protocol.bulkWrite([
            this.branding!,
            this.protoVer!,
            this.url!
        ], [
            Protocol.ProtocolDatatype.STRING,
            Protocol.ProtocolDatatype.VARINT,
            Protocol.ProtocolDatatype.STRING
        ])
    }
}