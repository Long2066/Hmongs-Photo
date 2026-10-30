import oci
import time
import re

config = oci.config.from_file()
agent_client = oci.compute_instance_agent.ComputeInstanceAgentClient(config)
inst_id = "ocid1.instance.oc1.ap-singapore-1.anzwsljr3epcpnac5v2gfnnn73idx6koglvtto6za74ltwnpnmahbk2clpea"
cmd_id = "ocid1.instanceagentcommand.oc1.ap-singapore-1.amaaaaaa3epcpnaawmhr5jh3ki2cybheibkag4awoeh6zjjb4mxb6nkife7a"

for attempt in range(15):
    try:
        full = agent_client.get_instance_agent_command_execution(
            instance_agent_command_id=cmd_id,
            instance_id=inst_id
        ).data

        state = full.lifecycle_state
        print(f"Trang thai hien tai: {state}")

        if state in ["SUCCEEDED", "FAILED"]:
            text = ""
            if full.content and hasattr(full.content, 'text'):
                text = full.content.text or ""
            print("--- LOG MAY CHU ---")
            print(text)

            match = re.search(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com", text)
            if match:
                base_url = match.group(0)
                print("\n" + "="*65)
                print("🎉 DA SAN SANG! LINK WEB DASHBOARD CHINH XAC:")
                print("="*65)
                print(f"👉 LINK TRUY CAP:       {base_url}/management.html")
                print(f"👉 ENDPOINT API:        {base_url}/v1")
                print("👉 MAT KHAU / SECRET:   123456")
                print("👉 API KEY:             123456")
                print("="*65)
            break
        time.sleep(3)
    except Exception as e:
        print(f"Cho mot chut... ({e})")
        time.sleep(3)
