export default class Logger {
    public name?: string
    
    constructor(name: string) {
        this.name = name
    }

    public info(data: Stringable): void {
        process.stdout.write(`[INFO] [${this.name!}] ${data.toString()}\n`)
    }

    public warn(data: Stringable): void {
        process.stdout.write(`[WARN] [${this.name!}] ${data.toString()}\n`)
    }

    public error(data: Stringable): void {
        process.stdout.write(`[ERROR] [${this.name!}] ${data.toString()}\n`)
    }
}

export type Stringable = {
    toString: () => string
} | string