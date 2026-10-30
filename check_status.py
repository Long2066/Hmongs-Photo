import oci

config = oci.config.from_file()
client = oci.compute_instance_agent.ComputeInstanceAgentClient(config)

cmd_id = "ocid1.instanceagentcommand.oc1.ap-singapore-1.amaaaaaa3epcpnaaz2h6bmzq6p3bqxxq2lz5gyyhpyspq73ikwla57hd2nwa"
inst_id = "ocid1.instance.oc1.ap-singapore-1.anzwsljr3epcpnac5v2gfnnn73idx6koglvtto6za74ltwnpnmahbk2clpea"

try:
    execs = client.list_instance_agent_command_executions(cmd_id, compartment_id=config["tenancy"]).data
    if not execs:
        print("CHUA_CO_EXECUTION (Oracle Agent chua nhan duoc lenh)")
    for e in execs:
        print(f"STATUS: {e.lifecycle_state}, DELIVERY: {e.delivery_state}")
        try:
            out = client.get_instance_agent_command_execution(inst_id, cmd_id).data
            print("OUTPUT:", getattr(out, 'content', 'No content'))
        except Exception as err:
            print("Output err:", err)
except Exception as e:
    print("Error:", e)
