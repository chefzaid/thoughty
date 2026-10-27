# Repository Onboarding

Register Thoughty with the `swirl-cloud` platform once per cluster. Run `./add-repos.sh` from the `swirl-cloud` checkout on an operator host, enter this GitHub repository, and select it for deployment. The installer offers the same flow. You can select an already imported repository again.

## What the platform reads

The platform reads [`infra/onboarding.json`](../infra/onboarding.json). It never runs downloaded setup scripts. The declaration requests:

- a public subdomain (default `thoughty`; `@` selects the zone apex);
- GitLab, registry, ingress/TLS, shared-service, and authentication settings, applied as text replacements in the listed files;
- a registry pull credential and the Vault paths `apps/thoughty/database`, `apps/thoughty/app`, and `apps/thoughty/backup`;
- the DNS record for the app host (see [Public DNS](deployment.md#public-dns));
- a first pipeline, then readiness of the API, web, and worker Deployments.

The chosen settings are committed to `infra/onboarding-values.json` with the rendered files. Later runs offer them again. Changing the domain or GitLab group updates the same installation. Resource names, the database identity, and Vault paths stay fixed, so one cluster holds one Thoughty installation.

## Secrets and features

The platform generates the database password, `JWT_SECRET`, `REFRESH_SECRET`, `TWO_FACTOR_SECRET`, `UNSUBSCRIBE_SECRET`, and `CONFIG_ENCRYPTION_SECRET` when missing, and keeps existing values. Secrets stay in Vault, never in the settings file. S3, AI, cloud-provider, SMTP, and backup fields start empty. Onboarding does not provision attachment storage, and the backup CronJob stays suspended. Authentication uses the shared OAuth2 Proxy client; no Thoughty Keycloak client is created. See [Configuration and Secrets](deployment.md#configuration-and-secrets).

## First pipeline

Onboarding starts an API pipeline with `APP_ONBOARDING=true` and pins it to `ONBOARDING_EXPECTED_SHA`. Only that default-branch commit may publish, and deploy refuses if the branch moved. `01-build`, `03-package`, `01-release`, and `02-deploy` must succeed. Other pipelines keep their normal release rules (see [Delivery Pipeline](deployment.md#delivery-pipeline)).

The onboarding release commit carries `Onboarding-Pipeline` and `Onboarding-Source` trailers so a repeat run can find it.

| Failure | Recovery |
|---|---|
| Deploy failed | Retry that pipeline's `02-deploy` job. |
| Publication failed after its Git push | Fix the failed step first. The guard refuses to publish again from the old checkout. |

Re-running onboarding keeps the `Application`'s selected path (standard or HA). It does not migrate databases. `infra/scripts/configure-gitlab.sh` is a separate manual admin helper, not an onboarding hook.

## Local check

```sh
python3 infra/scripts/test-onboarding.py
```

The tests use temporary repositories and local fixtures. When `kubectl` is available they also render the `swirl-cloud`, HA, and canary profiles.
