import oci

config = oci.config.from_file()
agent_client = oci.compute_instance_agent.ComputeInstanceAgentClient(config)

inst_id = "ocid1.instance.oc1.ap-singapore-1.anzwsljr3epcpnac5v2gfnnn73idx6koglvtto6za74ltwnpnmahbk2clpea"
tenancy = config["tenancy"]

try:
    exs = agent_client.list_instance_agent_command_executions(
        compartment_id=tenancy,
        instance_id=inst_id
    ).data
    for ex in exs[:2]:
        print(f"\n=== Command: {ex.instance_agent_command_id[-10:]} ({ex.lifecycle_state}) ===")
        full = agent_client.get_instance_agent_command_execution(
            instance_agent_command_id=ex.instance_agent_command_id,
            instance_id=inst_id
        ).data
        if full.content and full.content.text:
            print(full.content.text)
except Exception as e:
    print("Loi:", e)
