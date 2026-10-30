import oci
import time

config = oci.config.from_file()
compute_client = oci.core.ComputeClient(config)
vn_client = oci.core.VirtualNetworkClient(config)
agent_client = oci.compute_instance_agent.ComputeInstanceAgentClient(config)

inst_id = "ocid1.instance.oc1.ap-singapore-1.anzwsljr3epcpnac5v2gfnnn73idx6koglvtto6za74ltwnpnmahbk2clpea"
tenancy = config["tenancy"]
vps_ip = "158.178.235.87"

print("=== BAT DAU TRIEN KHAI TU DONG 100% CLIPROXYAPI LEN VPS ===")

# 1. MO PORT 8317 VA 80 TREN ORACLE CLOUD SECURITY LIST
print("\n[1/3] Kiem tra va mo port 8317 va 80 tren Oracle VCN Security List...")
try:
    vnics = compute_client.list_vnic_attachments(compartment_id=tenancy, instance_id=inst_id).data
    for v in vnics:
        vnic = vn_client.get_vnic(v.vnic_id).data
        subnet = vn_client.get_subnet(vnic.subnet_id).data
        for sl_id in subnet.security_list_ids:
            sl = vn_client.get_security_list(sl_id).data
            existing_ports = set()
            for rule in (sl.ingress_security_rules or []):
                if rule.protocol == "6" and rule.tcp_options and rule.tcp_options.destination_port_range:
                    existing_ports.add(rule.tcp_options.destination_port_range.min)
            
            rules_to_add = []
            for p in [8317, 80]:
                if p not in existing_ports:
                    rules_to_add.append(
                        oci.core.models.IngressSecurityRule(
                            protocol="6",
                            source="0.0.0.0/0",
                            tcp_options=oci.core.models.TcpOptions(
                                destination_port_range=oci.core.models.PortRange(min=p, max=p)
                            ),
                            description=f"Allow port {p} for CLIProxyAPI"
                        )
                    )
            if rules_to_add:
                new_rules = list(sl.ingress_security_rules or []) + rules_to_add
                vn_client.update_security_list(
                    sl_id,
                    oci.core.models.UpdateSecurityListDetails(ingress_security_rules=new_rules)
                )
                print(f"-> Da them ingress rules cho port 8317 va 80 tren Security List: {sl.display_name}!")
            else:
                print(f"-> Port 8317 da duoc phep tren Security List: {sl.display_name}!")
except Exception as e:
    print("Luu y ve Security List:", e)

# 2. CHUAN BI SCRIPT CAI DAT LEN VPS
print("\n[2/3] Chuan bi lenh thuc thi tren may chu...")
bash_script = """#!/bin/bash
curl -sSL https://raw.githubusercontent.com/Long2066/Hmongs-Photo/main/setup_vps.sh | bash
"""

# 3. GUI LENH QUA AGENT VA THEO DOI
print("\n[3/3] Dang gui goi cai dat len may chu qua Oracle Agent...")
m = oci.compute_instance_agent.models
source = m.InstanceAgentCommandSourceViaTextDetails(source_type="TEXT", text=bash_script)
content = m.InstanceAgentCommandContent(source=source)
target = m.InstanceAgentCommandTarget(instance_id=inst_id)
details = m.CreateInstanceAgentCommandDetails(
    compartment_id=tenancy,
    execution_time_out_in_seconds=240,
    target=target,
    content=content
)
cmd = agent_client.create_instance_agent_command(details)
print(f"-> Lenh da duoc tiep nhan! ID: {cmd.data.id}")
print("Dang cho may chu tai binary, cau hinh OAuth va khoi chay (khoang 30-45 giay)...\n")

for i in range(24):
    time.sleep(5)
    try:
        exs = agent_client.list_instance_agent_command_executions(
            compartment_id=tenancy,
            instance_id=inst_id
        ).data
        found = [x for x in exs if x.instance_agent_command_id == cmd.data.id]
        if found:
            f = found[0]
            print(f"[{i*5+5}s] Trang thai: {f.lifecycle_state}")
            if f.lifecycle_state == "SUCCEEDED":
                print("\n" + "="*60)
                print("🎉 CHUC MUNG! CLIPROXYAPI DA CAI DAT VA HOAT DONG 100% TREN VPS!")
                print("="*60)
                print(f"👉 Link Web Dashboard: http://{vps_ip}:8317/management")
                print(f"👉 Endpoint API:       http://{vps_ip}:8317/v1")
                print("👉 Secret Key / Pass:  123456")
                print("👉 API Key:            123456")
                print("👉 SSH Info (neu can): User: ubuntu | Pass: Admin123456@")
                print("="*60)
                break
            elif f.lifecycle_state == "FAILED":
                print("Co loi xay ra trong qua trinh cai:", f)
                break
        else:
            print(f"[{i*5+5}s] Dang tien hanh...")
    except Exception as e:
        print(f"[{i*5+5}s] Cho them...")
