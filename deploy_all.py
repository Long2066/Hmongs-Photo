import oci
import time
import base64

config = oci.config.from_file()
compute_client = oci.core.ComputeClient(config)
vn_client = oci.core.VirtualNetworkClient(config)
agent_client = oci.compute_instance_agent.ComputeInstanceAgentClient(config)

inst_id = "ocid1.instance.oc1.ap-singapore-1.anzwsljr3epcpnac5v2gfnnn73idx6koglvtto6za74ltwnpnmahbk2clpea"
tenancy = config["tenancy"]
vps_ip = "158.178.235.87"

print("=== BAT DAU TRIEN KHAI TU DONG 100% CLIPROXYAPI LEN VPS ===")

# 1. MO PORT 8317 VA 80 TREN ORACLE CLOUD SECURITY LIST
print("\n[1/3] Kiem tra va mo port 8317 va 80 tren Oracle VCN Security List...")
try:
    vnics = compute_client.list_vnic_attachments(compartment_id=tenancy, instance_id=inst_id).data
    for v in vnics:
        vnic = vn_client.get_vnic(v.vnic_id).data
        subnet = vn_client.get_subnet(vnic.subnet_id).data
        for sl_id in subnet.security_list_ids:
            sl = vn_client.get_security_list(sl_id).data
            existing_ports = set()
            for rule in (sl.ingress_security_rules or []):
                if rule.protocol == "6" and rule.tcp_options and rule.tcp_options.destination_port_range:
                    existing_ports.add(rule.tcp_options.destination_port_range.min)
            
            rules_to_add = []
            for p in [8317, 80]:
                if p not in existing_ports:
                    rules_to_add.append(
                        oci.core.models.IngressSecurityRule(
                            protocol="6",
                            source="0.0.0.0/0",
                            tcp_options=oci.core.models.TcpOptions(
                                destination_port_range=oci.core.models.PortRange(min=p, max=p)
                            ),
                            description=f"Allow port {p} for CLIProxyAPI"
                        )
                    )
            if rules_to_add:
                new_rules = list(sl.ingress_security_rules or []) + rules_to_add
                vn_client.update_security_list(
                    sl_id,
                    oci.core.models.UpdateSecurityListDetails(ingress_security_rules=new_rules)
                )
                print(f"-> Da them ingress rules cho port 8317 va 80 tren Security List: {sl.display_name}!")
            else:
                print(f"-> Port 8317 da duoc phep tren Security List: {sl.display_name}!")
except Exception as e:
    print("Luu y ve Security List:", e)

# 2. CHUAN BI SCRIPT CAI DAT LEN VPS
print("\n[2/3] Chuan bi goi cai dat CLIProxyAPI kem 4 tai khoan OAuth...")

bash_script = """#!/bin/bash
set -e

echo "[1] Enable password authentication and set ubuntu password..."
echo 'ubuntu:Admin123456@' | chpasswd
sed -i 's/^PasswordAuthentication no/PasswordAuthentication yes/' /etc/ssh/sshd_config 2>/dev/null || true
sed -i 's/^#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config 2>/dev/null || true
sed -i 's/^PasswordAuthentication no/PasswordAuthentication yes/' /etc/ssh/sshd_config.d/*.conf 2>/dev/null || true
systemctl restart ssh 2>/dev/null || systemctl restart sshd 2>/dev/null || true

echo "[2] Opening OS firewall ports 8317 and 80..."
iptables -I INPUT 1 -p tcp --dport 8317 -j ACCEPT 2>/dev/null || true
iptables -I INPUT 1 -p tcp --dport 80 -j ACCEPT 2>/dev/null || true
netfilter-persistent save 2>/dev/null || true
ufw allow 8317/tcp 2>/dev/null || true
ufw allow 80/tcp 2>/dev/null || true
firewall-cmd --add-port=8317/tcp --permanent 2>/dev/null || true
firewall-cmd --add-port=80/tcp --permanent 2>/dev/null || true
firewall-cmd --reload 2>/dev/null || true

echo "[3] Downloading and extracting CLIProxyAPI binary..."
mkdir -p /opt/cliproxyapi/oauth /opt/cliproxyapi/static
cd /opt/cliproxyapi
if [ ! -f "cli-proxy-api" ]; then
    curl -sSL "https://github.com/router-for-me/CLIProxyAPI/releases/download/v8.0.47/CLIProxyAPI_8.0.47_linux_amd64.tar.gz" -o /tmp/cpa.tar.gz
    tar -xzf /tmp/cpa.tar.gz -C /opt/cliproxyapi/
    rm -f /tmp/cpa.tar.gz
    chmod +x /opt/cliproxyapi/cli-proxy-api
fi

echo "[4] Writing config.yaml..."
cat << 'CONFIG_EOF' > /opt/cliproxyapi/config.yaml
config-version: 8
server:
  host: ""
  port: 8317
management:
  allow-remote: true
  secret-key: "123456"
oauth:
  auth-dir: "/opt/cliproxyapi/oauth"
auth-dir: "/opt/cliproxyapi/oauth"
access:
  api-keys:
    - "123456"
CONFIG_EOF

echo "[5] Writing oauth accounts..."
echo 'eyJhY2Nlc3NfdG9rZW4iOiJ5YTI5LmEwQWVoZlRPbFh6X2N4WDRVRExnUk0xcVF5RE1TOUNLbmlBWWdTX2FZaHB4YVoteUdmMFRieWhwZzdkS1VKTVN0SGZVVUhrTTdlQTlsMWxQSlpHRTF1QW44Zno3LW1WaHVZUkY5RmM5T20tMm5EM2JCYTRVWFJHMnU0YklIU2hQMk5SRlR4UmxZemppLXFUVTloUkdXTG1rdVBKX01HY2s4TXE5NEV6dGZMY283YUUtS0ppdEdCUkh0MWtVNFk2UmdWdVhydEdPY1VqVl9VcWdhQ2dZS0FUOFNBUllTRlFIR1gyTWlZeFlQQ3JUeDd4RzRCVU0zbE9nN1dnMDIxMyIsImFudGlncmF2aXR5X2NhcGFiaWxpdHlfaGludHMiOnsiZW5kcG9pbnQiOiJodHRwczovL2RhaWx5LWNsb3VkY29kZS1wYS5nb29nbGVhcGlzLmNvbSIsIm1vZGVsX2lkcyI6WyJjaGF0XzIwNzA2IiwiY2hhdF8yMzMxMCIsImNsYXVkZS1vcHVzLTUtNS1oaWdoIiwiY2xhdWRlLW9wdXMtNS01LWxvdyIsImNsYXVkZS1vcHVzLTUtNS1tZWRpdW0iLCJjbGF1ZGUtc29ubmV0LTUtNS1oaWdoIiwiY2xhdWRlLXNvbm5ldC01LTUtbG93IiwiY2xhdWRlLXNvbm5ldC01LTUtbWVkaXVtIiwiZ2VtaW5pLTIuNS1mbGFzaCIsImdlbWluaS0yLjUtZmxhc2gtbGl0ZSIsImdlbWluaS0yLjUtZmxhc2gtdGhpbmtpbmciLCJnZW1pbmktMi41LXBybyIsImdlbWluaS0zLWZsYXNoIiwiZ2VtaW5pLTMuMS1mbGFzaC1pbWFnZSIsImdlbWluaS0zLjEtZmxhc2gtbGl0ZSIsImdlbWluaS0zLjUtZmxhc2gtbGl0ZSIsImdlbWluaS0zLjgtZmxhc2gtaGlnaCIsImdlbWluaS0zLjgtZmxhc2gtbG93IiwiZ2VtaW5pLTMuOC1mbGFzaC1tZWRpdW0iLCJnZW1pbmktMy44LWZsYXNoLXRpZXJlZCIsImdlbWluaS00LWFyZ29uLWhpZ2giLCJnZW1pbmktNC1hcmdvbi1sb3ciLCJnZW1pbmktNC1hcmdvbi1tZWRpdW0iLCJncHQtb3NzLTEyMGItbWVkaXVtIiwidGFiX2ZsYXNoX2xpdGVfcHJldmlldyIsInRhYl9qdW1wX2ZsYXNoX2xpdGVfcHJldmlldyJdLCJwcm9qZWN0X2lkIjoiYWljb2RlLWNvbnN1bWVycyIsIndlYl9zZWFyY2hfbW9kZWxfaWRzIjpbImdlbWluaS0zLjUtZmxhc2gtbGl0ZSJdfSwiZGlzYWJsZWQiOmZhbHNlLCJlbWFpbCI6ImFuYW5oczEyM0BnbWFpbC5jb20iLCJleHBpcmVkIjoiMjAyNi0xMC0zMFQyMTo0Mjo1NSswNzowMCIsImV4cGlyZXNfaW4iOjM1OTksInByaW9yaXR5IjowLCJwcm9qZWN0X2lkIjoiYWljb2RlLWNvbnN1bWVycyIsInJlZnJlc2hfdG9rZW4iOiIxLy8wZ0wzNzd5eGZRY1JFQ2dZSUFSQUFHQkFTTndGLUw5SXJuUHZMQXdiVllDcXFsMlpJQl9pLTZ0SmtJUjhpVU9wMEwzYTBjaHdzbUI0RlY1aTVETUxrQWdtR1ByWllhbEFHUEVFIiwidGltZXN0YW1wIjoxNzkzMzY3Nzc2MjgyLCJ0eXBlIjoiYW50aWdyYXZpdHkifQ==' | base64 -d > /opt/cliproxyapi/oauth/antigravity-ananhs123@gmail.com.json
echo 'eyJhY2Nlc3NfdG9rZW4iOiJ5YTI5LmEwQWVoZlRPbV9ZQk85VUs5YkhNckFISDZPbXZXN2x5c3hyUW84aFhaeTVpeTNta3ZZYVpzZzRBM3ZWM2hqdGRmWjVsM25qVnNES1QwTnJmRXhlYmRQMHdBdmxIN0tsVkFobHViRHBTLV9FakRaMGw4aXZ3LWhhOFd4d2cxOTdlNXdCMkZpcElSZWpWRm85TjdjYUxXY21VLTFqUTVOZG90ZnlyZklXNlpYck93T1l0blZHU3dyRE5xNkZNcGJxVXdGVW9NQnZTQzZqTEdZTVFhQ2dZS0FZb1NBUlFTRlFIR1gyTWlVQnIxWWVRRGRfaVJWQ0hNWkEtQll3MDIxMyIsImFudGlncmF2aXR5X2NhcGFiaWxpdHlfaGludHMiOnsiZW5kcG9pbnQiOiJodHRwczovL2RhaWx5LWNsb3VkY29kZS1wYS5nb29nbGVhcGlzLmNvbSIsIm1vZGVsX2lkcyI6WyJjaGF0XzIwNzA2IiwiY2hhdF8yMzMxMCIsImNsYXVkZS1vcHVzLTQtNi10aGlua2luZyIsImNsYXVkZS1zb25uZXQtNC02IiwiZ2VtaW5pLTIuNS1mbGFzaCIsImdlbWluaS0yLjUtZmxhc2gtbGl0ZSIsImdlbWluaS0yLjUtZmxhc2gtdGhpbmtpbmciLCJnZW1pbmktMi41LXBybyIsImdlbWluaS0zLWZsYXNoIiwiZ2VtaW5pLTMuMS1mbGFzaC1pbWFnZSIsImdlbWluaS0zLjEtZmxhc2gtbGl0ZSIsImdlbWluaS0zLjUtZmxhc2gtbGl0ZSIsImdlbWluaS0zLjgtZmxhc2gtaGlnaCIsImdlbWluaS0zLjgtZmxhc2gtbG93IiwiZ2VtaW5pLTMuOC1mbGFzaC1tZWRpdW0iLCJnZW1pbmktMy44LWZsYXNoLXRpZXJlZCIsImdlbWluaS00LWFyZ29uLWRpc2FibGVkIiwiZ3B0LW9zcy0xMjBiLW1lZGl1bSIsInRhYl9mbGFzaF9saXRlX3ByZXZpZXciLCJ0YWJfanVtcF9mbGFzaF9saXRlX3ByZXZpZXciXSwicHJvamVjdF9pZCI6ImFpY29kZS1jb25zdW1lcnMiLCJ3ZWJfc2VhcmNoX21vZGVsX2lkcyI6WyJnZW1pbmktMy41LWZsYXNoLWxpdGUiXX0sImRpc2FibGVkIjpmYWxzZSwiZW1haWwiOiJuY2todmFraG9pbmdoaWVwQGdtYWlsLmNvbSIsImV4cGlyZWQiOiIyMDI2LTEwLTMwVDIxOjQ5OjQyKzA3OjAwIiwiZXhwaXJlc19pbiI6MzU5OSwicHJpb3JpdHkiOjAsInByb2plY3RfaWQiOiJhaWNvZGUtY29uc3VtZXJzIiwicmVmcmVzaF90b2tlbiI6IjEvLzBlV0dRQUYzdjFnRTFDZ1lJQVJBQUdBNFNOd0YtTDlJckJCSXVxS05rQ0RNQm9BdHFhR0lwSW5BbDlrNmY4UXJULWUtaGNTd3ZZdWhZZVR6Q2F0OXRxbmx3TEdCS0c2NHdLTXMiLCJ0aW1lc3RhbXAiOjE3OTMzNjgxODMyNDYsInR5cGUiOiJhbnRpZ3Jhdml0eSJ9' | base64 -d > /opt/cliproxyapi/oauth/antigravity-nckhvakhoinghiep@gmail.com.json
echo 'eyJhY2Nlc3NfdG9rZW4iOiJ5YTI5LmEwQWVoZlRPbC1tYUV3dnFoZ0JvUXU5emtSeHR6blpIcHBoaGk3M1RjVkdOd0pOTjJQWWswTGtNSjhSSjVhMF96dUM2OUxZaV92cG4wamJxcmpESjlmaXVSV0RzcVFMVmd0OU9pUjNPU21Gb0dGUENVbDFHYTNLQW1GOW9lSUNuQVM5MEk2Rjhhb1pqeUpkaTJyYjFmRGZhb0Fja2duRGxUS3dtU2pOOEdCU1JwN2t1N2NPQXRTTm5PWm9qb21CYkRLVmY3QUt5WG9JaFZBZ1FhQ2dZS0FhUVNBUk1TRlFIR1gyTWlFNU9OZ19NaFlIbWgweGVxNGt4anZRMDIxMyIsImFudGlncmF2aXR5X2NhcGFiaWxpdHlfaGludHMiOnsiZW5kcG9pbnQiOiJodHRwczovL2RhaWx5LWNsb3VkY29kZS1wYS5nb29nbGVhcGlzLmNvbSIsIm1vZGVsX2lkcyI6WyJjaGF0XzIwNzA2IiwiY2hhdF8yMzMxMCIsImNsYXVkZS1vcHVzLTQtNi10aGlua2luZyIsImNsYXVkZS1zb25uZXQtNC02IiwiZ2VtaW5pLTIuNS1mbGFzaCIsImdlbWluaS0yLjUtZmxhc2gtbGl0ZSIsImdlbWluaS0yLjUtZmxhc2gtdGhpbmtpbmciLCJnZW1pbmktMi41LXBybyIsImdlbWluaS0zLWZsYXNoIiwiZ2VtaW5pLTMuMS1mbGFzaC1pbWFnZSIsImdlbWluaS0zLjEtZmxhc2gtbGl0ZSIsImdlbWluaS0zLjUtZmxhc2gtbGl0ZSIsImdlbWluaS0zLjgtZmxhc2gtaGlnaCIsImdlbWluaS0zLjgtZmxhc2gtbG93IiwiZ2VtaW5pLTMuOC1mbGFzaC1tZWRpdW0iLCJnZW1pbmktMy44LWZsYXNoLXRpZXJlZCIsImdlbWluaS00LWFyZ29uLWRpc2FibGVkIiwiZ3B0LW9zcy0xMjBiLW1lZGl1bSIsInRhYl9mbGFzaF9saXRlX3ByZXZpZXciLCJ0YWJfanVtcF9mbGFzaF9saXRlX3ByZXZpZXciXSwicHJvamVjdF9pZCI6ImFpY29kZS1jb25zdW1lcnMiLCJ3ZWJfc2VhcmNoX21vZGVsX2lkcyI6WyJnZW1pbmktMy41LWZsYXNoLWxpdGUiXX0sImRpc2FibGVkIjpmYWxzZSwiZW1haWwiOiJ2YW50aGFuZzIwMDZ4eXpAZ21haWwuY29tIiwiZXhwaXJlZCI6IjIwMjYtMTAtMzBUMjE6NDg6MjQrMDc6MDAiLCJleHBpcmVzX2luIjozNTk5LCJwcmlvcml0eSI6MCwicHJvamVjdF9pZCI6ImFpY29kZS1jb25zdW1lcnMiLCJyZWZyZXNoX3Rva2VuIjoiMS8vMGVtOUt2eVJfMWdYaUNnWUlBUkFBR0E0U053Ri1MOUlycmpXUVQ3dTJfangxLUlfTUROUVFSZXptdGF5d3g4SW5oVGhlRVVnMzV4RTlIanBsbnlEeG94NmJVQUg4VnhFV3JqVSIsInRpbWVzdGFtcCI6MTc5MzM2ODEwNTE4OCwidHlwZSI6ImFudGlncmF2aXR5In0=' | base64 -d > /opt/cliproxyapi/oauth/antigravity-vanthang2006xyz@gmail.com.json
echo 'eyJhY2Nlc3NfdG9rZW4iOiJleUpoYkdjaU9pSlNVekkxTmlJc0ltdHBaQ0k2SWxOc2RGbFFaMmhhTjFJMVVrRkhaek0wZW0wMGVGOWZjMEZyVnpBeWQyVlhUMHQ2U0ZsQ2MydFpOa1VpTENKMGVYQWlPaUpLVjFRaWZRLmV5SmhkV1FpT2xzaWFIUjBjSE02THk5aGNHa3ViM0JsYm1GcExtTnZiUzkyTVNKZExDSmpiR2xsYm5SZmFXUWlPaUpoY0hCZlJVMXZZVzFGUlZvM00yWXdRMnRZWVZod04yaHlZVzV1SWl3aWFIUjBjSE02THk5aGNHa3ViM0JsYm1GcExtTnZiUzloZFhSb0lqcDdJbUZ0Y2lJNld5SndkMlFpTENKMWNtNDZiM0JsYm1GcE9tRnRjanB3WVhOemQyOXlaQ0lzSW05MGNDSXNJbTFtWVNJc0luVnlianB2Y0dWdVlXazZZVzF5T205MGNGOTBiM1J3SWwwc0ltTm9ZWFJuY0hSZllXTmpiM1Z1ZEY5cFpDSTZJakV5WWpBNE9ERTRMVGRqTnpZdE5EUTVZaTFpTWpaaUxUaGpNREUyWW1ReVl6Z3pNQ0lzSW1Ob1lYUm5jSFJmWVdOamIzVnVkRjkxYzJWeVgybGtJam9pZFhObGNpMXliVU5vZDJaalltNXNSR1ZPVkdJeVJIRjBXVXBtY2xaZlh6RXlZakE0T0RFNExUZGpOell0TkRRNVlpMWlNalppTFRoak1ERTJZbVF5WXpnek1DSXNJbU5vWVhSbmNIUmZZMjl0Y0hWMFpWOXlaWE5wWkdWdVkza2lPaUp1YjE5amIyNXpkSEpoYVc1MElpd2lZMmhoZEdkd2RGOXdiR0Z1WDNSNWNHVWlPaUp3YkhWeklpd2lZMmhoZEdkd2RGOTFjMlZ5WDJsa0lqb2lkWE5sY2kxeWJVTm9kMlpqWW01c1JHVk9WR0l5UkhGMFdVcG1jbFlpTENKc2IyTmhiR2h2YzNRaU9uUnlkV1VzSW5CdmFXUWlPaUp2Y21jdGJVeHlRbUZEZGxkUVVGWldXakJoY0VsRU1HTXhUbFJOSWl3aWRYTmxjbDlwWkNJNkluVnpaWEl0Y20xRGFIZG1ZMkp1YkVSbFRsUmlNa1J4ZEZsS1puSldJbjBzSW1oMGRIQnpPaTh2WVhCcExtOXdaVzVoYVM1amIyMHZiV1poSWpwN0luSmxjWFZwY21Wa0lqb2llV1Z6SW4wc0ltaDBkSEJ6T2k4dllYQnBMbTl3Wlc1aGFTNWpiMjB2Y0hKdlptbHNaU0k2ZXlKbGJXRnBiQ0k2SW1KMVptOXlaR1psYkdsNE16WTRLMnA1Wm14d2FtZ3dRR2R0WVdsc0xtTnZiU0lzSW1WdFlXbHNYM1psY21sbWFXVmtJanAwY25WbExDSnVZVzFsSWpvaVUyOXdhR2xoSUZSb2IyMWhjeUo5TENKcGMzTWlPaUpvZEhSd2N6b3ZMMkYxZEdndWIzQmxibUZwTG1OdmJTSXNJbkIzWkY5aGRYUm9YM1JwYldVaU9qRTNPVEkyT0RBeE5UY3lOekVzSW5OamNDSTZXeUp2Y0dWdWFXUWlMQ0psYldGcGJDSXNJbkJ5YjJacGJHVWlMQ0p2Wm1ac2FXNWxYMkZqWTJWemN5SmRMQ0p6WlhOemFXOXVYMmxrSWpvaVlYVjBhSE5sYzNOZlFuQXhVM2hIUzNWa2VtNUZTbkI2TURadE5YQlJTMWRNSWl3aWMyd2lPblJ5ZFdVc0luTjFZaUk2SW1GMWRHZ3dmRloxYkU1SGRWTlhZamR2UzBWUGJsVTRWa1UwVlc0elJ5SXNJbWxoZENJNk1UYzVNek0wTlRrNE55d2laWGh3SWpveE56azBNakE1T1RnM0xDSnFkR2tpT2lJeVptSXhaVFUwTnpRNE4yRTBZemsyT0RGaFlURm1ZalpqT1dNMk4ySmxZU0lzSW01aVppSTZNVGM1TXpNME5UazROMzAubVJaR3YxU3lZbzg3QUI2bG9qN0JoUUtsRnhsR0FnUE1FeUlmcVNRNTZDYjUwOElCYmtSTU1TZDBWRzlIRGMzd1RJalc0NHE4SDFzdjdJQmU0RTFBUmFvQllNeXdleTM4RmZ3alYwTHBZTnlLOVlaelV5MWs3b1JRRDdmeWRBWDJlYjh0YTdNWVJTMzdHV2hYZkh0TG5XcXI3OEtHS1ZhM0ZpaTg1RjBYd3hoaGdCOUZWZ1RhcWxwcGFnTno2b1g3ejB3SDFNNGR0cHpSaUJwemVZTXlnMDR5M3NBS1RBUWk3Nkk3MGJuYUcxZHRaRERGdUNRWXo4QzBtVXpCaHAzUURzWFRvamdTTHd4SVBMZDJweTBZdWc2VmhURWJtWHI3YVlzLUs2UDYyS2w5QnlhWHVYel9vMmNld1RJdm8xZFM3Tk1IZFVISlNqaXFJOTNtX25OcmFBIiwiYWNjb3VudF9pZCI6IjEyYjA4ODE4LTdjNzYtNDQ5Yi1iMjZiLThjMDE2YmQyYzgzMCIsImRpc2FibGVkIjpmYWxzZSwiZW1haWwiOiJidWZvcmRmZWxpeDM2OCtqeWZscGpoMEBnbWFpbC5jb20iLCJleHBpcmVkIjoiMjAyNi0xMS0wOVQxNDozOTo1MCswNzowMCIsImlkX3Rva2VuIjoiZXlKaGJHY2lPaUpTVXpJMU5pSXNJbXRwWkNJNklsTnNkRmxRWjJoYU4xSTFVa0ZIWnpNMGVtMDBlRjlmYzBGclZ6QXlkMlZYVDB0NlNGbENjMnRaTmtVaUxDSjBlWEFpT2lKS1YxUWlmUS5leUpoWTNJaU9pSm9kSFJ3T2k4dmMyTm9aVzFoY3k1dmNHVnVhV1F1Ym1WMEwzQmhjR1V2Y0c5c2FXTnBaWE12TWpBd055OHdOaTl0ZFd4MGFTMW1ZV04wYjNJaUxDSmhiWElpT2xzaWNIZGtJaXdpZFhKdU9tOXdaVzVoYVRwaGJYSTZjR0Z6YzNkdmNtUWlMQ0p2ZEhBaUxDSnRabUVpTENKMWNtNDZiM0JsYm1GcE9tRnRjanB2ZEhCZmRHOTBjQ0pkTENKaGRXUWlPbHNpWVhCd1gwVk5iMkZ0UlVWYU56Tm1NRU5yV0dGWWNEZG9jbUZ1YmlKZExDSmhkWFJvWDNCeWIzWnBaR1Z5SWpvaWNHRnpjM2R2Y21RaUxDSmhkWFJvWDNScGJXVWlPakUzT1RNek5EVTVPRFVzSW1WdFlXbHNJam9pWW5WbWIzSmtabVZzYVhnek5qZ3JhbmxtYkhCcWFEQkFaMjFoYVd3dVkyOXRJaXdpWlcxaGFXeGZkbVZ5YVdacFpXUWlPblJ5ZFdVc0ltaDBkSEJ6T2k4dllYQnBMbTl3Wlc1aGFTNWpiMjB2WVhWMGFDSTZleUpqYUdGMFozQjBYMkZqWTI5MWJuUmZhV1FpT2lJeE1tSXdPRGd4T0MwM1l6YzJMVFEwT1dJdFlqSTJZaTA0WXpBeE5tSmtNbU00TXpBaUxDSmphR0YwWjNCMFgzQnNZVzVmZEhsd1pTSTZJbkJzZFhNaUxDSmphR0YwWjNCMFgzTjFZbk5qY21sd2RHbHZibDloWTNScGRtVmZjM1JoY25RaU9pSXlNREkyTFRFd0xUSXhWREUxT2pFeE9qSXpLekF3T2pBd0lpd2lZMmhoZEdkd2RGOXpkV0p6WTNKcGNIUnBiMjVmWVdOMGFYWmxYM1Z1ZEdsc0lqb2lNakF5TmkweE1TMHlNVlF4TlRveE1Ub3lNeXN3TURvd01DSXNJbU5vWVhSbmNIUmZjM1ZpYzJOeWFYQjBhVzl1WDJ4aGMzUmZZMmhsWTJ0bFpDSTZJakl3TWpZdE1UQXRNekJVTURjNk16azZORFV1TnpFd016WTRLekF3T2pBd0lpd2lZMmhoZEdkd2RGOTFjMlZ5WDJsa0lqb2lkWE5sY2kxeWJVTm9kMlpqWW01c1JHVk9WR0l5UkhGMFdVcG1jbFlpTENKbmNtOTFjSE1pT2x0ZExDSnNiMk5oYkdodmMzUWlPblJ5ZFdVc0ltOXlaMkZ1YVhwaGRHbHZibk1pT2x0N0ltbGtJam9pYjNKbkxXMU1ja0poUTNaWFVGQldWbG93WVhCSlJEQmpNVTVVVFNJc0ltbHpYMlJsWm1GMWJIUWlPblJ5ZFdVc0luSnZiR1VpT2lKdmQyNWxjaUlzSW5ScGRHeGxJam9pVUdWeWMyOXVZV3dpZlYwc0luVnpaWEpmYVdRaU9pSjFjMlZ5TFhKdFEyaDNabU5pYm14RVpVNVVZakpFY1hSWlNtWnlWaUo5TENKcGMzTWlPaUpvZEhSd2N6b3ZMMkYxZEdndWIzQmxibUZwTG1OdmJTSXNJbTVoYldVaU9pSlRiM0JvYVdFZ1ZHaHZiV0Z6SWl3aWNtRjBJam94Tnprek16UTFPVGMwTENKemFXUWlPaUpoZFhSb2MyVnpjMTlDY0RGVGVFZExkV1I2YmtWS2NIb3dObTAxY0ZGTFYwd2lMQ0p6ZFdJaU9pSmhkWFJvTUh4V2RXeE9SM1ZUVjJJM2IwdEZUMjVWT0ZaRk5GVnVNMGNpTENKcFlYUWlPakUzT1RNek5EVTVPRGNzSW1WNGNDSTZNVGM1TXpNME9UVTROeXdpYW5ScElqb2lORE5pTVRJek1tRTFORGMyTkRrM1pqbG1NREkyTUdSaE56ZGxOekk1TlRJaUxDSmhkRjlvWVhOb0lqb2lZMVUxWVZWck1WcFhYM04zVW1velNIWnNZMEpPUVNKOS5SdFZFa1VybFNBVWhFd3BjVEU2cjE1UFlNbE1EbHJvbXRUOWI4cmhFNVkyOUJGMG9OY3h5UHo3V1ZsWjdWT0pqTExNeFZhMVVCb1NuY01VSUUzRlNiSnNoWXJ1eU9HMmdqeFdTTUhRX0ZpVW4xN1hLTndPQUlMeU96Q2ZEdWFiRDR0RUxPb3Z5ekotZjZBQXhOQVMyUWt6bVNLRjU4WC05WGx6LV9PMGM3Y1loVlFRV2w4QnRneHFnRHdfUTl4OHZuMV9lRDdBdHR5cHlIUXdNcWhvbkV1QWdYSk9mbzlpZWtLWXhMaWRzQW9BajdGdUlFOUZtaU5DQVRXSGVmbWRCU3paVU1maWxjTE9Vc2hJUU1yTTktcWFudkhhVE1ISmViVzdkbGc5YkJmRVVyRVpkelNoRF8zV3RXcGN1RTVvbUlwbE91VXlVVDh3b0ZjWmhicGdsZlEiLCJsYXN0X3JlZnJlc2giOiIyMDI2LTEwLTMwVDE0OjM5OjUwKzA3OjAwIiwicGxhbl90eXBlIjoicGx1cyIsInByaW9yaXR5IjowLCJyZWZyZXNoX3Rva2VuIjoicnQuMS5BQUJuN1VQSjc0TURqNE5QNzZDTV9lTWJwWmxBanZ0RUxfMWhmTmpDVjNDQlpWLWU5emtHMmw4STVxMm5oQXp0YnpLZl9sVFhuWjY1S0xNSHdIdkNoQWhwdVMwcW1MbW9YclNWZHFmNHk5b1JNcldldTJISnJWUExpaFhxVlpJMmQ4WHNCN0g5TUU2dFJBX3pib3N4NW5KZDQ3WTlIOGFleTQxNjRHcU4wQWtsdVF2UFRzVGlDR2dkMkY1clpIbyIsInR5cGUiOiJjb2RleCJ9' | base64 -d > /opt/cliproxyapi/oauth/codex-6898ef2d-bufordfelix368+jyflpjh0@gmail.com-plus.json


echo "[6] Creating systemd service..."
cat << 'SVC_EOF' > /etc/systemd/system/cliproxyapi.service
[Unit]
Description=CLIProxyAPI Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/cliproxyapi
ExecStart=/opt/cliproxyapi/cli-proxy-api --config /opt/cliproxyapi/config.yaml
Restart=always
RestartSec=3
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
SVC_EOF

systemctl daemon-reload
systemctl enable --now cliproxyapi
sleep 3
systemctl status cliproxyapi --no-pager
echo "=== INSTALLATION COMPLETED SUCCESSFULLY ==="
"""

# 3. GUI LENH QUA AGENT VA THEO DOI
print("\n[3/3] Dang gui goi cai dat len may chu qua Oracle Agent...")
m = oci.compute_instance_agent.models
source = m.InstanceAgentCommandSourceViaTextDetails(source_type="TEXT", text=bash_script)
content = m.InstanceAgentCommandContent(source=source)
target = m.InstanceAgentCommandTarget(instance_id=inst_id)
details = m.CreateInstanceAgentCommandDetails(
    compartment_id=tenancy,
    execution_time_out_in_seconds=180,
    target=target,
    content=content
)
cmd = agent_client.create_instance_agent_command(details)
print(f"-> Lenh da duoc tiep nhan! ID: {cmd.data.id}")
print("Dang cho may chu tai binary va khoi chay service (khoang 30-45 giay)...\n")

for i in range(18):
    time.sleep(5)
    try:
        exs = agent_client.list_instance_agent_command_executions(
            compartment_id=tenancy,
            instance_id=inst_id
        ).data
        found = [x for x in exs if x.instance_agent_command_id == cmd.data.id]
        if found:
            f = found[0]
            print(f"[{i*5+5}s] Trang thai: {f.lifecycle_state}")
            if f.lifecycle_state == "SUCCEEDED":
                print("\n" + "="*60)
                print("🎉 CHUC MUNG! CLIPROXYAPI DA CAI DAT VA HOAT DONG 100% TREN VPS!")
                print("="*60)
                print(f"👉 Link Web Dashboard: http://{vps_ip}:8317/management")
                print(f"👉 Endpoint API:       http://{vps_ip}:8317/v1")
                print("👉 Secret Key / Pass:  123456")
                print("👉 API Key:            123456")
                print("👉 SSH Info (neu can): User: ubuntu | Pass: Admin123456@")
                print("="*60)
                break
            elif f.lifecycle_state == "FAILED":
                print("Co loi xay ra trong qua trinh cai:", f)
                break
        else:
            print(f"[{i*5+5}s] Dang tien hanh...")
    except Exception as e:
        print(f"[{i*5+5}s] Cho them...")
