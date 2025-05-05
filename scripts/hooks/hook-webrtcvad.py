# hooks/hook-webrtcvad.py
from PyInstaller.utils.hooks import copy_metadata, logger
import sys

logger.info("Executing custom hook for webrtcvad (targeting webrtcvad-wheels metadata)")

# Attempt to copy metadata using the name 'webrtcvad-wheels'
# as this is likely the package installed via pip.
try:
    # The datas variable collects files (like METADATA, LICENCE) associated with the package.
    # This is what the original hook was trying to do with the wrong name.
    datas = copy_metadata('webrtcvad-wheels', Toplevel=False) # Toplevel=False is often safer
    if not datas:
         logger.warning("copy_metadata('webrtcvad-wheels') returned empty list. Metadata might be missing or unnecessary.")
    else:
         logger.info(f"Successfully copied metadata for 'webrtcvad-wheels': {datas}")

except Exception as e:
    logger.warning(f"Failed to copy metadata for 'webrtcvad-wheels': {e}. Proceeding without it.")
    datas = []

# webrtcvad often relies on a C extension module (e.g., _webrtcvad.pyd on Windows).
# PyInstaller's analysis *should* usually find this automatically when it processes
# the `import webrtcvad` statement, now that we are not excluding it.
# However, if you still face issues, you might explicitly include it:
# from PyInstaller.utils.hooks import collect_dynamic_libs
# binaries = collect_dynamic_libs('webrtcvad')
# logger.info(f"Collected binaries for webrtcvad: {binaries}")
# Note: Usually `copy_metadata` and automatic analysis are enough. Add binaries explicitly if needed.
binaries = [] # Start with no explicit binaries unless proven necessary

# Hidden imports aren't typically needed if the main import works, but uncomment if required.
# hiddenimports = ['_webrtcvad']
hiddenimports = []