import IPacket from "../../IPacket.js";
import { Protocol } from "../../protocol.js";

export class CCAckConnectionOpenPacket implements IPacket {
    id: number = 0x01
    boundTo: "CLIENT" | "SERVER" = "SERVER"

    channelId?: number

    from(buff: Buffer): this {
        this.channelId = Protocol.readVarInt(buff).value
        return this
    }

    to(): Buffer {
        return Protocol.writeVarInt(this.channelId!)
    }
}