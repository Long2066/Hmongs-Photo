import oci
import time

config = oci.config.from_file()
agent_client = oci.compute_instance_agent.ComputeInstanceAgentClient(config)

inst_id = "ocid1.instance.oc1.ap-singapore-1.anzwsljr3epcpnac5v2gfnnn73idx6koglvtto6za74ltwnpnmahbk2clpea"
tenancy = config["tenancy"]

script = """#!/bin/bash
echo "=== USER INFO ==="
id
whoami
echo "HOME: $HOME"
pwd

echo "=== SUDO TEST ==="
sudo -n true 2>&1 || echo "sudo failed without password"

echo "=== SUDOERS.D ==="
ls -la /etc/sudoers.d/ 2>&1

echo "=== TEST NETWORK DOWNLOAD ==="
curl -sI "https://github.com" | head -n 2

echo "=== START TEST LISTENER ON 8317 ==="
python3 -m http.server 8317 &
PID=$!
sleep 2
echo "Python server PID: $PID"
curl -sI http://127.0.0.1:8317 | head -n 1
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
print(f"Sent probe command: {cmd.data.id}")

for i in range(12):
    time.sleep(4)
    try:
        exs = agent_client.list_instance_agent_command_executions(
            compartment_id=tenancy,
            instance_id=inst_id
        ).data
        found = [x for x in exs if x.instance_agent_command_id == cmd.data.id]
        if found:
            f = found[0]
            print(f"Status: {f.lifecycle_state}")
            if f.lifecycle_state in ["SUCCEEDED", "FAILED"]:
                full = agent_client.get_instance_agent_command_execution(
                    instance_agent_command_id=cmd.data.id,
                    instance_id=inst_id
                ).data
                print("\n--- OUTPUT ---")
                print(full.content.text)
                print("--------------")
                break
    except Exception as e:
        print("Wait...", e)
