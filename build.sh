SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
echo "--- Starting ultraviolet-app-ios build ---"
echo "Have you configured the config files forwarder-agent/src/config.ts and forwarder-ios-backend/src/config.ts? [enter = yes, ctrl + c = no]"
read -p "> "
echo "--- Building Utilities ---"
echo "Installing required build npm modules..."
npm i -g typescript babel-minify rollup
echo "--- Downloading Proxy ---"
[[ -d "$SCRIPT_DIR/ultraviolet" ]] && rm -rf "$SCRIPT_DIR/ultraviolet"
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
mkdir "$SCRIPT_DIR/out"
cp -r "$SCRIPT_DIR/template/." "$SCRIPT_DIR/out" 
echo "--> Proxy"
echo "---> Downloading Ultraviolet static site files..."
cd "$SCRIPT_DIR/out/temp/static"
git clone https://github.com/titaniumnetwork-dev/Ultraviolet-Static .
cp -r public/. "$SCRIPT_DIR/out/ios/public"
echo "---> Downloading prebuilt Ultraviolet script files..."
UV_DL=$(curl -s https://api.github.com/repos/titaniumnetwork-dev/Ultraviolet/releases/latest | grep browser_download_url | cut -d '"' -f 4)
UV_FN=$(curl -s https://api.github.com/repos/titaniumnetwork-dev/Ultraviolet/releases/latest | jq ".assets[0].name")
cd "$SCRIPT_DIR/out/temp/static"
wget "$UV_DL"

# TODO: download & move script files

cd "$SCRIPT_DIR/ultraviolet"
npm i "@rollup/plugin-commonjs" "@rollup/plugin-json" "@rollup/plugin-node-resolve"
cd src
cp "$SCRIPT_DIR/out/rollup.config.js" "."
npx rollup --config ./rollup.config.js --bundleConfigAsCjs
cp uv.js "$SCRIPT_DIR/out/ios/server"
echo "--> Forwarder Agent"
cd "$SCRIPT_DIR/forwarder-agent/build"
tsc
cp -r "$SCRIPT_DIR/forwarder-agent/build/." "$SCRIPT_DIR/out/agent"
echo "--> Forwarder iOS Backend"
cd "$SCRIPT_DIR/forwarder-ios-backend"
tsc
npm i "@rollup/plugin-commonjs" "@rollup/plugin-json" "@rollup/plugin-node-resolve"
cd "build"
cp "$SCRIPT_DIR/out/rollup.config.js" "."
sed -i "s/uv.js/forwarder.js/" "rollup.config.js"
npx rollup --config ./rollup.config.js --bundleConfigAsCjs
cp forwarder.js "$SCRIPT_DIR/out/ios/server"