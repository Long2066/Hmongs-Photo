import oci
import time

config = oci.config.from_file()
agent_client = oci.compute_instance_agent.ComputeInstanceAgentClient(config)
inst_id = "ocid1.instance.oc1.ap-singapore-1.anzwsljr3epcpnac5v2gfnnn73idx6koglvtto6za74ltwnpnmahbk2clpea"
tenancy = config["tenancy"]

script = """#!/bin/bash
echo "=== 1. SUDO CAPABILITIES ==="
sudo -n -l 2>&1

echo "=== 2. IPTABLES RULES IN FILE ==="
grep -E "ACCEPT" /etc/iptables/rules.v4 2>/dev/null || cat /etc/ufw/user.rules 2>/dev/null | grep ACCEPT || echo "Cannot read iptables files"

echo "=== 3. 1PANEL OR OPENRESTY CHECK ==="
ps aux | grep -E "1panel|openresty|nginx" | grep -v grep | head -n 5

echo "=== 4. CAN WE READ NGINX CONFIGS ==="
ls -la /www/server/nginx/conf/ 2>/dev/null || ls -la /opt/1panel/runtime/ 2>/dev/null || ls -la /etc/nginx/ 2>/dev/null
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
print(f"Sent check_firewall command: {cmd.data.id}")

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
                break
    except Exception as e:
        pass
