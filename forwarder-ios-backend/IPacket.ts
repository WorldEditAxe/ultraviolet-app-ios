export default interface IPacket {
    id: number
    boundTo: 'CLIENT' | 'SERVER'

    from(buff: Buffer): this
    to(): Buffer
}