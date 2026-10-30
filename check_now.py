import oci
import json

config = oci.config.from_file()
compute_client = oci.core.ComputeClient(config)
agent_client = oci.compute_instance_agent.ComputeInstanceAgentClient(config)

inst_id = "ocid1.instance.oc1.ap-singapore-1.anzwsljr3epcpnac5v2gfnnn73idx6koglvtto6za74ltwnpnmahbk2clpea"
tenancy = config["tenancy"]

print("=== KIEM TRA PLUGINS CUA INSTANCE ===")
inst = compute_client.get_instance(inst_id).data
print("Ten may:", inst.display_name)
print("Metadata keys:", list((inst.metadata or {}).keys()))

ac = inst.agent_config
if ac:
    print("Management disabled:", ac.is_management_disabled)
    print("Monitoring disabled:", ac.is_monitoring_disabled)
    for p in (ac.plugins_config or []):
        print(f"  Plugin: {p.name} -> {p.desired_state}")
else:
    print("Agent config is None")

print("\n=== KIEM TRA TRANG THAI LENH AGENT ===")
for cmd_id in [
    "ocid1.instanceagentcommand.oc1.ap-singapore-1.amaaaaaa3epcpnaaz2h6bmzq6p3bqxxq2lz5gyyhpyspq73ikwla57hd2nwa",
    "ocid1.instanceagentcommand.oc1.ap-singapore-1.amaaaaaa3epcpnaafshv23huaffspsbv5paebt37rsrtifzttuufaodhof3q"
]:
    try:
        execs = agent_client.list_instance_agent_command_executions(
            compartment_id=tenancy,
            instance_id=inst_id,
            instance_agent_command_id=cmd_id
        ).data
        print(f"CMD {cmd_id[-10:]}: Co {len(execs)} execution(s)")
        for ex in execs:
            print(f"  Lifecycle: {ex.lifecycle_state}, Delivery: {ex.delivery_state}")
    except Exception as e:
        print(f"CMD {cmd_id[-10:]} Loi: {e}")

print("\n=== THU BAT PLUGIN RUN COMMAND VA UPDATE SSH KEY ===")
pub_key = "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQClWTXEgGl5xK8RMZJ/wDLIcvRpQ9URgP4pU6qNCO6fOMpVOfp2wH4SsUjDIjY6v8cP5iy6cDeL7CIsPDI5xASVHtjDCKaq7/ED6LMbLhIY88ipLHpNg9rG63tDrtZmMO2baG+H2NTFeDbtZy9l8Fws4nr85M3jutSw2b9n1Mfhs0r3xKqERKGugsI5joSZdBU+JRmFkDOOI0lboDtVeAxVBUY5II/sgfOYdjjD3kWcHophOM2XsWVvpJ8cNLdJezMUodoaHY2bA/wVP4T2bFXB4B/ccwCb0uU4+EndA8h9DK0DfqIWG1JWvC5NF9wyNb/98Rtsxhn98DQKnWn4Tkt3 rsa-key-20261030"

# Thu chi update metadata ssh_authorized_keys
try:
    up1 = oci.core.models.UpdateInstanceDetails(
        metadata={"ssh_authorized_keys": pub_key}
    )
    compute_client.update_instance(inst_id, up1)
    print("[1] Update metadata ssh_authorized_keys: THANH CONG!")
except Exception as e:
    print("[1] Update metadata loi:", getattr(e, 'message', str(e)))

# Thu chi update agent_config
try:
    plugin = oci.core.models.InstanceAgentPluginConfigDetails(
        name="Compute Instance Run Command",
        desired_state="ENABLED"
    )
    ac_up = oci.core.models.UpdateInstanceAgentConfigDetails(
        is_management_disabled=False,
        plugins_config=[plugin]
    )
    up2 = oci.core.models.UpdateInstanceDetails(agent_config=ac_up)
    compute_client.update_instance(inst_id, up2)
    print("[2] Update agent_config: THANH CONG!")
except Exception as e:
    print("[2] Update agent_config loi:", getattr(e, 'message', str(e)))
