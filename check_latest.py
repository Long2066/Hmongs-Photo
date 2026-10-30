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
    print(f"Tong so executions: {len(exs)}")
    for i, ex in enumerate(exs[:5]):
        print(f"\n--- Execution [{i+1}] ---")
        print(f"Command ID: {ex.instance_agent_command_id}")
        print(f"Trang thai: {ex.lifecycle_state}, Delivery: {ex.delivery_state}")
        try:
            full = agent_client.get_instance_agent_command_execution(
                instance_agent_command_id=ex.instance_agent_command_id,
                instance_id=inst_id
            ).data
            if full.content:
                print(f"Exit code: {full.content.exit_code}")
                if full.content.text:
                    print(f"Output: {full.content.text[:500]}")
        except Exception as e:
            pass
except Exception as e:
    print("Loi:", e)
