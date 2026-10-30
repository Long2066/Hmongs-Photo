import oci
import time

config = oci.config.from_file()
compute_client = oci.core.ComputeClient(config)
vn_client = oci.core.VirtualNetworkClient(config)
agent_client = oci.compute_instance_agent.ComputeInstanceAgentClient(config)

inst_id = "ocid1.instance.oc1.ap-singapore-1.anzwsljr3epcpnac5v2gfnnn73idx6koglvtto6za74ltwnpnmahbk2clpea"
tenancy = config["tenancy"]

print("=== 1. KIEM TRA KET QUA EXECUTION TRUOC ===")
try:
    exs = agent_client.list_instance_agent_command_executions(
        compartment_id=tenancy,
        instance_id=inst_id
    ).data
    if exs:
        latest = exs[0]
        print(f"Latest Command: {latest.instance_agent_command_id}")
        print(f"Trang thai: {latest.lifecycle_state}, Exit code: {getattr(latest.content, 'exit_code', None)}")
        full = agent_client.get_instance_agent_command_execution(
            instance_agent_command_id=latest.instance_agent_command_id,
            instance_id=inst_id
        ).data
        if full.content and full.content.text:
            print("\n--- LOG EXECUTION TRUOC ---")
            print(full.content.text)
            print("---------------------------\n")
except Exception as e:
    print("Loi kiem tra execution truoc:", e)

print("\n=== 2. KIEM TRA NETWORK SECURITY GROUPS (NSG) TREN OCI ===")
try:
    vnics = compute_client.list_vnic_attachments(compartment_id=tenancy, instance_id=inst_id).data
    for v in vnics:
        vnic = vn_client.get_vnic(v.vnic_id).data
        print(f"VNIC: {vnic.display_name}, Public IP: {vnic.public_ip}")
        print(f"NSG IDs: {vnic.nsg_ids}")
        if vnic.nsg_ids:
            for nsg_id in vnic.nsg_ids:
                nsg_rules = vn_client.list_network_security_group_security_rules(nsg_id).data
                print(f"  NSG {nsg_id} co {len(nsg_rules)} rules.")
except Exception as e:
    print("Loi kiem tra NSG:", e)

print("\n=== 3. GUI LENH KIEM TRA TOAN DIEN HE THONG MAY CHU ===")
check_script = """#!/bin/bash
echo "=== PROCESSES RUNNING ==="
ps aux | grep cli-proxy-api | grep -v grep || echo "cli-proxy-api is NOT running"

echo "=== LISTENING PORTS ==="
ss -tlpn 2>/dev/null || netstat -tlpn 2>/dev/null || lsof -i :8317 2>/dev/null

echo "=== CPA LOG ==="
cat /var/lib/ocarun/cliproxyapi/cpa.log 2>/dev/null | tail -n 20

echo "=== SUDO -L ==="
sudo -l 2>&1

echo "=== IPTABLES FILE ==="
cat /etc/iptables/rules.v4 2>/dev/null | grep -E "8317|REJECT|DROP|ACCEPT" | head -n 20

echo "=== LOCAL CURL TO MANAGEMENT ==="
curl -sI -m 3 http://127.0.0.1:8317/management | head -n 4
"""

m = oci.compute_instance_agent.models
source = m.InstanceAgentCommandSourceViaTextDetails(source_type="TEXT", text=check_script)
content = m.InstanceAgentCommandContent(source=source)
target = m.InstanceAgentCommandTarget(instance_id=inst_id)
details = m.CreateInstanceAgentCommandDetails(
    compartment_id=tenancy,
    execution_time_out_in_seconds=60,
    target=target,
    content=content
)
cmd = agent_client.create_instance_agent_command(details)
print(f"Da gui lenh chan doan: {cmd.data.id}")
print("Dang cho ket qua (15-20 giay)...")

for i in range(10):
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
                print("KET QUA CHAN DOAN HE THONG:")
                print("="*50)
                print(full.content.text)
                print("="*50)
                break
    except Exception as e:
        pass
