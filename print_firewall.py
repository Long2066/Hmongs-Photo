import oci

config = oci.config.from_file()
agent_client = oci.compute_instance_agent.ComputeInstanceAgentClient(config)

inst_id = "ocid1.instance.oc1.ap-singapore-1.anzwsljr3epcpnac5v2gfnnn73idx6koglvtto6za74ltwnpnmahbk2clpea"
cmd_id = "ocid1.instanceagentcommand.oc1.ap-singapore-1.amaaaaaa3epcpnaa46kzooguaxuhz2j5po546r3kwi3mmgvh4362lo37xixa"

try:
    full = agent_client.get_instance_agent_command_execution(
        instance_agent_command_id=cmd_id,
        instance_id=inst_id
    ).data
    print(f"Status: {full.lifecycle_state}")
    if full.content and full.content.text:
        print("\n=== KET QUA TU MAY CHU ===")
        print(full.content.text)
        print("===========================")
    else:
        print("Chua co text output hoac dang chay.")
except Exception as e:
    print("Loi:", e)
