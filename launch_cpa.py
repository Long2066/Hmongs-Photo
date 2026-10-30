import oci
import time

config = oci.config.from_file()
agent_client = oci.compute_instance_agent.ComputeInstanceAgentClient(config)
inst_id = "ocid1.instance.oc1.ap-singapore-1.anzwsljr3epcpnac5v2gfnnn73idx6koglvtto6za74ltwnpnmahbk2clpea"
tenancy = config["tenancy"]

script = """#!/bin/bash
DIR="/var/lib/ocarun/cliproxyapi"
cd "$DIR"

# Kill old python test and old cli-proxy-api
kill 447326 2>/dev/null || true
pkill -9 -f "cli-proxy-api" 2>/dev/null || true
pkill -9 -f "http.server 8317" 2>/dev/null || true
sleep 1

# Start CLIProxyAPI with --no-browser
echo "=== KHOI DONG CLIPROXYAPI VOI --no-browser ==="
nohup "$DIR/cli-proxy-api" --config "$DIR/config.yaml" --no-browser </dev/null >"$DIR/cpa.log" 2>&1 &
PID=$!
sleep 3

echo "=== KIEM TRA PROCESS ==="
ps aux | grep "cli-proxy-api" | grep -v grep

echo "=== NOI DUNG LOG ==="
cat "$DIR/cpa.log" | tail -n 20

echo "=== TEST TRUY CAP MANAGEMENT TAI CHO ==="
curl -sI -m 3 http://127.0.0.1:9000/management | head -n 4

echo "=== HOAN TAT KHOI DONG ==="
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
print("Dang khoi dong CLIProxyAPI (10-15s)...")

for i in range(12):
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
                print("\n" + "="*50)
                print(full.content.text)
                print("="*50)
                print("\n👉 LINK WEB DANG CHAY TREN VPS:")
                print("http://158.178.235.87:9000/management")
                print("Secret Key: 123456 | API Key: 123456")
                print("="*50)
                break
    except Exception as e:
        pass
