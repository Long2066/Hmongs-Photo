import oci
import re

config = oci.config.from_file()
agent_client = oci.compute_instance_agent.ComputeInstanceAgentClient(config)
inst_id = "ocid1.instance.oc1.ap-singapore-1.anzwsljr3epcpnac5v2gfnnn73idx6koglvtto6za74ltwnpnmahbk2clpea"
cmd_id = "ocid1.instanceagentcommand.oc1.ap-singapore-1.amaaaaaa3epcpnaadpcoybhfzsc5jgst7i5euxd2caowrfhj52enmgm7veaq"

full = agent_client.get_instance_agent_command_execution(
    instance_agent_command_id=cmd_id,
    instance_id=inst_id
).data

print(f"Trang thai: {full.lifecycle_state}")
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
