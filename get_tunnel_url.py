import oci
import time
import re

config = oci.config.from_file()
agent_client = oci.compute_instance_agent.ComputeInstanceAgentClient(config)
inst_id = "ocid1.instance.oc1.ap-singapore-1.anzwsljr3epcpnac5v2gfnnn73idx6koglvtto6za74ltwnpnmahbk2clpea"
cmd_id = "ocid1.instanceagentcommand.oc1.ap-singapore-1.amaaaaaa3epcpnaaiyq5uvoa26a2dwympnugyar4guxxmibwvdzuesl3fjvq"

for i in range(10):
    try:
        full = agent_client.get_instance_agent_command_execution(
            instance_agent_command_id=cmd_id,
            instance_id=inst_id
        ).data
        if full.content and full.content.text:
            text = full.content.text
            match = re.search(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com", text)
            if match:
                url = match.group(0)
                print("\n" + "="*60)
                print("🎉 DA CO LINK WEB DASHBOARD CLIPROXYAPI TRUC TIEP:")
                print("="*60)
                print(f"👉 LINK TRUY CAP:  {url}/management")
                print(f"👉 API ENDPOINT:   {url}/v1")
                print("👉 MAT KHAU/PASS:  123456")
                print("👉 API KEY:        123456")
                print("="*60)
                break
            else:
                print(text)
                break
    except Exception as e:
        time.sleep(2)
