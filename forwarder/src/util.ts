import config from "./config.js"
import http from "http"
import { URL } from "url";
import { UpgradeErrorCode } from "./enums.js";
import { UpgradeFailure } from "./structs.js";

export namespace HTTPUtil {
    export async function route(req: http.IncomingMessage, res: http.ServerResponse) {
        const url = new URL(req.url!, `http://${req.headers.host}`)
        if (HTTPUtil.isGatewayConnectionAttempt(url)) {
            if ((req.headers["sec-gateway-auth"] == config.password && config.password) || !config.password) {
                
            } else {
                res.writeHead(401)
                    .end(JSON.stringify({
                        error: UpgradeErrorCode.ERR_AUTH_FAIL,
                        message: "Authentication was either missing or incorrect."
                    } as UpgradeFailure))
            }
        } else {

        }
    }

    export function isGatewayConnectionAttempt(route: URL): boolean {
        return route.pathname == `/gateway/${Math.floor(Date.now() / 10000)}`
    }
}