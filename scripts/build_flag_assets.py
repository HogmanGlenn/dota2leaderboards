"""Build the SVG flag assets used by the React app."""

from __future__ import annotations

import shutil
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "node_modules" / "flag-icons" / "flags" / "4x3"
PUBLIC_DIR = ROOT / "public" / "flags" / "4x3"
CODES_PATH = ROOT / "src" / "components" / "flag" / "flagCodes.js"


def main() -> None:
    files = sorted(SOURCE_DIR.glob("*.svg"))
    if not files:
        raise FileNotFoundError(f"No SVG flags found in {SOURCE_DIR}")

    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    for stale_file in PUBLIC_DIR.glob("*.svg"):
        stale_file.unlink()

    codes = []
    for source_path in files:
        code = source_path.stem.lower()
        codes.append(code)
        shutil.copyfile(source_path, PUBLIC_DIR / f"{code}.svg")

    CODES_PATH.write_text(
        "export const FLAG_CODES = [\n"
        + "".join(f'  "{code}",\n' for code in codes)
        + "];\n",
        encoding="utf-8",
        newline="\n",
    )


if __name__ == "__main__":
    main()
