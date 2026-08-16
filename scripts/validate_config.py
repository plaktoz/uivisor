# scripts/validate_config.py
import yaml
import sys
from pathlib import Path

REQUIRED_API = ['api_key', 'api_url']
REQUIRED_PIPELINE = ['parallel_execution', 'max_tester_retries']
REQUIRED_ROLES = ['orchestrator', 'analyst', 'designer', 'architect', 'coder', 'tester', 'deployer']
REQUIRED_ROLE_KEYS = ['model', 'tools', 'skills']
REQUIRED_DEPLOY = ['container_runtime', 'registry', 'target_environment', 'build_tool', 'pre_deploy_checks']

VALID_RUNTIMES = ['docker', 'podman', 'none']
VALID_ENVIRONMENTS = ['local', 'staging', 'production']

def validate(config_path: str) -> list[str]:
    errors = []
    path = Path(config_path)

    if not path.exists():
        return [f"File not found: {config_path}"]

    with open(path) as f:
        config = yaml.safe_load(f)

    if not isinstance(config, dict):
        return ["agent-config.yml must be a YAML mapping at the top level"]

    # api section
    api = config.get('api', {})
    for key in REQUIRED_API:
        if key not in api:
            errors.append(f"Missing: api.{key}")

    # pipeline section
    pipeline = config.get('pipeline', {})
    for key in REQUIRED_PIPELINE:
        if key not in pipeline:
            errors.append(f"Missing: pipeline.{key}")

    if 'max_tester_retries' in pipeline and not isinstance(pipeline['max_tester_retries'], int):
        errors.append("pipeline.max_tester_retries must be an integer")

    if 'parallel_execution' in pipeline and not isinstance(pipeline['parallel_execution'], bool):
        errors.append("pipeline.parallel_execution must be a boolean")

    # roles section
    roles = config.get('roles', {})
    for role in REQUIRED_ROLES:
        if role not in roles:
            errors.append(f"Missing role: {role}")
            continue
        role_cfg = roles[role]
        for key in REQUIRED_ROLE_KEYS:
            if key not in role_cfg:
                errors.append(f"Missing: roles.{role}.{key}")
        if 'tools' in role_cfg and not isinstance(role_cfg['tools'], list):
            errors.append(f"roles.{role}.tools must be a list")
        if 'skills' in role_cfg and not isinstance(role_cfg['skills'], list):
            errors.append(f"roles.{role}.skills must be a list")
        if role == 'designer' and role_cfg.get('optional') is not True:
            errors.append("roles.designer must have an 'optional' field set to true")

    # deploy section
    deploy = config.get('deploy', {})
    for key in REQUIRED_DEPLOY:
        if key not in deploy:
            errors.append(f"Missing: deploy.{key}")

    if 'container_runtime' in deploy and deploy['container_runtime'] not in VALID_RUNTIMES:
        errors.append(f"deploy.container_runtime must be one of: {VALID_RUNTIMES}")

    if 'target_environment' in deploy and deploy['target_environment'] not in VALID_ENVIRONMENTS:
        errors.append(f"deploy.target_environment must be one of: {VALID_ENVIRONMENTS}")

    return errors


if __name__ == '__main__':
    config_path = sys.argv[1] if len(sys.argv) > 1 else 'agent-config.yml'
    errors = validate(config_path)
    if errors:
        print("VALIDATION FAILED:")
        for e in errors:
            print(f"  ✗ {e}")
        sys.exit(1)
    else:
        print("✓ agent-config.yml is valid")
