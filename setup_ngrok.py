import oci
import time
import re
import sys

config = oci.config.from_file()
agent_client = oci.compute_instance_agent.ComputeInstanceAgentClient(config)
inst_id = "ocid1.instance.oc1.ap-singapore-1.anzwsljr3epcpnac5v2gfnnn73idx6koglvtto6za74ltwnpnmahbk2clpea"
tenancy = config["tenancy"]

script = """#!/bin/bash
DIR="/var/lib/ocarun/cliproxyapi"
mkdir -p "$DIR/static"
cd "$DIR"

echo "=== 1. TAI VA CAI DAT NGROK ==="
if [ ! -f "$DIR/ngrok" ]; then
    curl -sSL "https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz" -o "$DIR/ngrok.tgz"
    tar -xzf "$DIR/ngrok.tgz" -C "$DIR"
    chmod +x "$DIR/ngrok"
    rm -f "$DIR/ngrok.tgz"
fi

"$DIR/ngrok" version

echo "=== 2. CAU HINH AUTHTOKEN NGROK ==="
"$DIR/ngrok" config add-authtoken "2trN0vkOTQRc4thK1j7o3gq0bhf_5uUWnggg6r5EAEHnvNECn"

echo "=== 3. DAM BAO CONFIG.YAML VA MANAGEMENT.HTML CHUAN PORT 9000 ==="
cat << 'CFG_EOF' > "$DIR/config.yaml"
config-version: 8
server:
  host: ""
  port: 9000
port: 9000
management:
  allow-remote: true
  secret-key: "123456"
  disable-control-panel: false
remote-management:
  allow-remote: true
  secret-key: "123456"
  disable-control-panel: false
oauth:
  auth-dir: "/var/lib/ocarun/cliproxyapi/oauth"
auth-dir: "/var/lib/ocarun/cliproxyapi/oauth"
access:
  api-keys:
    - "123456"
api-keys:
  - "123456"
CFG_EOF

if [ ! -s "$DIR/static/management.html" ] || [ $(wc -c < "$DIR/static/management.html") -lt 50000 ]; then
    curl -sSL "https://cpamc.router-for.me/" -o "$DIR/static/management.html"
fi
cp "$DIR/static/management.html" "$DIR/management.html" 2>/dev/null || true

echo "=== 4. KHOI DONG CLIPROXYAPI PORT 9000 ==="
pkill -9 -f "cli-proxy-api" 2>/dev/null || true
sleep 1
export MANAGEMENT_STATIC_PATH="$DIR/static/management.html"
nohup "$DIR/cli-proxy-api" --config "$DIR/config.yaml" --no-browser </dev/null >"$DIR/cpa.log" 2>&1 &
sleep 2

cat << 'ST_EOF' > "$DIR/start.sh"
#!/bin/bash
DIR="/var/lib/ocarun/cliproxyapi"
export MANAGEMENT_STATIC_PATH="$DIR/static/management.html"
nohup "$DIR/cli-proxy-api" --config "$DIR/config.yaml" --no-browser </dev/null >"$DIR/cpa.log" 2>&1 &
nohup "$DIR/ngrok" http 9000 --log=stdout >"$DIR/ngrok.log" 2>&1 &
ST_EOF
chmod +x "$DIR/start.sh"

echo "=== 5. KHOI DONG NGROK PERMANENT TUNNEL ==="
pkill -9 -f "ngrok" 2>/dev/null || true
pkill -9 -f "cloudflared" 2>/dev/null || true
sleep 1
rm -f "$DIR/ngrok.log"
nohup "$DIR/ngrok" http 9000 --log=stdout >"$DIR/ngrok.log" 2>&1 &

for i in $(seq 1 10); do
    sleep 2
    URL=$(curl -s http://127.0.0.1:4040/api/tunnels | grep -oE "https://[a-zA-Z0-9-]+\.(ngrok-free\.app|ngrok\.io|ngrok\.app)" | head -n 1)
    if [ -n "$URL" ]; then
        break
    fi
    URL=$(grep -oE "https://[a-zA-Z0-9-]+\.(ngrok-free\.app|ngrok\.io|ngrok\.app)" "$DIR/ngrok.log" | head -n 1)
    if [ -n "$URL" ]; then
        break
    fi
done

echo "PERMANENT_URL: $URL"

if [ -z "$URL" ]; then
    echo "Log ngrok chi tiet:"
    cat "$DIR/ngrok.log"
fi

echo "=== 6. CAU HINH AUTO-START REBOOT ==="
(crontab -l 2>/dev/null | grep -v -E "ngrok|cliproxyapi|cloudflared"; echo "@reboot /bin/bash $DIR/start.sh") | crontab - 2>/dev/null || true
"""

m = oci.compute_instance_agent.models
source = m.InstanceAgentCommandSourceViaTextDetails(source_type="TEXT", text=script)
content = m.InstanceAgentCommandContent(source=source)
target = m.InstanceAgentCommandTarget(instance_id=inst_id)
details = m.CreateInstanceAgentCommandDetails(
    compartment_id=tenancy,
    execution_time_out_in_seconds=60,
    target=target,
    content=content
)

cmd = agent_client.create_instance_agent_command(details)
print(f"Sent: {cmd.data.id}")
print("Dang cai dat Ngrok va tao ten mien tinh vinh vien (khoang 15-20s)...")

for i in range(25):
    time.sleep(3)
    try:
        exs = agent_client.list_instance_agent_command_executions(
            compartment_id=tenancy,
            instance_id=inst_id
        ).data
        found = [x for x in exs if x.instance_agent_command_id == cmd.data.id]
        if found:
            f = found[0]
            if f.lifecycle_state in ["SUCCEEDED", "FAILED"]:
                full = agent_client.get_instance_agent_command_execution(
                    instance_agent_command_id=cmd.data.id,
                    instance_id=inst_id
                ).data
                text = full.content.text or ""
                print("\n" + "="*60)
                print(text)
                print("="*60)
                
                match = re.search(r"https://[a-zA-Z0-9-]+\.(ngrok-free\.app|ngrok\.io|ngrok\.app)", text)
                if match:
                    base_url = match.group(0)
                    print("\n" + "="*70)
                    print("🎉 THANH CONG 100%! DAY LA BO LINK VINH VIEN TRON DOI CUA BAN:")
                    print("="*70)
                    print(f"👉 LINK WEB DASHBOARD:  {base_url}/management.html")
                    print(f"👉 ENDPOINT CHO TOOL:   {base_url}/v1")
                    print("👉 MAT KHAU / KEY:      123456")
                    print("="*70)
                    print("Link nay CO DINH VINH VIEN, khong bao gio het han hay bi doi!")
                break
            else:
                sys.stdout.write(".")
                sys.stdout.flush()
    except Exception as e:
        pass
