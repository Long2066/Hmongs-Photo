import oci
import time
import re

config = oci.config.from_file()
agent_client = oci.compute_instance_agent.ComputeInstanceAgentClient(config)
inst_id = "ocid1.instance.oc1.ap-singapore-1.anzwsljr3epcpnac5v2gfnnn73idx6koglvtto6za74ltwnpnmahbk2clpea"
tenancy = config["tenancy"]

cmd_id = "ocid1.instanceagentcommand.oc1.ap-singapore-1.amaaaaaa3epcpnaaqi7r2ah627f43xldece7kxuu5gzzyozfcfic2ctgdgiq"

print("Dang lay ket qua tu may chu...")
for i in range(20):
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
                text = full.content.text or ""
                print(f"Trang thai: {f.lifecycle_state}\n")
                print("--- LOG CHI TIET ---")
                print(text)
                
                # Tim URL Cloudflare
                match = re.search(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com", text)
                if match:
                    base_url = match.group(0)
                    print("\n" + "="*60)
                    print("🎉 DA SAN SANG! DUONG LINK TRUY CAP CHINH XAC:")
                    print("="*60)
                    print(f"👉 LINK DASHBOARD:  {base_url}/management.html")
                    print(f"👉 ENDPOINT API:    {base_url}/v1")
                    print("👉 MAT KHAU / KEY:  123456")
                    print("="*60)
                break
            else:
                print(f"Trang thai hien tai: {f.lifecycle_state}... dang cho...")
        time.sleep(3)
    except Exception as e:
        print(f"Loi: {e}")
        time.sleep(3)
