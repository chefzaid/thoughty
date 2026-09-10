#!/usr/bin/env python3
"""Local contract/rendering and publication-safety tests; no remote services."""
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import unittest

import yaml

ROOT = Path(__file__).resolve().parents[2]
CONTRACT = json.loads((ROOT / "infra/onboarding.json").read_text())
WEBSITE = CONTRACT["readiness"]["deployments"] == ["website"]
PROFILE = "infra/k8s" if WEBSITE else "infra/k8s/overlays/bm-cluster"


def context(domain="cluster.example", project="team/product"):
    return {
        "PUBLIC_DOMAIN": domain, "INTERNAL_DNS_ZONE": "services.internal",
        "APP_SUBDOMAIN": "portal", "APP_HOST": "portal." + domain,
        "APP_ALIAS": "welcome", "POD_CIDR": "10.60.0.0/16",
        "TRUSTED_PROXY_CIDRS": "10.60.0.0/16",
        "TLS_SECRET_NAME": "cluster-example-tls",
        "GITLAB_PROJECT_PATH": project, "GITLAB_PROJECT_ID": "42",
        "GITLAB_PUBLIC_URL": "https://gitlab." + domain,
        "GITLAB_INTERNAL_URL": "http://gitlab.services.internal",
        "GITLAB_REPOSITORY_URL": "http://gitlab.services.internal/" + project + ".git",
        "REGISTRY_HOST": "registry." + domain,
        "REGISTRY_PUSH_HOST": "gitlab-registry.services.internal:5050",
        "GITHUB_OWNER": "operator", "GITHUB_REPOSITORY": "product",
        "DEFAULT_BRANCH": "production", "KEYCLOAK_REALM": "company",
        "PLATFORM_SECURITY_PROJECT_PATH": "team/security",
        "SONAR_PROJECT_KEY": project.replace("/", ":"),
    }


def expand(value, values):
    return re.sub(r"\{\{([A-Z_]+)\}\}", lambda match: values[match[1]], value)


def render(directory, values):
    """Exercise the documented simultaneous replacement contract on a copy."""
    state_path = directory / "infra/onboarding-values.json"
    state = json.loads(state_path.read_text()) if state_path.exists() else {}
    prior = state.get("bindings", {})
    substitutions = {}
    bindings = {}
    for rule in CONTRACT["replacements"]:
        before = prior.get(rule["from"], rule["from"])
        after = expand(rule["to"], values)
        if before in substitutions and substitutions[before] != after:
            raise AssertionError("Ambiguous prior rendering")
        substitutions[before] = after
        bindings[rule["from"]] = after
    pattern = re.compile("|".join(re.escape(old) for old in sorted(substitutions, key=len, reverse=True)))
    for filename in CONTRACT["files"]:
        path = directory / filename
        path.write_text(pattern.sub(lambda match: substitutions[match[0]], path.read_text()))
    # Application source/revision are normalized by the platform orchestrator.
    path = directory / CONTRACT["application"]
    application = yaml.safe_load(path.read_text())
    application["spec"]["source"].update(repoURL=values["GITLAB_REPOSITORY_URL"], targetRevision=values["DEFAULT_BRANCH"])
    path.write_text(yaml.safe_dump(application, sort_keys=False))
    state_path.write_text(json.dumps({"version": 1, "context": values, "bindings": bindings}))


def copy_repository(destination):
    shutil.copytree(ROOT / "infra", destination / "infra")
    for name in CONTRACT["files"]:
        path = destination / name
        if not path.exists():
            path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / name, path)
    return destination


def git(directory, *args):
    return subprocess.check_output(["git", *args], cwd=directory, text=True, stderr=subprocess.DEVNULL).strip()


def job_when(pipeline, name, **values):
    for rule in pipeline[name]["rules"]:
        condition = rule.get("if")
        if condition:
            result = subprocess.run(["bash", "-c", "if [[ " + condition + " ]]; then exit 0; else exit 1; fi"],
                                    env={**os.environ, **values}, capture_output=True)
            if result.returncode:
                continue
        return rule.get("when", "on_success")
    return "never"


class OnboardingTests(unittest.TestCase):
    def test_publication_commit_marks_only_onboarding_and_supports_same_image(self):
        with tempfile.TemporaryDirectory(prefix="onboarding-commit-test.") as directory:
            work = Path(directory)
            def run(*arguments, environment=None, check=True):
                return subprocess.run(arguments, cwd=work, env=environment, check=check,
                                      text=True, capture_output=True)
            run("git", "init", "-q", "-b", "main")
            run("git", "config", "user.name", "Onboarding test")
            run("git", "config", "user.email", "test@example.invalid")
            run("git", "config", "commit.gpgsign", "false")
            (work / "config").write_text("public settings")
            run("git", "add", ".")
            helper = str(ROOT / "infra/scripts/commit-deployment.sh")
            ordinary = {**os.environ, "APP_ONBOARDING": "false"}
            run("bash", helper, "ordinary deployment", environment=ordinary)
            initial = run("git", "rev-parse", "HEAD").stdout.strip()
            self.assertNotIn("Onboarding-", run("git", "show", "-s", "--format=%B").stdout)
            environment = {**os.environ, "APP_ONBOARDING": "true", "CI_PIPELINE_ID": "73", "CI_COMMIT_SHA": initial}
            # Even an unchanged image gets an identifiable successful publication.
            run("bash", helper, "onboarding deployment", environment=environment)
            published = run("git", "rev-parse", "HEAD").stdout.strip()
            self.assertNotEqual(published, initial)
            trailers = run("git", "show", "-s", "--format=%(trailers)").stdout
            self.assertEqual(trailers.splitlines(), ["Onboarding-Pipeline: 73", "Onboarding-Source: " + initial, ""])
            result = run("bash", helper, "invalid metadata", environment={**environment, "CI_PIPELINE_ID": ""}, check=False)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(run("git", "rev-parse", "HEAD").stdout.strip(), published)

    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="app-onboarding-test.")
        self.addCleanup(self.temporary.cleanup)
        self.directory = Path(self.temporary.name)
        self.copy = copy_repository(self.directory / "repository")

    def test_custom_domain_group_and_repeat_configuration(self):
        first = context()
        render(self.copy, first)
        before = {name: (self.copy / name).read_bytes() for name in CONTRACT["files"]}
        render(self.copy, first)
        self.assertEqual(before, {name: (self.copy / name).read_bytes() for name in CONTRACT["files"]})
        values = context("replacement.example", "different/copied-app")
        render(self.copy, values)
        pipeline = yaml.safe_load((self.copy / ".gitlab-ci.yml").read_text())
        self.assertEqual(pipeline["variables"]["REGISTRY_PUSH_HOST"], values["REGISTRY_PUSH_HOST"])
        application = yaml.safe_load((self.copy / CONTRACT["application"]).read_text())
        self.assertEqual(application["spec"]["source"]["repoURL"], values["GITLAB_REPOSITORY_URL"])
        self.assertEqual(application["spec"]["source"]["targetRevision"], "production")
        self.assertIn(values["SONAR_PROJECT_KEY"], (self.copy / "sonar-project.properties").read_text())
        workflow = yaml.safe_load((self.copy / ".github/workflows/sync-gitlab.yml").read_text())
        workflow_env = workflow["jobs"]["sync-repository"]["env"]
        if workflow_env.get("GITLAB_REPOSITORY") == "${{ vars.GITLAB_REPOSITORY }}":
            # The platform-installed reconciler takes settings from GitHub Variables.
            self.assertEqual(workflow_env["GITLAB_API_URL"], "${{ vars.GITLAB_API_URL }}")
            self.assertEqual(workflow_env["GITLAB_HOST"], "${{ vars.GITLAB_HOST }}")
        else:
            self.assertEqual(workflow_env["GITLAB_REPOSITORY"],
                             values["GITLAB_PUBLIC_URL"] + "/" + values["GITLAB_PROJECT_PATH"] + ".git")

        manifest = yaml.safe_load((self.copy / PROFILE / "kustomization.yaml").read_text())
        if WEBSITE:
            subprocess.run(["bash", "infra/scripts/set-image-digest.sh", "sha256:" + "b" * 64], cwd=self.copy, check=True)
            updated = yaml.safe_load((self.copy / PROFILE / "kustomization.yaml").read_text())
            self.assertEqual(updated["images"][0]["digest"], "sha256:" + "b" * 64)
            self.assertEqual(updated["images"][0]["name"], values["REGISTRY_HOST"] + "/" + values["GITLAB_PROJECT_PATH"] + "/site")
            self.assertIn("https://" + values["APP_HOST"], (self.copy / "data/site.ts").read_text())
            self.assertIn("email: 'contact@swirlit.dev'", (self.copy / "data/site.ts").read_text())
        else:
            subprocess.run(["sh", "infra/scripts/set-image-tags.sh", "9.8.7"], cwd=self.copy, check=True)
            updated = yaml.safe_load((self.copy / PROFILE / "kustomization.yaml").read_text())
            images = {item["name"]: item for item in updated["images"]}
            for name in ("thoughty-server", "thoughty-web"):
                self.assertEqual(images[name]["newTag"], "9.8.7")
                self.assertEqual(images[name]["newName"], values["REGISTRY_HOST"] + "/" + values["GITLAB_PROJECT_PATH"] + "/" + name)
            self.assertEqual(images["postgres"], next(item for item in manifest["images"] if item["name"] == "postgres"))
            config = yaml.safe_load((self.copy / PROFILE / "configmap-patch.yaml").read_text())["data"]
            self.assertEqual(config["KEYCLOAK_ISSUER"], "https://keycloak.replacement.example/auth/realms/company")
            self.assertEqual(config["CORS_ORIGIN"], "https://" + values["APP_HOST"])

        if not shutil.which("kubectl"):
            return  # CI still checks configuration; local tooling also renders both profiles.
        for profile in (PROFILE, "infra/overlays/ha"):
            docs = list(yaml.safe_load_all(subprocess.check_output(["kubectl", "kustomize", str(self.copy / profile)], text=True)))
            ingress_hosts = {rule["host"] for doc in docs if doc["kind"] == "Ingress" for rule in doc["spec"]["rules"]}
            self.assertEqual(ingress_hosts, {expand(host, values) for host in CONTRACT["dns"]["hosts"]})
            for doc in docs:
                if doc["kind"] == "Ingress":
                    self.assertTrue(all(tls["secretName"] == values["TLS_SECRET_NAME"] for tls in doc["spec"]["tls"]))
            if WEBSITE:
                deployment = next(doc for doc in docs if doc["kind"] == "Deployment")
                env = {item["name"]: item for item in deployment["spec"]["template"]["spec"]["containers"][0]["env"]}
                self.assertEqual(env["PUBLIC_ORIGIN"]["value"], "https://" + values["APP_HOST"])
                self.assertEqual(env["PUBLIC_ALIAS_HOST"]["value"], "welcome.replacement.example")
                self.assertEqual(env["TRUSTED_PROXY_CIDRS"]["value"], values["TRUSTED_PROXY_CIDRS"])
                self.assertEqual(env["CONTACT_SENDER"]["value"], "noreply@swirlit.dev")
                if profile == PROFILE:
                    self.assertEqual(deployment["spec"]["replicas"], 1)
                    self.assertEqual(deployment["spec"]["strategy"]["type"], "Recreate")

    def test_imported_sync_workflow_uses_github_variables(self):
        path = self.copy / ".github/workflows/sync-gitlab.yml"
        workflow = yaml.safe_load(path.read_text())
        env = workflow["jobs"]["sync-repository"]["env"]
        env.pop("GITLAB_PROJECT_ID", None)
        for key in ("GITLAB_REPOSITORY", "GITLAB_API_URL", "GITLAB_HOST"):
            env[key] = "${{ vars." + key + " }}"
        path.write_text(yaml.safe_dump(workflow))
        self.test_custom_domain_group_and_repeat_configuration()

    def test_secret_requests_and_bootstrap_are_bounded(self):
        self.assertEqual(CONTRACT["registry"]["path"], "apps/" + ("website" if WEBSITE else "thoughty") + "/registry")
        requests = {item["path"]: item["fields"] for item in CONTRACT["vault"]}
        if WEBSITE:
            self.assertEqual(requests, {"apps/website/contact": {"RESEND_API_KEY": {"value": ""}}})
            self.assertNotIn("apps/website/database", requests)
        else:
            self.assertEqual(requests["apps/thoughty/database"]["POSTGRES_PASSWORD"], {"generate": 24, "encoding": "hex"})
            required = requests["apps/thoughty/app"]
            for key in ("JWT_SECRET", "REFRESH_SECRET", "TWO_FACTOR_SECRET", "CONFIG_ENCRYPTION_SECRET"):
                self.assertGreaterEqual(required[key]["generate"], 32)
                self.assertEqual(required[key]["encoding"], "hex")
            self.assertEqual(required["S3_ACCESS_KEY"], {"value": ""})
        for name in CONTRACT.get("bootstrap", []):
            for doc in yaml.safe_load_all((self.copy / name).read_text()):
                self.assertIn(doc["kind"], {"Namespace", "Role", "RoleBinding", "ExternalSecret"})
        self.assertNotIn("scripts", CONTRACT)

    def test_release_rules_preserve_manual_and_scan_only_pipelines(self):
        pipeline = yaml.safe_load((ROOT / ".gitlab-ci.yml").read_text())
        job = "release" if WEBSITE else "01-release"
        defaults = dict(CI_DEFAULT_BRANCH="main", CI_COMMIT_BRANCH="main", CI_PIPELINE_SOURCE="api",
                        SONAR_SCAN_ONLY="false", APP_ONBOARDING="true", PIPELINE_MODE="standard")
        self.assertEqual(job_when(pipeline, job, **defaults), "on_success")
        settings = {**defaults, "CI_COMMIT_MESSAGE": "Configure repository [skip ci]", "CI_OPEN_MERGE_REQUESTS": "1"}
        self.assertEqual(job_when(pipeline, "workflow", **settings), "on_success")
        self.assertEqual(job_when(pipeline, job, **{**defaults, "SONAR_SCAN_ONLY": "true"}), "never")
        self.assertEqual(job_when(pipeline, job, **{**defaults, "CI_COMMIT_BRANCH": "feature"}), "never")
        if not WEBSITE:
            for source in ("api", "push"):
                self.assertEqual(job_when(pipeline, job, **{**defaults, "CI_PIPELINE_SOURCE": source, "APP_ONBOARDING": "false"}), "manual")
            self.assertEqual(job_when(pipeline, job, **{**defaults, "CI_PIPELINE_SOURCE": "web", "APP_ONBOARDING": "false", "PIPELINE_MODE": "full"}), "on_success")

    def test_expected_revision_guards_before_publication_and_deployment(self):
        remote = self.directory / "remote.git"
        git(self.directory, "init", "--bare", str(remote))
        git(self.copy, "init", "-b", "main")
        git(self.copy, "config", "user.name", "Onboarding test")
        git(self.copy, "config", "user.email", "test@example.invalid")
        git(self.copy, "add", ".")
        git(self.copy, "commit", "-qm", "fixture")
        git(self.copy, "remote", "add", "origin", str(remote))
        git(self.copy, "push", "-qu", "origin", "main")
        revision = git(self.copy, "rev-parse", "HEAD")
        environment = {**os.environ, "APP_ONBOARDING": "true", "CI_PIPELINE_SOURCE": "api",
                       "CI_COMMIT_BRANCH": "main", "CI_DEFAULT_BRANCH": "main",
                       "CI_COMMIT_SHA": revision, "ONBOARDING_EXPECTED_SHA": revision}
        command = 'set -eu; . infra/scripts/check-onboarding.sh; check_onboarding_source; check_onboarding_head "$CI_COMMIT_SHA"'
        result = subprocess.run(["sh", "-c", command], cwd=self.copy, env=environment, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        commands = self.directory / "bin"
        commands.mkdir()
        log = self.directory / "cluster-calls"
        kubectl = commands / "kubectl"
        kubectl.write_text('#!/usr/bin/env python3\nimport json, os, sys\n'
                           'with open(os.environ["MOCK_CLUSTER_LOG"], "a") as stream: stream.write(sys.argv[1] + "\\n")\n'
                           'if sys.argv[1] == "get": print(json.dumps({"status":{"sync":{"revision":os.environ["DEPLOY_REVISION"],"status":"Synced"},"health":{"status":"Healthy"}}}))\n')
        kubectl.chmod(0o700)
        curl = commands / "curl"
        curl.write_text('#!/bin/sh\nexit 0\n')
        curl.chmod(0o700)
        environment.update(PATH=str(commands) + ':' + os.environ['PATH'],
                           MOCK_CLUSTER_LOG=str(log), DEPLOY_REVISION=revision)
        result = subprocess.run(["bash", "infra/scripts/ci-release.sh", "deploy"],
                                cwd=self.copy, env=environment, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('apply', log.read_text().splitlines())
        log.write_text('')
        for bad in ({"ONBOARDING_EXPECTED_SHA": "a" * 40}, {"ONBOARDING_EXPECTED_SHA": ""},
                    {"CI_PIPELINE_SOURCE": "push"}, {"CI_COMMIT_BRANCH": "feature"}):
            changed = {**environment, **bad}
            for phase in (["publish", "deploy"] if not WEBSITE else [""]):
                result = subprocess.run(["bash", "infra/scripts/ci-release.sh", phase],
                                        cwd=self.copy, env=changed, capture_output=True)
                self.assertNotEqual(result.returncode, 0)
                self.assertFalse((self.copy / "release.env").exists())
                self.assertEqual(log.read_text(), '', 'Rejected onboarding cannot change cluster resources')
            builder = "ci-build-image.sh" if WEBSITE else "ci-container-build.sh"
            changed.update(CI_PROJECT_DIR=str(self.copy), CI_PROJECT_PATH="team/product",
                           CI_REGISTRY_USER="fixture", CI_REGISTRY_PASSWORD="private-fixture",
                           REGISTRY_PUSH_HOST="registry.invalid:5050", APP_VERSION="1.2.3",
                           KANIKO_EXECUTOR="/unavailable-builder")
            result = subprocess.run(["sh" if WEBSITE else "bash", "infra/scripts/" + builder, "publish"],
                                    cwd=self.copy, env=changed, capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertNotIn("unavailable-builder", result.stderr)
            self.assertNotIn("private-fixture", result.stderr + result.stdout)
        git(self.copy, "commit", "--allow-empty", "-qm", "new source")
        git(self.copy, "push", "-q", "origin", "main")
        git(self.copy, "checkout", "-q", "--detach", revision)
        result = subprocess.run(["sh", "-c", command], cwd=self.copy, env=environment, capture_output=True)
        self.assertNotEqual(result.returncode, 0, "A stale default branch must block publication")


if __name__ == "__main__":
    unittest.main()
