# Security Policy

## Report a vulnerability

Use [GitHub Private Vulnerability Reporting](https://github.com/jonaxliang/forge/security/advisories/new)
to report a suspected vulnerability. Do not include exploit details, credentials,
or sensitive data in a public issue.

Include the affected version or commit, the deployment configuration, steps to
reproduce, the expected impact, and any suggested mitigation. The maintainers
will use the private advisory to coordinate follow-up and disclosure.

## Current security boundary

Forge is early-stage software intended for a trusted, single-user environment.
The default server listener is loopback-only. A non-loopback listener must be
protected with Forge's server token, network access controls, and TLS at a
trusted reverse proxy. Do not expose Forge directly to the public internet.

The local bridge connects outbound to Forge. Commands run by a configured Agent
Binding have the permissions of the operating-system user running the bridge.
Review Agent Binding commands and protect bridge and server tokens.

Forge currently uses SQLite. Project records, workflow definitions, run output,
bridge output, and execution settings are stored on the Forge Server. Provider
API keys are stored unencrypted in the SQLite database; their values are omitted
from settings API responses after saving. Restrict access to the database,
backups, logs, and the host account.

Do not commit `.forge` databases, `.env*` files, tokens, API keys, private keys,
certificates, or generated Artifacts containing sensitive data.

## Supported versions

Security fixes are applied to the current default branch. No long-term support
or backport policy is available yet.
