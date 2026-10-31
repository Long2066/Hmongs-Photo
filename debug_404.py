import oci
import time

config = oci.config.from_file()
agent_client = oci.compute_instance_agent.ComputeInstanceAgentClient(config)
inst_id = "ocid1.instance.oc1.ap-singapore-1.anzwsljr3epcpnac5v2gfnnn73idx6koglvtto6za74ltwnpnmahbk2clpea"
tenancy = config["tenancy"]

script = """#!/bin/bash
DIR="/var/lib/ocarun/cliproxyapi"
cd "$DIR"

echo "=== 1. CHECK FILE STATIC ==="
ls -la "$DIR/static" 2>&1
ls -la "$DIR/static/management.html" 2>&1
head -n 5 "$DIR/static/management.html" 2>&1

echo "=== 2. CHECK CPA.LOG ==="
tail -n 30 "$DIR/cpa.log"

echo "=== 3. CHECK ENVIRONMENT OF RUNNING CPA ==="
PID=$(pgrep -f "cli-proxy-api" | head -n 1)
echo "PID: $PID"
if [ -n "$PID" ]; then
    xargs -0 -L1 -a /proc/$PID/environ | grep -E "MANAGEMENT|CONFIG|PORT" || echo "No matching env"
fi
"""

m = oci.compute_instance_agent.models
source = m.InstanceAgentCommandSourceViaTextDetails(source_type="TEXT", text=script)
content = m.InstanceAgentCommandContent(source=source)
target = m.InstanceAgentCommandTarget(instance_id=inst_id)
details = m.CreateInstanceAgentCommandDetails(
    compartment_id=tenancy,
    execution_time_out_in_seconds=30,
    target=target,
    content=content
)

cmd = agent_client.create_instance_agent_command(details)

for i in range(12):
    time.sleep(2)
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
