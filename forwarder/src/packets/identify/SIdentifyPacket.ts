import IPacket from "../../IPacket.js";
import { Protocol } from "../../protocol.js";

export default class SIdentifyPacket implements IPacket {
    id: number = 0x00
    boundTo: "CLIENT" | "SERVER" = "SERVER"

    branding?: string
    protoVer?: number

    from(buff: Buffer): this {
        const readResult = Protocol.bulkRead(buff, [Protocol.ProtocolDatatype.STRING, Protocol.ProtocolDatatype.VARINT])
        this.branding = readResult[0] as string
        this.protoVer = readResult[1] as number
        return this
    }

    to(): Buffer {
        return Protocol.bulkWrite([
            this.branding!,
            this.protoVer!
        ], [
            Protocol.ProtocolDatatype.STRING,
            Protocol.ProtocolDatatype.VARINT
        ])
    }
}