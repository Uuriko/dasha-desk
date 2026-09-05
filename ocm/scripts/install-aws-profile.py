#!/usr/bin/env python3
"""
Install the OCM AWS profile from an IAM access-key CSV.

Reads the CSV the IAM console produces, writes the `ocm` profile into ~/.aws/config
and ~/.aws/credentials (mode 600), shreds the CSV, and verifies the identity.

The secret access key is never printed and never echoed — it goes from the CSV
straight into ~/.aws/credentials.

  ./install-aws-profile.py [path/to/accessKeys.csv] [--region us-west-2] [--keep-csv]
"""
import argparse
import configparser
import csv
import glob
import os
import pathlib
import subprocess
import sys

PROFILE = "ocm"
AWS = pathlib.Path.home() / ".aws"


def newest_csv():
    pats = ["*accessKeys*.csv", "*credentials*.csv", "*_accessKeys.csv"]
    hits = []
    for d in (pathlib.Path.home() / "Downloads", pathlib.Path.cwd()):
        for p in pats:
            hits += glob.glob(str(d / p))
    if not hits:
        sys.exit("no access-key CSV found in ~/Downloads — pass the path explicitly")
    return max(hits, key=lambda f: os.path.getmtime(f))


def read_key(path):
    with open(path, newline="", encoding="utf-8-sig") as fh:
        rows = list(csv.DictReader(fh))
    if not rows:
        sys.exit(f"{path}: no rows")
    row = {k.strip().lower(): (v or "").strip() for k, v in rows[0].items()}
    kid = row.get("access key id") or row.get("accesskeyid")
    sec = row.get("secret access key") or row.get("secretaccesskey")
    if not kid or not sec:
        sys.exit(f"{path}: expected 'Access key ID' and 'Secret access key' columns, got {list(row)}")
    return kid, sec


def update(path, section, values):
    cp = configparser.RawConfigParser()
    if path.exists():
        cp.read(path)
    if not cp.has_section(section):
        cp.add_section(section)
    for k, v in values.items():
        cp.set(section, k, v)
    AWS.mkdir(mode=0o700, exist_ok=True)
    with open(path, "w") as fh:
        cp.write(fh)
    os.chmod(path, 0o600)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("csv", nargs="?")
    ap.add_argument("--region", default="us-west-2")
    ap.add_argument("--keep-csv", action="store_true")
    a = ap.parse_args()

    path = a.csv or newest_csv()
    kid, sec = read_key(path)

    update(AWS / "config", f"profile {PROFILE}", {"region": a.region, "output": "json"})
    update(AWS / "credentials", PROFILE,
           {"aws_access_key_id": kid, "aws_secret_access_key": sec})
    del sec

    print(f"wrote [profile {PROFILE}] -> {AWS/'config'}   region={a.region}")
    print(f"wrote [{PROFILE}]         -> {AWS/'credentials'}  key={kid}  (secret not shown)")

    if not a.keep_csv:
        try:
            n = os.path.getsize(path)
            with open(path, "r+b") as fh:
                fh.write(os.urandom(n))
                fh.flush()
                os.fsync(fh.fileno())
            os.remove(path)
            print(f"shredded {path}")
        except Exception as e:
            print(f"WARNING could not shred {path}: {e} — delete it yourself")

    print("\nverifying …")
    r = subprocess.run(["aws", "--profile", PROFILE, "sts", "get-caller-identity",
                        "--output", "json"], capture_output=True, text=True)
    print(r.stdout.strip() or r.stderr.strip())
    sys.exit(r.returncode)


if __name__ == "__main__":
    main()
