import dotenv from "dotenv"
dotenv.config()

export default {
    // set to 0.0.0.0 to expose to internet
    bindIp: "0.0.0.0",
    // it is suggested that you bind to port 443 to mask the forwarder's traffic as HTTPS
    bindPort: 8080, 
    // can be set as null if forwarder is to be made public
    password: null,
    // if not routing behind NGINX, set your TLS cert + key here
    // must provide a cert data buffer, NOT the path
    tls: {
        key: null,
        cert: null
    }
}