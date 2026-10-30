import oci
import time

config = oci.config.from_file()
agent_client = oci.compute_instance_agent.ComputeInstanceAgentClient(config)
inst_id = "ocid1.instance.oc1.ap-singapore-1.anzwsljr3epcpnac5v2gfnnn73idx6koglvtto6za74ltwnpnmahbk2clpea"
tenancy = config["tenancy"]

cmd_id = "ocid1.instanceagentcommand.oc1.ap-singapore-1.amaaaaaa3epcpnaaq3lqwo3r2w3slardyo6sqgzcglw7pbnusjhqdneua57q"

print("Dang lay ket qua tu may chu...")
for i in range(15):
    try:
        exs = agent_client.list_instance_agent_command_executions(
            compartment_id=tenancy,
            instance_id=inst_id
        ).data
        found = [x for x in exs if x.instance_agent_command_id == cmd_id]
        if found:
            f = found[0]
            if f.lifecycle_state in ["SUCCEEDED", "FAILED"]:
                full = agent_client.get_instance_agent_command_execution(
                    instance_agent_command_id=cmd_id,
                    instance_id=inst_id
                ).data
                print(f"Trang thai: {f.lifecycle_state}\n")
                print("--- KET QUA ---")
                print(full.content.text or "")
                break
            else:
                print(f"Trang thai: {f.lifecycle_state}... dang cho...")
        time.sleep(2)
    except Exception as e:
        time.sleep(2)
