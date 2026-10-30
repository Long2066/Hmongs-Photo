import oci
import time
import re

config = oci.config.from_file()
agent_client = oci.compute_instance_agent.ComputeInstanceAgentClient(config)
inst_id = "ocid1.instance.oc1.ap-singapore-1.anzwsljr3epcpnac5v2gfnnn73idx6koglvtto6za74ltwnpnmahbk2clpea"
tenancy = config["tenancy"]

script = """#!/bin/bash
DIR="/var/lib/ocarun/cliproxyapi"
cd "$DIR"

echo "=== 1. KIEM TRA FILE MANAGEMENT.HTML ==="
mkdir -p "$DIR/static"
if [ ! -s "$DIR/static/management.html" ]; then
    echo "Dang tai management.html tu GitHub release..."
    curl -sSL "https://github.com/router-for-me/CLIProxyAPI/releases/download/v8.0.47/management.html" -o "$DIR/static/management.html"
fi

if [ ! -s "$DIR/static/management.html" ]; then
    echo "Fallback tai tu Cli-Proxy-API-Management-Center..."
    curl -sSL "https://cpamc.router-for.me/" -o "$DIR/static/management.html"
fi

ls -lh "$DIR/static/management.html"

echo "=== 2. KIEM TRA CURL LOCAL PORT 9000 ==="
echo "--- /healthz ---"
curl -sI http://127.0.0.1:9000/healthz | head -n 3

echo "--- /management.html ---"
curl -sI http://127.0.0.1:9000/management.html | head -n 5

echo "--- /management (kiem tra xem co bi 404 khong) ---"
curl -sI http://127.0.0.1:9000/management | head -n 3

echo "=== 3. KIEM TRA CLOUDFLARED TUNNEL ==="
ps aux | grep "cloudflared" | grep -v grep
URL=$(grep -oE "https://[a-zA-Z0-9-]+\.trycloudflare\.com" "$DIR/tunnel.log" | tail -n 1)
echo "TUNNEL ACTIVE URL: $URL"

if [ -n "$URL" ]; then
    echo "--- Test truy cap qua Cloudflare /management.html ---"
    curl -sI "$URL/management.html" | head -n 5
fi
"""

m = oci.compute_instance_agent.models
source = m.InstanceAgentCommandSourceViaTextDetails(source_type="TEXT", text=script)
content = m.InstanceAgentCommandContent(source=source)
target = m.InstanceAgentCommandTarget(instance_id=inst_id)
details = m.CreateInstanceAgentCommandDetails(
    compartment_id=tenancy,
    execution_time_out_in_seconds=90,
    target=target,
    content=content
)
cmd = agent_client.create_instance_agent_command(details)
print(f"Sent command: {cmd.data.id}")
print("Dang xu ly kiem tra va cai dat giao dien Web Management...")

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
                print(f"\nTrang thai: {f.lifecycle_state}")
                print("--- KET QUA TU MAY CHU ---")
                print(full.content.text or "")
                break
    except Exception as e:
        pass
