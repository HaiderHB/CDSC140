import importlib
import sys
import subprocess
import platform
import logging

# Configure logging
logging.basicConfig(level=logging.WARNING, format='%(levelname)s: %(message)s')

def check_and_install_packages(packages):
    """
    Check if required packages are installed and install them if necessary.
    
    Args:
        packages: List of dicts with package info. Each dict should have:
            - import_name: The name used to import the package
            - package_name: (Optional) The name used to install the package with pip if different
    """
    for package_info in packages:
        import_name = package_info['import_name']
        package_name = package_info.get('package_name', import_name)
        
        try:
            # Try to import the package
            importlib.import_module(import_name)
            # Successfully imported, no need to print anything
        except ImportError:
            logging.warning(f"{import_name} is not installed. Installing {package_name}...")
            
            try:
                # Determine the Python executable to use for pip
                if platform.system() == 'Windows':
                    pip_cmd = ['py', '-3.12', '-m', 'pip', 'install', package_name]
                else:
                    pip_cmd = ['python3.12', '-m', 'pip', 'install', package_name]
                
                # Install the package using Python 3.12
                subprocess.check_call(pip_cmd, stdout=subprocess.DEVNULL)
                logging.info(f"Successfully installed {package_name}")
            except subprocess.CalledProcessError:
                logging.error(f"Failed to install {package_name}. Please install it manually.")
                sys.exit(1)

if __name__ == "__main__":
    # Example usage
    check_and_install_packages([
        {'import_name': 'websockets'},
        {'import_name': 'RealtimeSTT'},
    ]) 