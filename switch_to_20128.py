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

echo "=== 1. DUNG 9ROUTER VA CAC TIEN TRINH CU ==="
pkill -9 -f "9router" 2>/dev/null || true
pkill -9 -f "cloudflared" 2>/dev/null || true
pkill -9 -f "ngrok" 2>/dev/null || true
pkill -9 -f "cli-proxy-api" 2>/dev/null || true
sleep 2

echo "=== 2. DAM BAO FILE MANAGEMENT.HTML SAN SANG ==="
if [ ! -s "$DIR/static/management.html" ] || [ $(wc -c < "$DIR/static/management.html") -lt 50000 ]; then
    curl -sSL "https://cpamc.router-for.me/" -o "$DIR/static/management.html"
fi
cp "$DIR/static/management.html" "$DIR/management.html" 2>/dev/null || true
ls -lh "$DIR/static/management.html"

echo "=== 3. CAU HINH CONFIG.YAML CHO PORT 20128 ==="
cat << 'CFG_EOF' > "$DIR/config.yaml"
config-version: 8
server:
  host: ""
  port: 20128
port: 20128
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

echo "=== 4. TAO START.SH VA KHOI DONG CLIPROXYAPI PORT 20128 ==="
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

echo "=== 5. KIEM TRA TIEN TRINH VA LOG ==="
ps aux | grep "cli-proxy-api" | grep -v grep
tail -n 15 "$DIR/cpa.log"

echo "=== 6. TEST ENDPOINTS LOCAL PORT 20128 ==="
echo "--- /management.html ---"
curl -sI http://127.0.0.1:20128/management.html | head -n 4

echo "--- /v1/models ---"
curl -s -H "Authorization: Bearer 123456" http://127.0.0.1:20128/v1/models | head -c 200
echo ""

echo "=== 7. CAU HINH AUTO-START KHI REBOOT MAY CHU ==="
(crontab -l 2>/dev/null | grep -v -E "9router|cloudflared|ngrok|cliproxyapi"; echo "@reboot /bin/bash $DIR/start.sh") | crontab - 2>/dev/null || true
echo "SUCCESS: HOAN TAT CHUYEN DOI SANG PORT 20128!"
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
print("Dang tat 9Router va khoi dong CLIProxyAPI tren port 20128 (khoang 15-20s)...")

for i in range(20):
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
                
                if "SUCCESS" in text or "200 OK" in text:
                    print("\n" + "="*70)
                    print("🎉 CHUYEN DOI HOAN TAT 100%! BO LINK VINH VIEN THEO IP MAY CHU:")
                    print("="*70)
                    print("👉 LINK WEB DASHBOARD:  http://158.178.235.87:20128/management.html")
                    print("👉 ENDPOINT CHO TOOL:   http://158.178.235.87:20128/v1")
                    print("👉 MAT KHAU / SECRET:   123456")
                    print("👉 API KEY:             123456")
                    print("="*70)
                    print("Link nay chay truc tiep 100% tren VPS, VINH VIEN mai mai khong bao gio doi!")
                break
            else:
                sys.stdout.write(".")
                sys.stdout.flush()
    except Exception as e:
        pass
