"""Offline rendering and fail-closed contract tests; never contact a cluster."""
import copy
import os
from pathlib import Path
import re
import subprocess
import unittest

import yaml

ROOT = Path(__file__).resolve().parents[1]
IMAGE = "ghcr.io/gen-skeptic/paperclip-codex-mcp-compat@sha256:30577d8e9c171294338aca4adb3862011d2a5dd699d7224f8c3d2da54df47573"


def render(example):
    completed = subprocess.run(
        [os.environ.get("KUBECTL", "kubectl"), "kustomize", str(ROOT / "examples" / example)],
        check=True, capture_output=True, text=True, timeout=30,
    )
    return list(yaml.safe_load_all(completed.stdout))


def validate(documents, public=False):
    objects = {doc["kind"]: doc for doc in documents}
    assert len(documents) == len(objects) == 5
    assert set(objects) == {"Deployment", "Service", "ServiceAccount", "PersistentVolumeClaim", "NetworkPolicy"}
    assert all(doc["metadata"]["namespace"] == "paperclip" for doc in documents)
    deployment = objects["Deployment"]["spec"]
    assert deployment["replicas"] == 0
    assert deployment["strategy"]["type"] == "Recreate"
    pod = deployment["template"]["spec"]
    assert pod["serviceAccountName"] == "paperclip"
    assert pod["automountServiceAccountToken"] is False
    assert objects["ServiceAccount"]["automountServiceAccountToken"] is False
    assert not any(pod.get(key) for key in ("hostNetwork", "hostPID", "hostIPC"))
    security = pod["securityContext"]
    assert security == {"runAsNonRoot": True, "runAsUser": 1000, "runAsGroup": 1000, "fsGroup": 1000, "seccompProfile": {"type": "RuntimeDefault"}}
    assert len(pod["containers"]) == 1
    assert not pod.get("initContainers")
    container = pod["containers"][0]
    assert container["image"] == IMAGE
    assert container["securityContext"] == {"allowPrivilegeEscalation": False, "readOnlyRootFilesystem": True, "capabilities": {"drop": ["ALL"]}}
    assert container["resources"]["requests"] == {"cpu": "500m", "memory": "2Gi"}
    assert container["resources"]["limits"] == {"cpu": "2", "memory": "2Gi", "ephemeral-storage": "1Gi"}
    environment = {entry["name"]: entry for entry in container["env"]}
    assert len(environment) == len(container["env"])
    for name, value in {"PAPERCLIP_API_URL": "http://127.0.0.1:3100", "PAPERCLIP_DEPLOYMENT_MODE": "authenticated", "PAPERCLIP_AUTH_DISABLE_SIGN_UP": "true", "PAPERCLIP_AUTH_RATE_LIMIT_ENABLED": "true", "HEARTBEAT_SCHEDULER_ENABLED": "false"}.items():
        assert environment[name]["value"] == value
    origin = "https://agents.example.invalid" if public else "http://localhost:3100"
    for key in ("PAPERCLIP_PUBLIC_URL", "PAPERCLIP_AUTH_PUBLIC_BASE_URL"):
        assert environment[key]["value"] == origin
    for name in ("DATABASE_URL", "BETTER_AUTH_SECRET", "PAPERCLIP_SECRETS_MASTER_KEY"):
        assert environment[name] == {"name": name, "valueFrom": {"secretKeyRef": {"name": "paperclip-runtime", "key": name}}}
    for name in ("startupProbe", "readinessProbe", "livenessProbe"):
        assert container[name]["httpGet"] == {"path": "/api/health", "port": "http", "httpHeaders": [{"name": "Host", "value": "localhost"}]}
    volumes = {item["name"]: item for item in pod["volumes"]}
    assert volumes == {"files": {"name": "files", "persistentVolumeClaim": {"claimName": "paperclip-files"}}, "tmp": {"name": "tmp", "emptyDir": {"sizeLimit": "512Mi"}}}
    service = objects["Service"]["spec"]
    assert service["type"] == "ClusterIP"
    assert service["ports"] == [{"name": "http", "port": 3100, "targetPort": "http"}]
    claim = objects["PersistentVolumeClaim"]
    assert claim["metadata"]["annotations"]["kustomize.toolkit.fluxcd.io/prune"] == "disabled"
    assert claim["spec"] == {"accessModes": ["ReadWriteOnce"], "storageClassName": "local-path", "resources": {"requests": {"storage": "10Gi"}}}
    policy = objects["NetworkPolicy"]["spec"]
    assert set(policy["policyTypes"]) == {"Ingress", "Egress"}
    assert policy["podSelector"] == {"matchLabels": {"app.kubernetes.io/name": "paperclip"}}
    assert policy["egress"] == [
        {"to": [{"namespaceSelector": {"matchLabels": {"kubernetes.io/metadata.name": "kube-system"}}, "podSelector": {"matchLabels": {"k8s-app": "kube-dns"}}}], "ports": [{"protocol": "UDP", "port": 53}, {"protocol": "TCP", "port": 53}]},
        {"to": [{"podSelector": {"matchLabels": {"cnpg.io/cluster": "paperclip-db"}}}], "ports": [{"protocol": "TCP", "port": 5432}]},
    ]
    expected_ingress = [{"from": [{"namespaceSelector": {"matchLabels": {"kubernetes.io/metadata.name": "pangolin"}}, "podSelector": {"matchLabels": {"app.kubernetes.io/instance": "newt", "newt.instance": site}}} for site in ("site-a", "site-b")], "ports": [{"protocol": "TCP", "port": 3100}]}] if public else []
    assert policy["ingress"] == expected_ingress


class Examples(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.base = render("base")
        cls.public = render("pangolin")

    def test_base_contract(self):
        validate(self.base)

    def test_public_contract(self):
        validate(self.public, public=True)

    def test_reject_activation(self):
        docs = copy.deepcopy(self.base)
        next(d for d in docs if d["kind"] == "Deployment")["spec"]["replicas"] = 1
        with self.assertRaises(AssertionError):
            validate(docs)

    def test_reject_public_service(self):
        docs = copy.deepcopy(self.base)
        next(d for d in docs if d["kind"] == "Service")["spec"]["type"] = "LoadBalancer"
        with self.assertRaises(AssertionError):
            validate(docs)

    def test_reject_blanket_egress(self):
        docs = copy.deepcopy(self.base)
        next(d for d in docs if d["kind"] == "NetworkPolicy")["spec"]["egress"].append({})
        with self.assertRaises(AssertionError):
            validate(docs)

    def test_reject_secret_objects(self):
        docs = copy.deepcopy(self.base) + [{"kind": "Secret", "metadata": {"namespace": "paperclip"}}]
        with self.assertRaises(AssertionError):
            validate(docs)

    def test_no_private_environment_data(self):
        forbidden = ("dautel.cloud", "192.168.", "/home/erich", "rza", "home-k3s-a", "home-k3s-b")
        for path in ROOT.rglob("*"):
            if not path.is_file() or any(part in {".git", ".venv", "__pycache__"} for part in path.parts):
                continue
            if path.resolve() == Path(__file__).resolve():
                continue
            text = path.read_text()
            for value in forbidden:
                self.assertNotIn(value, text, str(path.relative_to(ROOT)))
            self.assertIsNone(re.search(r"-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----", text))


if __name__ == "__main__":
    unittest.main(verbosity=2)
