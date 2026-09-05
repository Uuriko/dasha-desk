#!/usr/bin/env python3
"""Save a provider token without putting its value in a shell command."""

import getpass
import os
from pathlib import Path
import re
import sys
import warnings


def main():
    if len(sys.argv) != 1:
        print("Usage: python3 provider/save-provider-key.py (no token arguments)")
        return 0 if sys.argv[1:] == ["--help"] else 2

    path = Path(os.environ.get("DASHA_PROVIDER_KEY_FILE", ".dasha-provider-key"))
    try:
        descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError:
        print("A token file already exists. Use it with ./install.sh or remove it explicitly.", file=sys.stderr)
        return 1
    except OSError:
        print("Could not create the private token file. Check its parent directory.", file=sys.stderr)
        return 1

    try:
        with os.fdopen(descriptor, "w", encoding="ascii") as stream:
            os.fchmod(stream.fileno(), 0o600)
            with warnings.catch_warnings():
                # getpass otherwise falls back to echoed input when no TTY works.
                warnings.simplefilter("error", getpass.GetPassWarning)
                token = getpass.getpass("One-time provider token (input hidden): ")
            if not re.fullmatch(r"[A-Za-z0-9_-]+", token):
                raise ValueError("Invalid token format")
            stream.write(token + "\n")
    except (getpass.GetPassWarning, EOFError):
        path.unlink(missing_ok=True)
        print("Hidden input requires a terminal. Run this command directly in Terminal.", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        path.unlink(missing_ok=True)
        print("\nToken entry cancelled; no token file was saved.", file=sys.stderr)
        return 1
    except (ValueError, OSError):
        path.unlink(missing_ok=True)
        print("Token was not saved. Check the token format and file permissions.", file=sys.stderr)
        return 1

    print("Provider token saved in a private file. Run ./install.sh next.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
