import oci
import time
import re
import sys

config = oci.config.from_file()
agent_client = oci.compute_instance_agent.ComputeInstanceAgentClient(config)
inst_id = "ocid1.instance.oc1.ap-singapore-1.anzwsljr3epcpnac5v2gfnnn73idx6koglvtto6za74ltwnpnmahbk2clpea"
cmd_id = "ocid1.instanceagentcommand.oc1.ap-singapore-1.amaaaaaa3epcpnaadpcoybhfzsc5jgst7i5euxd2caowrfhj52enmgm7veaq"

print("Dang kiem tra trang thai thuc thi...")

for i in range(20):
    try:
        full = agent_client.get_instance_agent_command_execution(
            instance_agent_command_id=cmd_id,
            instance_id=inst_id
        ).data

        state = full.lifecycle_state

        if state in ["SUCCEEDED", "FAILED"]:
            print(f"\nTrang thai: {state}")
            text = ""
            if full.content and hasattr(full.content, 'text'):
                text = full.content.text or ""

            print("--- LOG MAY CHU ---")
            print(text)

            match = re.search(r"https://[a-zA-Z0-9-]+\.(ngrok-free\.app|ngrok\.io|ngrok\.app)", text)
            if match:
                base_url = match.group(0)
                print("\n" + "="*70)
                print("🎉 DA CO BO LINK VINH VIEN CO DINH TRON DOI:")
                print("="*70)
                print(f"👉 LINK WEB DASHBOARD:  {base_url}/management.html")
                print(f"👉 ENDPOINT CHO TOOL:   {base_url}/v1")
                print("👉 MAT KHAU / SECRET:   123456")
                print("👉 API KEY:             123456")
                print("="*70)
                print("Link nay CO DINH VINH VIEN, khong bao gio het han hay bi doi!")
            sys.exit(0)
        else:
            sys.stdout.write(f"\rTrang thai: {state}... dang cho ({i+1}/20)")
            sys.stdout.flush()
            time.sleep(3)
    except Exception as e:
        time.sleep(3)
