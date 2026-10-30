import oci

config = oci.config.from_file()
agent_client = oci.compute_instance_agent.ComputeInstanceAgentClient(config)
inst_id = "ocid1.instance.oc1.ap-singapore-1.anzwsljr3epcpnac5v2gfnnn73idx6koglvtto6za74ltwnpnmahbk2clpea"
cmd_id = "ocid1.instanceagentcommand.oc1.ap-singapore-1.amaaaaaa3epcpnaaq3lqwo3r2w3slardyo6sqgzcglw7pbnusjhqdneua57q"

full = agent_client.get_instance_agent_command_execution(
    instance_agent_command_id=cmd_id,
    instance_id=inst_id
).data

print(f"LIFECYCLE: {full.lifecycle_state}")
print(f"EXIT CODE: {full.execution_exit_code}")
print("--- FULL TEXT ---")
print(full.content.text)
