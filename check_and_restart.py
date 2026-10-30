import oci
import time

config = oci.config.from_file()
agent_client = oci.compute_instance_agent.ComputeInstanceAgentClient(config)
inst_id = "ocid1.instance.oc1.ap-singapore-1.anzwsljr3epcpnac5v2gfnnn73idx6koglvtto6za74ltwnpnmahbk2clpea"
tenancy = config["tenancy"]

script = """#!/bin/bash
DIR="/var/lib/ocarun/cliproxyapi"
cd "$DIR"

echo "=== 1. PROCESS INFO ==="
PID=$(pgrep -f "cli-proxy-api" | head -n 1)
echo "PID: $PID"
if [ -n "$PID" ]; then
    echo "CMDLINE: $(tr '\\0' ' ' < /proc/$PID/cmdline)"
    echo "CWD: $(readlink /proc/$PID/cwd)"
fi

echo "=== 2. CPA.LOG CUOI CUNG ==="
tail -n 40 "$DIR/cpa.log"

echo "=== 3. RESTART CLIPROXYAPI VOI FILE STATIC MOI ==="
pkill -f "cli-proxy-api" 2>/dev/null || true
sleep 1
nohup "$DIR/cli-proxy-api" --config "$DIR/config.yaml" --no-browser </dev/null >"$DIR/cpa.log" 2>&1 &
sleep 2

echo "=== 4. TEST LAI SAU KHI RESTART ==="
echo "--- /healthz ---"
curl -sI http://127.0.0.1:9000/healthz | head -n 3

echo "--- /management.html ---"
curl -sI http://127.0.0.1:9000/management.html | head -n 5

echo "--- LOG MOI ---"
tail -n 20 "$DIR/cpa.log"
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
print("Dang kiem tra log va restart de cap nhat...")

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
                print(full.content.text or "")
                break
    except Exception as e:
        pass
