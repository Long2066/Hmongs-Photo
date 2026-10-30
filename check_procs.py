import oci
import time

config = oci.config.from_file()
agent_client = oci.compute_instance_agent.ComputeInstanceAgentClient(config)
inst_id = "ocid1.instance.oc1.ap-singapore-1.anzwsljr3epcpnac5v2gfnnn73idx6koglvtto6za74ltwnpnmahbk2clpea"
tenancy = config["tenancy"]

script = """#!/bin/bash
echo "=== PROCESSES RUNNING ON 83 AND 20128 ==="
ps -ef | grep -E "83|20128|router|webchat|uvicorn|docker" | grep -v grep

echo "=== DOCKER CONTAINERS ==="
docker ps 2>/dev/null || echo "No docker or permission denied"

echo "=== WHERE IS WEBCHAT / 9ROUTER INSTALLED ==="
ls -la /root/ 2>/dev/null || ls -la /home/ubuntu/ 2>/dev/null || echo "Cannot list home"
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
                print(full.content.text)
                break
    except Exception as e:
        pass
