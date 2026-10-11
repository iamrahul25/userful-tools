import shutil
import subprocess
import sys
from pathlib import Path

PROJECT_DIR = Path(__file__).resolve().parent


def run_npm(*args):
    npm = shutil.which("npm")
    if npm is None:
        print("npm was not found on PATH. Install Node.js and try again.")
        return
    try:
        subprocess.run([npm, *args], cwd=PROJECT_DIR)
    except KeyboardInterrupt:
        print("\nStopped.")


def start_app():
    run_npm("run", "dev")


OPTIONS = {
    "1": ("Start the App (npm run dev)", start_app),
}


def main():
    while True:
        print("\n=== Useful Tools ===")
        for key, (label, _) in OPTIONS.items():
            print(f"{key}. {label}")
        print("0. Exit")

        try:
            choice = input("Select an option: ").strip()
        except (KeyboardInterrupt, EOFError):
            print()
            return

        if choice == "0":
            return
        if choice in OPTIONS:
            OPTIONS[choice][1]()
        else:
            print("Invalid option, try again.")


if __name__ == "__main__":
    sys.exit(main())
