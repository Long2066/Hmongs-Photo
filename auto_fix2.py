import oci
import time

config = oci.config.from_file()
compute_client = oci.core.ComputeClient(config)
agent_client = oci.compute_instance_agent.ComputeInstanceAgentClient(config)

inst_id = "ocid1.instance.oc1.ap-singapore-1.anzwsljr3epcpnac5v2gfnnn73idx6koglvtto6za74ltwnpnmahbk2clpea"
tenancy = config["tenancy"]
pub_key = "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQClWTXEgGl5xK8RMZJ/wDLIcvRpQ9URgP4pU6qNCO6fOMpVOfp2wH4SsUjDIjY6v8cP5iy6cDeL7CIsPDI5xASVHtjDCKaq7/ED6LMbLhIY88ipLHpNg9rG63tDrtZmMO2baG+H2NTFeDbtZy9l8Fws4nr85M3jutSw2b9n1Mfhs0r3xKqERKGugsI5joSZdBU+JRmFkDOOI0lboDtVeAxVBUY5II/sgfOYdjjD3kWcHophOM2XsWVvpJ8cNLdJezMUodoaHY2bA/wVP4T2bFXB4B/ccwCb0uU4+EndA8h9DK0DfqIWG1JWvC5NF9wyNb/98Rtsxhn98DQKnWn4Tkt3 rsa-key-20261030"

print("=== 1. LAY THONG TIN MAY CHU & SHAPE CONFIG ===")
inst = compute_client.get_instance(inst_id).data
ocpu = inst.shape_config.ocpus
ram = inst.shape_config.memory_in_gbs
print(f"May: {inst.display_name}, OCPU: {ocpu}, RAM: {ram} GB")

shape_cfg = oci.core.models.UpdateInstanceShapeConfigDetails(
    ocpus=ocpu,
    memory_in_gbs=ram
)

plugin_run = oci.core.models.InstanceAgentPluginConfigDetails(
    name="Compute Instance Run Command",
    desired_state="ENABLED"
)
plugin_mon = oci.core.models.InstanceAgentPluginConfigDetails(
    name="Compute Instance Monitoring",
    desired_state="ENABLED"
)

agent_up = oci.core.models.UpdateInstanceAgentConfigDetails(
    is_management_disabled=False,
    is_monitoring_disabled=False,
    plugins_config=[plugin_run, plugin_mon]
)

meta = inst.metadata or {}
curr_keys = meta.get("ssh_authorized_keys", "")
if pub_key not in curr_keys:
    new_keys = (curr_keys + "\n" + pub_key).strip()
else:
    new_keys = curr_keys

print("\n=== 2. CAP NHAT CAU HINH MAY CHU KEM SHAPE_CONFIG ===")
up_details = oci.core.models.UpdateInstanceDetails(
    shape_config=shape_cfg,
    agent_config=agent_up,
    metadata={"ssh_authorized_keys": new_keys}
)

try:
    resp = compute_client.update_instance(inst_id, up_details)
    print("-> CAP NHAT THANH CONG 100%! Plugin Run Command da duoc BAT!")
except Exception as e:
    print("-> Loi cap nhat:", getattr(e, 'message', str(e)))

print("\n=== 3. PHAT LENH NAP KHOA QUA AGENT ===")
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
echo "KEY_INJECTED_SUCCESSFULLY"
"""

source = m.InstanceAgentCommandSourceViaTextDetails(source_type="TEXT", text=script)
content = m.InstanceAgentCommandContent(source=source)
target = m.InstanceAgentCommandTarget(instance_id=inst_id)
details = m.CreateInstanceAgentCommandDetails(
    compartment_id=tenancy,
    execution_time_out_in_seconds=120,
    target=target,
    content=content
)
new_cmd = agent_client.create_instance_agent_command(details)
print(f"-> LENH NAP KHOA DA DUOC GUI LEN! Command ID: {new_cmd.data.id}")

print("\n=== 4. THEO DOI KET QUA THUC THI ===")
print("Dang cho Oracle Cloud Agent nhan lenh va chay (khoang 20-30 giay)...")
for i in range(6):
    time.sleep(5)
    try:
        exs = agent_client.list_instance_agent_command_executions(
            compartment_id=tenancy,
            instance_id=inst_id
        ).data
        found = [x for x in exs if x.instance_agent_command_id == new_cmd.data.id]
        if found:
            print(f"[{i*5+5}s] Trang thai execution: {found[0].lifecycle_state}, Delivery: {found[0].delivery_state}")
            if found[0].lifecycle_state in ["SUCCEEDED", "FAILED"]:
                break
        else:
            print(f"[{i*5+5}s] Dang dong bo lenh toi VPS...")
    except Exception as e:
        print(f"[{i*5+5}s] Dang cho...")

print("\n=== HOAN TAT AUTO FIX! ===")
