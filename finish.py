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

echo "[1/6] Tai file giao dien management.html..."
curl -sSL "https://cpamc.router-for.me/" -o "$DIR/static/management.html"
if [ ! -s "$DIR/static/management.html" ] || [ $(wc -c < "$DIR/static/management.html") -lt 50000 ]; then
    echo "Fallback tai tu GitHub releases..."
    curl -sSL "https://github.com/router-for-me/Cli-Proxy-API-Management-Center/releases/download/v1.26.7/management.html" -o "$DIR/static/management.html"
fi
cp "$DIR/static/management.html" "$DIR/management.html" 2>/dev/null || true
ls -lh "$DIR/static/management.html"

echo "[2/6] Cap nhat config.yaml dong bo..."
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

echo "[3/6] Dung tien trinh cu..."
pkill -9 -f "cli-proxy-api" 2>/dev/null || true
pkill -9 -f "cloudflared" 2>/dev/null || true
sleep 2

echo "[4/6] Tao start.sh va khoi dong CLIProxyAPI..."
cat << 'ST_EOF' > "$DIR/start.sh"
#!/bin/bash
DIR="/var/lib/ocarun/cliproxyapi"
export MANAGEMENT_STATIC_PATH="$DIR/static/management.html"
nohup "$DIR/cli-proxy-api" --config "$DIR/config.yaml" --no-browser </dev/null >"$DIR/cpa.log" 2>&1 &
ST_EOF
chmod +x "$DIR/start.sh"

export MANAGEMENT_STATIC_PATH="$DIR/static/management.html"
nohup "$DIR/cli-proxy-api" --config "$DIR/config.yaml" --no-browser </dev/null >"$DIR/cpa.log" 2>&1 &
sleep 3

echo "[5/6] Kiem tra server local..."
curl -sI http://127.0.0.1:9000/management.html | head -n 4

echo "[6/6] Khoi dong Cloudflare Tunnel..."
rm -f "$DIR/tunnel.log"
nohup "$DIR/cloudflared" tunnel --url http://127.0.0.1:9000 </dev/null >"$DIR/tunnel.log" 2>&1 &

for i in $(seq 1 10); do
    sleep 2
    URL=$(grep -oE "https://[a-zA-Z0-9-]+\.trycloudflare\.com" "$DIR/tunnel.log" | tail -n 1)
    if [ -n "$URL" ]; then
        break
    fi
done

echo "=== PUBLIC TUNNEL URL: $URL ==="

# Cap nhat crontab @reboot
(crontab -l 2>/dev/null | grep -v -E "cliproxyapi|cloudflared"; echo "@reboot /bin/bash $DIR/start.sh"; echo "@reboot nohup $DIR/cloudflared tunnel --url http://127.0.0.1:9000 </dev/null >$DIR/tunnel.log 2>&1 &") | crontab - 2>/dev/null || true
"""

m = oci.compute_instance_agent.models
source = m.InstanceAgentCommandSourceViaTextDetails(source_type="TEXT", text=script)
content = m.InstanceAgentCommandContent(source=source)
target = m.InstanceAgentCommandTarget(instance_id=inst_id)
details = m.CreateInstanceAgentCommandDetails(
    compartment_id=tenancy,
    execution_time_out_in_seconds=120,
    target=target,
    content=content
)

cmd = agent_client.create_instance_agent_command(details)
print(f"Sent: {cmd.data.id}")
print("Dang dong bo toan dien, tai giao dien va khoi dong lai he thong (khoang 20-30s)...")

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
                print("\n" + "-"*50)
                print(text)
                print("-"*50)
                
                match = re.search(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com", text)
                if match:
                    base_url = match.group(0)
                    print("\n" + "="*65)
                    print("🎉 HE THONG CLIPROXYAPI DA HOAN TAT 100%!")
                    print("="*65)
                    print(f"👉 LINK WEB DASHBOARD:  {base_url}/management.html")
                    print(f"👉 ENDPOINT API:        {base_url}/v1")
                    print("👉 MAT KHAU / SECRET:   123456")
                    print("👉 API KEY:             123456")
                    print("="*65)
                    print("Ban co the nhap Link Web Dashboard vao trinh duyet de su dung ngay!")
                sys.exit(0)
            else:
                sys.stdout.write(".")
                sys.stdout.flush()
    except Exception as e:
        pass
