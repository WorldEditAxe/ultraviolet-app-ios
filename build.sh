SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
echo "--- Starting ultraviolet-app-ios build ---"
echo "--- Building Utilities ---"
echo "Installing required build npm modules..."
npm i -g typescript babel-minify rollup
echo "--- Downloading Proxy ---"
git clone "https://github.com/titaniumnetwork-dev/Ultraviolet-App" ultraviolet
echo "--- Dependencies ---"
echo "--> Proxy"
cd "$SCRIPT_DIR/ultraviolet"
npm i
echo "--> Forwarder Agent"
cd "$SCRIPT_DIR/forwarder-agent"
npm i
echo "--> Forwarder iOS Backend"
cd "$SCRIPT_DIR/forwarder-ios-backend"
npm i
echo "--- Building ---"
echo "Creating build folder..."
[[ -d "$SCRIPT_DIR/out" ]] && rm -rf "$SCRIPT_DIR/out"
mkdir ""
cp -r "$SCRIPT_DIR/template/index" "$SCRIPT_DIR/out" 
echo "--> Proxy"
cd "$SCRIPT_DIR/ultraviolet"
tsc
echo "--> Forwarder Agent"
cd "$SCRIPT_DIR/forwarder-agent"
tsc
cp -r "$SCRIPT_DIR/forwarder-agent/build" "$SCRIPT_DIR/out/agent"
echo "--> Forwarder iOS Backend"
cd "$SCRIPT_DIR/forwarder-ios-backend"
tsc