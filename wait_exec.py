import oci
import time

config = oci.config.from_file()
agent_client = oci.compute_instance_agent.ComputeInstanceAgentClient(config)
inst_id = "ocid1.instance.oc1.ap-singapore-1.anzwsljr3epcpnac5v2gfnnn73idx6koglvtto6za74ltwnpnmahbk2clpea"
tenancy = config["tenancy"]

cmd_id = "ocid1.instanceagentcommand.oc1.ap-singapore-1.amaaaaaa3epcpnaap2pkzt3rsjq5dwsrmsslokyw6isu477xzseucu47auja"

print("Dang kiem tra trang thai thuc thi cua Agent tren VM...")
for i in range(12):
    try:
        exs = agent_client.list_instance_agent_command_executions(
            compartment_id=tenancy,
            instance_id=inst_id
        ).data
        found = [x for x in exs if x.instance_agent_command_id == cmd_id]
        if found:
            f = found[0]
            print(f"[{i*5}s] Trang thai: {f.lifecycle_state}, Delivery: {f.delivery_state}")
            if f.lifecycle_state == "SUCCEEDED":
                print(">>> DA THANH CONG! AGENT DA CHAY XONG SCRIPT! <<<")
                try:
                    out = agent_client.get_instance_agent_command_execution(
                        instance_agent_command_id=cmd_id,
                        instance_id=inst_id
                    ).data
                    print("Noi dung ket qua:", getattr(out.content, 'output', 'Done'))
                except Exception as e:
                    pass
                break
            elif f.lifecycle_state == "FAILED":
                print("Agent bao loi:", f)
                break
        else:
            print(f"[{i*5}s] Chua tim thay execution...")
    except Exception as e:
        print("Loi kiem tra:", e)
    time.sleep(5)
