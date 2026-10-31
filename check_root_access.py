import oci
import time

config = oci.config.from_file()
agent_client = oci.compute_instance_agent.ComputeInstanceAgentClient(config)
inst_id = "ocid1.instance.oc1.ap-singapore-1.anzwsljr3epcpnac5v2gfnnn73idx6koglvtto6za74ltwnpnmahbk2clpea"
tenancy = config["tenancy"]

script = """#!/bin/bash
echo "=== 1. USER & GROUPS ==="
id
groups

echo "=== 2. SUDO PERMISSIONS ==="
sudo -n -l 2>&1 || echo "sudo -n failed"

echo "=== 3. SUDOERS FILES ==="
ls -la /etc/sudoers.d/ 2>&1 || true

echo "=== 4. CHECK IPTABLES & UFW ==="
which ufw
ufw status 2>&1 || true
which iptables
iptables -L -n 2>&1 || true

echo "=== 5. CHECK 9ROUTER AND MITM ==="
ps aux | grep -E "9router|mitm" | grep -v grep
ls -la /home/ubuntu/.9router/runtime/mitm/ 2>&1 || true

echo "=== 6. CHECK WEBCHAT2API ==="
ls -la /home/ubuntu/webchat2api/ 2>&1 || true

echo "=== 7. CHECK ORACLE CLOUD AGENT USER DATA / SCRIPTS ==="
ls -la /var/lib/oracle-cloud-agent/ 2>&1 || true
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
print("Dang kiem tra quyen quan tri va tuong lua tren VPS (khoang 10-15s)...")

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
                print("\n" + "="*50)
                print(full.content.text or "")
                print("="*50)
                break
    except Exception as e:
        pass
