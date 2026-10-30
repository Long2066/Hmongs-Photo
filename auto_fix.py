import oci
import time

config = oci.config.from_file()
compute_client = oci.core.ComputeClient(config)
agent_client = oci.compute_instance_agent.ComputeInstanceAgentClient(config)

inst_id = "ocid1.instance.oc1.ap-singapore-1.anzwsljr3epcpnac5v2gfnnn73idx6koglvtto6za74ltwnpnmahbk2clpea"
pub_key = "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQClWTXEgGl5xK8RMZJ/wDLIcvRpQ9URgP4pU6qNCO6fOMpVOfp2wH4SsUjDIjY6v8cP5iy6cDeL7CIsPDI5xASVHtjDCKaq7/ED6LMbLhIY88ipLHpNg9rG63tDrtZmMO2baG+H2NTFeDbtZy9l8Fws4nr85M3jutSw2b9n1Mfhs0r3xKqERKGugsI5joSZdBU+JRmFkDOOI0lboDtVeAxVBUY5II/sgfOYdjjD3kWcHophOM2XsWVvpJ8cNLdJezMUodoaHY2bA/wVP4T2bFXB4B/ccwCb0uU4+EndA8h9DK0DfqIWG1JWvC5NF9wyNb/98Rtsxhn98DQKnWn4Tkt3 rsa-key-20261030"

print("=== 1. KIEM TRA THONG TIN MAY CHU ===")
inst = compute_client.get_instance(inst_id).data
print(f"Ten: {inst.display_name}, Trang thai: {inst.lifecycle_state}")

# Kiem tra Agent Config
ac = inst.agent_config
print("Agent Config hien tai:")
print(f"  Management Disabled: {getattr(ac, 'is_management_disabled', None)}")
plugins = getattr(ac, 'plugins_config', []) or []
for p in plugins:
    print(f"  Plugin: {p.name} -> {p.desired_state}")

print("\n=== 2. BAT PLUGIN RUN COMMAND & CAP NHAT SSH KEY METADATA ===")
meta = inst.metadata or {}
curr_keys = meta.get("ssh_authorized_keys", "")
if pub_key not in curr_keys:
    meta["ssh_authorized_keys"] = (curr_keys + "\n" + pub_key).strip()

agent_update = oci.core.models.UpdateInstanceAgentConfigDetails(
    is_management_disabled=False,
    is_monitoring_disabled=False,
    plugins_config=[
        oci.core.models.InstanceAgentPluginConfigDetails(
            name="Compute Instance Run Command",
            desired_state="ENABLED"
        ),
        oci.core.models.InstanceAgentPluginConfigDetails(
            name="Compute Instance Monitoring",
            desired_state="ENABLED"
        )
    ]
)

up_details = oci.core.models.UpdateInstanceDetails(
    agent_config=agent_update,
    metadata=meta
)

try:
    up_resp = compute_client.update_instance(inst_id, up_details)
    print("-> CAP NHAT CAU HINH MAY CHU THANH CONG!")
except Exception as e:
    print("Loi cap nhat instance:", e)

print("\n=== 3. KIEM TRA LENH DA GUI TRUOC DO ===")
cmd_id = "ocid1.instanceagentcommand.oc1.ap-singapore-1.amaaaaaa3epcpnaaz2h6bmzq6p3bqxxq2lz5gyyhpyspq73ikwla57hd2nwa"
try:
    execs = agent_client.list_instance_agent_command_executions(cmd_id, compartment_id=config["tenancy"]).data
    if not execs:
        print("Agent chua lay lenh cmd_id nay.")
    for e in execs:
        print(f"Trang thai lenh: {e.lifecycle_state}, Delivery: {e.delivery_state}")
except Exception as e:
    print("Loi kiem tra cmd:", e)

print("\n=== 4. PHAT LENH NAP KHOA TRUC TIEP QUA AGENT ===")
m = oci.compute_instance_agent.models
script = f"""#!/bin/bash
mkdir -p /home/ubuntu/.ssh /home/opc/.ssh /root/.ssh
echo '{pub_key}' >> /home/ubuntu/.ssh/authorized_keys
echo '{pub_key}' >> /home/opc/.ssh/authorized_keys
echo '{pub_key}' >> /root/.ssh/authorized_keys
chown -R ubuntu:ubuntu /home/ubuntu/.ssh 2>/dev/null || true
chown -R opc:opc /home/opc/.ssh 2>/dev/null || true
chmod 700 /home/ubuntu/.ssh /home/opc/.ssh /root/.ssh 2>/dev/null || true
chmod 600 /home/ubuntu/.ssh/authorized_keys /home/opc/.ssh/authorized_keys /root/.ssh/authorized_keys 2>/dev/null || true
iptables -I INPUT 1 -p tcp --dport 8317 -j ACCEPT
iptables -I INPUT 1 -p tcp --dport 80 -j ACCEPT
netfilter-persistent save 2>/dev/null || true
firewall-cmd --add-port=8317/tcp --permanent 2>/dev/null || true
firewall-cmd --add-port=80/tcp --permanent 2>/dev/null || true
firewall-cmd --reload 2>/dev/null || true
echo "SUCCESS_SSH_KEY_INJECTED"
"""

source = m.InstanceAgentCommandSourceViaTextDetails(source_type="TEXT", text=script)
content = m.InstanceAgentCommandContent(source=source)
target = m.InstanceAgentCommandTarget(instance_id=inst_id)
details = m.CreateInstanceAgentCommandDetails(compartment_id=config["tenancy"], execution_time_out_in_seconds=120, target=target, content=content)
new_cmd = agent_client.create_instance_agent_command(details)
print(f"-> LENH NAP KHOA MOI DA PHAT DI! ID: {new_cmd.data.id}")
print("\nCho 15 giay de Agent thuc thi...")
time.sleep(15)

try:
    exs = agent_client.list_instance_agent_command_executions(new_cmd.data.id, compartment_id=config["tenancy"]).data
    for ex in exs:
        print(f"Ket qua: {ex.lifecycle_state}")
except Exception as e:
    pass
print("\n=== HOAN TAT! ===")
