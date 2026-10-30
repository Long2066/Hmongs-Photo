import oci

config = oci.config.from_file()
compute_client = oci.core.ComputeClient(config)
vn_client = oci.core.VirtualNetworkClient(config)

inst_id = "ocid1.instance.oc1.ap-singapore-1.anzwsljr3epcpnac5v2gfnnn73idx6koglvtto6za74ltwnpnmahbk2clpea"
tenancy = config["tenancy"]

vnics = compute_client.list_vnic_attachments(compartment_id=tenancy, instance_id=inst_id).data
for v in vnics:
    vnic = vn_client.get_vnic(v.vnic_id).data
    subnet = vn_client.get_subnet(vnic.subnet_id).data
    for sl_id in subnet.security_list_ids:
        sl = vn_client.get_security_list(sl_id).data
        print(f"=== Security List: {sl.display_name} ===")
        for rule in sl.ingress_security_rules:
            port_info = "ALL"
            if rule.tcp_options and rule.tcp_options.destination_port_range:
                port_info = f"{rule.tcp_options.destination_port_range.min}-{rule.tcp_options.destination_port_range.max}"
            print(f"  Source: {rule.source}, Protocol: {rule.protocol}, Port: {port_info}")
