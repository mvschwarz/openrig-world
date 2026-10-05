#!/usr/bin/env python3
"""Copy pinned public OpenRig skills; never execute the donor checkout."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
AGENT = ROOT / "rigs/workshop/agents/workshop"
LOCK = AGENT / "pi-skills.lock.json"
PLUGIN = "packages/daemon/assets/plugins/openrig-core"
# This skill operates Claude's native compaction, not Pi's RPC runtime.
EXCLUDED = ["claude-compaction-restore"]


def generate(source, revision, check):
    def git(*args):
        return subprocess.check_output(["git", "-C", str(source), *args])

    if not re.fullmatch(r"[0-9a-f]{40}", revision):
        raise ValueError("Use a full product commit SHA, not a moving branch or tag")
    if git("rev-parse", revision + "^{commit}").decode().strip() != revision:
        raise ValueError("Revision must resolve to the supplied commit")
    manifest_path = PLUGIN + "/.claude-plugin/plugin.json"
    manifest_bytes = git("show", revision + ":" + manifest_path)
    plugin = json.loads(manifest_bytes)
    inputs = {}
    modes = {}
    skills = set()
    prefix = PLUGIN + "/skills/"
    for row in git("ls-tree", "-rz", revision, "--", prefix).split(b"\0"):
        if not row:
            continue
        header, path_bytes = row.split(b"\t", 1)
        mode, kind, oid = header.decode().split()
        path = path_bytes.decode()
        relative = path.removeprefix(prefix)
        skill = relative.split("/", 1)[0]
        if skill in EXCLUDED:
            continue
        if kind != "blob" or mode not in ("100644", "100755"):
            raise ValueError("Expected a regular skill file: " + path)
        destination = "skills/" + relative
        inputs[destination] = path
        modes[destination] = mode
        if relative == skill + "/SKILL.md":
            skills.add(skill)
    if "openrig-user" not in skills or not skills:
        raise ValueError("The pinned plugin has no expected OpenRig skills")
    development = ".agents/skills/developing-openrig/SKILL.md"
    inputs["skills/developing-openrig/SKILL.md"] = development
    inputs["skills/LICENSE"] = PLUGIN + "/LICENSE"
    for dest in ("skills/developing-openrig/SKILL.md", "skills/LICENSE"):
        mode, kind, _ = git("ls-tree", revision, "--", inputs[dest]).decode().split("\t", 1)[0].split()
        if kind != "blob" or mode not in ("100644", "100755"):
            raise ValueError("Expected a regular source file: " + inputs[dest])
        modes[dest] = mode
    skills.add("developing-openrig")
    contents = {dest: git("show", revision + ":" + path) for dest, path in inputs.items()}
    records = [{"path": dest, "source": inputs[dest], "mode": modes[dest],
                "sha256": hashlib.sha256(contents[dest]).hexdigest()}
               for dest in sorted(contents)]
    lock = {"productRepository": "https://github.com/mvschwarz/openrig",
            "productCommit": revision, "pluginPath": PLUGIN,
            "pluginVersion": plugin["version"],
            "pluginManifestSha256": hashlib.sha256(manifest_bytes).hexdigest(),
            "excludedSkills": EXCLUDED, "skills": sorted(skills), "files": records}
    resources = "\n".join("    - { id: " + name + ", path: skills/" + name + " }"
                          for name in sorted(skills))
    selection = "      skills: &pi-skills [" + ", ".join(sorted(skills)) + "]"
    agent_path = AGENT / "agent.yaml"
    agent = agent_path.read_text()
    for name, text in [("RESOURCES", resources), ("SELECTION", selection)]:
        pattern = r"(?m)^( *# BEGIN GENERATED PI " + name + r"\n).*?(^ *# END GENERATED PI " + name + r"$)"
        agent, count = re.subn(pattern, lambda m: m[1] + text + "\n" + m[2], agent, flags=re.S)
        if count != 1:
            raise ValueError("Expected one generated " + name + " block")
    expected = {**contents, "pi-skills.lock.json": (json.dumps(lock, indent=2) + "\n").encode(),
                "agent.yaml": agent.encode()}
    extra = {str(f.relative_to(AGENT)) for f in (AGENT / "skills").rglob("*") if f.is_file()} - set(contents)
    if extra:
        raise ValueError("Unexpected generated files; review before removing: " + ", ".join(sorted(extra)))
    for relative, content in expected.items():
        path = AGENT / relative
        mode = int(modes.get(relative, "100644"), 8) & 0o777
        if check:
            if not path.is_file() or path.is_symlink() or path.read_bytes() != content or path.stat().st_mode & 0o777 != mode:
                raise ValueError("Generated file differs: " + relative)
        else:
            if path.is_symlink():
                raise ValueError("Refusing to replace a symlink: " + relative)
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(content)
            path.chmod(mode)
    print(("Verified" if check else "Generated") + f" {len(skills)} skills / {len(records)} files at {revision}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True, help="A local public OpenRig Git clone")
    parser.add_argument("--revision", help="Full commit SHA; defaults to the checked-in lock")
    parser.add_argument("--check", action="store_true", help="Verify bytes, modes and selections without writing")
    args = parser.parse_args()
    revision = args.revision or json.loads(LOCK.read_text())["productCommit"]
    generate(args.source, revision, args.check)
