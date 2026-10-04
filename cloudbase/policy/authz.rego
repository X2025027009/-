package authz.user

default allow := false

# Gateway authorization policy for this environment (OPA / Rego).
#
# Why this file exists:
#   After the environment migration, anonymous visitors were blocked when calling
#   cloud functions via the SDK (`EXCEED_AUTHORITY`), which meant visitors could
#   not submit adoption applications at all.
#
#   Verified boundary before this policy (by intercepting the SDK's requests):
#     POST /v1/functions/yard-api   -> resource_type "functions"  BLOCKED
#     GET  /v1/rdb/rest/pets        -> resource_type "rdb"        allowed
#     POST /auth/v1/signin/anonymously                            allowed
#
#   So only "functions" was missing. The other two resource types are listed
#   explicitly so this policy stays self-sufficient instead of relying on
#   implicit platform defaults.
#
# Is this safe?
#   Yes. Cloud functions authorize every privileged action in-function via
#   `requireAdmin`, which checks the caller's UID against the
#   `yard_administrators` table. That layer is stricter than any gateway rule
#   could be, because it can identify an administrator individually.
#
# Apply with:
#   tcb policy set "$(cat cloudbase/policy/authz.rego)" -e <envId>

allow if {
  not input.subject.auth_type == "unauthenticated"
  input.cloudbase.resource_type in {"functions", "rdb", "storages"}
}
