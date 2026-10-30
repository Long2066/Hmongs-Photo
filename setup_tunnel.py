import oci
import time
import re

config = oci.config.from_file()
agent_client = oci.compute_instance_agent.ComputeInstanceAgentClient(config)
inst_id = "ocid1.instance.oc1.ap-singapore-1.anzwsljr3epcpnac5v2gfnnn73idx6koglvtto6za74ltwnpnmahbk2clpea"
tenancy = config["tenancy"]

script = """#!/bin/bash
DIR="/var/lib/ocarun/cliproxyapi"
cd "$DIR"

echo "=== 1. KIEM TRA CLIPROXYAPI ==="
ps aux | grep "cli-proxy-api" | grep -v grep || {
    echo "Restarting CLIProxyAPI..."
    nohup "$DIR/cli-proxy-api" --config "$DIR/config.yaml" --no-browser </dev/null >"$DIR/cpa.log" 2>&1 &
    sleep 2
}

echo "=== 2. KHOI TAO DUONG TRUYEN CLOUDFLARE PUBLIC HTTPS ==="
if [ ! -f "cloudflared" ]; then
    echo "Downloading cloudflared..."
    curl -sSL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64" -o "$DIR/cloudflared"
    chmod +x "$DIR/cloudflared"
fi

pkill -f "cloudflared" 2>/dev/null || true
sleep 1
rm -f "$DIR/tunnel.log"

nohup "$DIR/cloudflared" tunnel --url http://127.0.0.1:9000 </dev/null >"$DIR/tunnel.log" 2>&1 &
sleep 6

URL=$(grep -oE "https://[a-zA-Z0-9-]+\.trycloudflare\.com" "$DIR/tunnel.log" | head -n 1)

echo "=== TUNNEL_URL: $URL ==="

# Add to crontab
(crontab -l 2>/dev/null | grep -v "cloudflared"; echo "@reboot nohup $DIR/cloudflared tunnel --url http://127.0.0.1:9000 </dev/null >$DIR/tunnel.log 2>&1 &") | crontab - 2>/dev/null || true
"""

m = oci.compute_instance_agent.models
source = m.InstanceAgentCommandSourceViaTextDetails(source_type="TEXT", text=script)
content = m.InstanceAgentCommandContent(source=source)
target = m.InstanceAgentCommandTarget(instance_id=inst_id)
details = m.CreateInstanceAgentCommandDetails(
    compartment_id=tenancy,
    execution_time_out_in_seconds=90,
    target=target,
    content=content
)
cmd = agent_client.create_instance_agent_command(details)
print(f"Sent: {cmd.data.id}")
print("Dang tao duong link HTTPS truy cap truc tiep (khoang 15-20s)...")

for i in range(15):
    time.sleep(3)
    try:
        exs = agent_client.list_instance_agent_command_executions(
            compartment_id=tenancy,
            instance_id=inst_id
        ).data
        found = [x for x in exs if x.instance_agent_command_id == cmd.data.id]
        if found:
            f = found[0]
            if f.lifecycle_state in ["SUCCEEDED", "FAILED"]:
                full = agent_client.get_instance_agent_command_execution(
                    instance_agent_command_id=cmd.data.id,
                    instance_id=inst_id
                ).data
                text = full.content.text or ""
                match = re.search(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com", text)
                if match:
                    tunnel_url = match.group(0)
                    print("\n" + "="*60)
                    print("🎉 THANH CONG 100%! DA CO LINK WEB TRUY CAP TRUC TIEP:")
                    print("="*60)
                    print(f"👉 LINK WEB DASHBOARD: {tunnel_url}/management")
                    print(f"👉 ENDPOINT API:       {tunnel_url}/v1")
                    print("👉 MAT KHAU / SECRET:  123456")
                    print("👉 API KEY:            123456")
                    print("="*60)
                    print("\n(Link nay co day du chung chi SSL HTTPS bao mat, truy cap duoc tren moi trinh duyet PC va dien thoai 24/7!)")
                else:
                    print(text)
                break
    except Exception as e:
        pass
