import oci

config = oci.config.from_file()
client = oci.compute_instance_agent.ComputeInstanceAgentClient(config)
m = oci.compute_instance_agent.models

inst_id = "ocid1.instance.oc1.ap-singapore-1.anzwsljr3epcpnac5v2gfnnn73idx6koglvtto6za74ltwnpnmahbk2clpea"
pub_key = "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQClWTXEgGl5xK8RMZJ/wDLIcvRpQ9URgP4pU6qNCO6fOMpVOfp2wH4SsUjDIjY6v8cP5iy6cDeL7CIsPDI5xASVHtjDCKaq7/ED6LMbLhIY88ipLHpNg9rG63tDrtZmMO2baG+H2NTFeDbtZy9l8Fws4nr85M3jutSw2b9n1Mfhs0r3xKqERKGugsI5joSZdBU+JRmFkDOOI0lboDtVeAxVBUY5II/sgfOYdjjD3kWcHophOM2XsWVvpJ8cNLdJezMUodoaHY2bA/wVP4T2bFXB4B/ccwCb0uU4+EndA8h9DK0DfqIWG1JWvC5NF9wyNb/98Rtsxhn98DQKnWn4Tkt3 rsa-key-20261030"

script = f"""#!/bin/bash
mkdir -p /home/ubuntu/.ssh /home/opc/.ssh /root/.ssh
echo '{pub_key}' >> /home/ubuntu/.ssh/authorized_keys
echo '{pub_key}' >> /home/opc/.ssh/authorized_keys
echo '{pub_key}' >> /root/.ssh/authorized_keys
chown -R ubuntu:ubuntu /home/ubuntu/.ssh 2>/dev/null || true
chown -R opc:opc /home/opc/.ssh 2>/dev/null || true
chmod 700 /home/ubuntu/.ssh /home/opc/.ssh /root/.ssh 2>/dev/null || true
chmod 600 /home/ubuntu/.ssh/authorized_keys /home/opc/.ssh/authorized_keys /root/.ssh/authorized_keys 2>/dev/null || true
iptables -I INPUT 1 -p tcp --dport 8317 -j ACCEPT
iptables -I INPUT 1 -p tcp --dport 80 -j ACCEPT
netfilter-persistent save 2>/dev/null || true
firewall-cmd --add-port=8317/tcp --permanent 2>/dev/null || true
firewall-cmd --add-port=80/tcp --permanent 2>/dev/null || true
firewall-cmd --reload 2>/dev/null || true
echo KEY_INJECTED_SUCCESSFULLY
"""

source = m.InstanceAgentCommandSourceViaTextDetails(source_type="TEXT", text=script)
content = m.InstanceAgentCommandContent(source=source)
target = m.InstanceAgentCommandTarget(instance_id=inst_id)
details = m.CreateInstanceAgentCommandDetails(compartment_id=config["tenancy"], execution_time_out_in_seconds=60, target=target, content=content)
resp = client.create_instance_agent_command(details)
print("DA_GUI_LENH_NAP_KHOA_THANH_CONG! ID:", resp.data.id)
