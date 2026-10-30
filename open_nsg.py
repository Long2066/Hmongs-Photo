import oci
import time

config = oci.config.from_file()
compute_client = oci.core.ComputeClient(config)
vn_client = oci.core.VirtualNetworkClient(config)
agent_client = oci.compute_instance_agent.ComputeInstanceAgentClient(config)

inst_id = "ocid1.instance.oc1.ap-singapore-1.anzwsljr3epcpnac5v2gfnnn73idx6koglvtto6za74ltwnpnmahbk2clpea"
tenancy = config["tenancy"]
TARGET_PORT = 9000

print("=== 1. KIEM TRA VA MO PORT TREN NETWORK SECURITY GROUPS (NSG) ===")
try:
    vnics = compute_client.list_vnic_attachments(compartment_id=tenancy, instance_id=inst_id).data
    for v in vnics:
        vnic = vn_client.get_vnic(v.vnic_id).data
        print(f"VNIC: {vnic.display_name}, NSG list: {vnic.nsg_ids}")
        if vnic.nsg_ids:
            for nsg_id in vnic.nsg_ids:
                rules = vn_client.list_network_security_group_security_rules(nsg_id).data
                existing = [r for r in rules if r.direction == "INGRESS" and r.protocol == "6" and r.tcp_options and r.tcp_options.destination_port_range and r.tcp_options.destination_port_range.min == TARGET_PORT]
                if not existing:
                    add_rule = oci.core.models.AddSecurityRuleDetails(
                        direction="INGRESS",
                        protocol="6",
                        source="0.0.0.0/0",
                        source_type="CIDR_BLOCK",
                        tcp_options=oci.core.models.TcpOptions(
                            destination_port_range=oci.core.models.PortRange(min=TARGET_PORT, max=TARGET_PORT)
                        ),
                        description=f"Allow port {TARGET_PORT}"
                    )
                    vn_client.add_network_security_group_security_rules(
                        nsg_id,
                        oci.core.models.AddNetworkSecurityGroupSecurityRulesDetails(security_rules=[add_rule])
                    )
                    print(f"-> DA THEM PORT {TARGET_PORT} VAO NSG: {nsg_id}!")
                else:
                    print(f"-> Port {TARGET_PORT} da co san trong NSG: {nsg_id}!")
        else:
            print("VNIC khong dung NSG.")
except Exception as e:
    print("Loi kiem tra/cap nhat NSG:", e)

print("\n=== 2. KIEM TRA LOG LENH KHOI DONG LAUNCH_CPA VUA ROI ===")
try:
    exs = agent_client.list_instance_agent_command_executions(
        compartment_id=tenancy,
        instance_id=inst_id
    ).data
    if exs:
        latest = exs[0]
        print(f"Command ID: {latest.instance_agent_command_id[-10:]}, Status: {latest.lifecycle_state}")
        full = agent_client.get_instance_agent_command_execution(
            instance_agent_command_id=latest.instance_agent_command_id,
            instance_id=inst_id
        ).data
        if full.content and full.content.text:
            print("\n--- LOG MAY CHU ---")
            print(full.content.text)
            print("-------------------")
except Exception as e:
    print("Loi:", e)
