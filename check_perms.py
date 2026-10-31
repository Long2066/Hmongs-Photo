import oci
import time

config = oci.config.from_file()
agent_client = oci.compute_instance_agent.ComputeInstanceAgentClient(config)
inst_id = "ocid1.instance.oc1.ap-singapore-1.anzwsljr3epcpnac5v2gfnnn73idx6koglvtto6za74ltwnpnmahbk2clpea"
tenancy = config["tenancy"]

script = """#!/bin/bash
echo "=== PERMISSIONS OF /home/ubuntu ==="
ls -ld /home/ubuntu
ls -ld /home/ubuntu/.ssh 2>&1 || true
ls -la /home/ubuntu/.ssh/authorized_keys 2>&1 || true

echo "=== CAN WE APPEND TO authorized_keys? ==="
echo "" >> /home/ubuntu/.ssh/authorized_keys 2>&1 && echo "SUCCESS: WRITABLE!" || echo "FAILED: NOT WRITABLE"

echo "=== CHECK OTHER SERVICES / WEB SERVERS ==="
ps aux | grep -E "nginx|caddy|apache" | grep -v grep || echo "No reverse proxy running"
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

for i in range(10):
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
