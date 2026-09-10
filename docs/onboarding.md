# Repository onboarding

Run `./add-repos.sh` from the `bm-cluster` checkout on an operator host, enter this
GitHub repository, and select it for deployment. The installer offers the same
flow. A repository already imported into GitLab can be selected again.

The platform reads [`infra/onboarding.json`](../infra/onboarding.json); it does
not execute downloaded setup scripts. The declaration requests:

- a public subdomain, defaulting to `thoughty` (`@` selects the zone apex);
- durable GitLab, registry, ingress/TLS, shared-service and authentication settings;
- registry access and the Vault contracts required by database and runtime hooks;
- the application DNS record, using direct ingress or the published HA Tunnel;
- a first pipeline, followed by verification of the API, web and worker Deployments.

Public settings and replacement bindings are committed to
`infra/onboarding-values.json` alongside the rendered configuration. Subsequent
runs offer those settings again; changing a domain or GitLab group updates the
same application. Resource names, database identity and Vault paths remain
Thoughty's, so this contract supports one installation per cluster.

The platform creates missing database/signing/encryption values and preserves
existing secrets. They remain in Vault, never in the settings file. Optional S3,
AI, cloud-provider, SMTP and backup fields start empty. Configure those providers
before enabling their features; attachment storage is not provisioned by this
contract. The backup CronJob remains suspended. Authentication uses the existing
shared OAuth2 Proxy client; no Thoughty-specific Keycloak client is created.

Onboarding starts an API pipeline with `APP_ONBOARDING=true` and pins its source
using `ONBOARDING_EXPECTED_SHA`. Only that default-branch source may publish, and
deployment refuses a branch that advanced unexpectedly. `01-build`, `03-package`,
`01-release` and `02-deploy` must succeed. Ordinary API and push pipelines retain
manual release, the existing full web pipeline remains automatic, and Sonar-only
pipelines cannot release. Image updates continue to use the configured registry
and project on later releases.

The final onboarding publication records `Onboarding-Pipeline` and
`Onboarding-Source` commit trailers so a repeat run can identify the existing
release. A failed deployment can retry that pipeline's deploy job. If publication
fails after its Git push, repair the failed publication step before retrying:
the guard refuses to publish another release from the old checkout.

The existing `configure-gitlab.sh` is a separate manual administration helper;
it is not an onboarding hook. Optional features and HA activation remain covered
by the [deployment guide](deployment.md). Re-running onboarding preserves the
Application's selected base or HA path; it does not migrate databases.

Validate the contract and publication guards locally with:

```sh
python3 infra/scripts/test-onboarding.py
```

The tests use temporary repositories and local fixtures. They also render both
Kustomize profiles when `kubectl` is available.
