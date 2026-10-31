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
cd "$DIR"

echo "=== 1. KIEM TRA TIEN TRINH CLIPROXYAPI ==="
ps aux | grep "cli-proxy-api" | grep -v grep || {
    echo "CLIProxyAPI dang dung, dang khoi dong lai..."
    export MANAGEMENT_STATIC_PATH="$DIR/static/management.html"
    nohup "$DIR/cli-proxy-api" --config "$DIR/config.yaml" --no-browser </dev/null >"$DIR/cpa.log" 2>&1 &
    sleep 2
}

echo "=== 2. TEST LOCAL PORT 9000 ==="
curl -sI -H "Authorization: Bearer 123456" http://127.0.0.1:9000/v1/models | head -n 3
curl -sI http://127.0.0.1:9000/management.html | head -n 3

echo "=== 3. KIEM TRA VA LAM MOI CLOUDFLARE TUNNEL ==="
# Cloudflare trycloudflare tunnel thuong tu dong het han sau 24h
# Khoi dong lai tunnel de luon co duong truyen song va lay URL moi nhat
pkill -f "cloudflared" 2>/dev/null || true
sleep 1
rm -f "$DIR/tunnel.log"
nohup "$DIR/cloudflared" tunnel --url http://127.0.0.1:9000 </dev/null >"$DIR/tunnel.log" 2>&1 &

for i in $(seq 1 12); do
    sleep 2
    URL=$(grep -oE "https://[a-zA-Z0-9-]+\.trycloudflare\.com" "$DIR/tunnel.log" | tail -n 1)
    if [ -n "$URL" ]; then
        break
    fi
done

echo "=== URL MOI DANG HOAT DONG ==="
echo "$URL"
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
print("Dang kiem tra trang thai VPS va lam moi duong truyen (khoang 15s)...")

for i in range(15):
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
                print("KET QUA KIEM TRA MAY CHU:")
                print("="*60)
                print(text)
                
                match = re.search(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com", text)
                if match:
                    base_url = match.group(0)
                    print("\n" + "="*65)
                    print("🎉 DUONG TRUYEN MOI DA SAN SANG:")
                    print("="*65)
                    print(f"👉 LINK WEB DASHBOARD:  {base_url}/management.html")
                    print(f"👉 ENDPOINT CHO TOOL:   {base_url}/v1")
                    print("👉 MAT KHAU / KEY:      123456")
                    print("="*65)
                break
    except Exception as e:
        pass
