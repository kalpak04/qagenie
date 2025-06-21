#!/usr/bin/env python3
import os
import sys
import time
import subprocess
import requests
import socket
import platform
import json
from pathlib import Path

# Global variables
npm_command = "npm"  # Will be updated based on platform detection

# Configuration
CONFIG = {
    "ai_service": {
        "dir": "ai_service",
        "start_cmd": ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"],
        "health_url": "http://localhost:8000/health",
        "env_file": ".env",
        "required_env": ["IBM_CLOUD_API_KEY", "WATSONX_PROJECT_ID"]
    },
    "server": {
        "dir": "server",
        "start_cmd": ["node", "index.js"],
        "health_url": "http://localhost:5000/api/health",
        "env_file": ".env",
        "required_env": ["MONGODB_URI", "JWT_SECRET"]
    },
    "client": {
        "dir": "client",
        "start_cmd": ["npm", "start"],
        "health_url": "http://localhost:3000",
        "env_file": ".env",
        "required_env": []
    }
}

# ANSI color codes for terminal output
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    END = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

def print_header(message):
    """Print a formatted header message"""
    print(f"\n{Colors.HEADER}{Colors.BOLD}=== {message} ==={Colors.END}\n")

def print_success(message):
    """Print a success message"""
    print(f"{Colors.GREEN}✓ {message}{Colors.END}")

def print_error(message):
    """Print an error message"""
    print(f"{Colors.RED}✗ {message}{Colors.END}")

def print_warning(message):
    """Print a warning message"""
    print(f"{Colors.YELLOW}! {message}{Colors.END}")

def print_info(message):
    """Print an info message"""
    print(f"{Colors.BLUE}ℹ {message}{Colors.END}")

def check_prerequisites():
    """Check if all required software is installed"""
    print_header("Checking prerequisites")
    
    # Check Python version
    python_version = sys.version_info
    if python_version.major < 3 or (python_version.major == 3 and python_version.minor < 8):
        print_error(f"Python 3.8+ is required. Found: {python_version.major}.{python_version.minor}")
        return False
    print_success(f"Python {python_version.major}.{python_version.minor}.{python_version.micro} installed")
    
    # Check Node.js
    try:
        node_version = subprocess.run(
            ["node", "--version"], 
            capture_output=True, 
            text=True, 
            check=True
        ).stdout.strip()
        print_success(f"Node.js {node_version} installed")
    except (subprocess.SubprocessError, FileNotFoundError):
        print_error("Node.js is not installed or not in PATH")
        return False
    
    # Check npm - use npm.cmd on Windows
    global npm_command
    npm_cmd = "npm.cmd" if platform.system() == "Windows" else "npm"
    try:
        npm_version = subprocess.run(
            [npm_cmd, "--version"], 
            capture_output=True, 
            text=True, 
            check=True
        ).stdout.strip()
        print_success(f"npm {npm_version} installed")
        npm_command = npm_cmd
    except (subprocess.SubprocessError, FileNotFoundError):
        try:
            # Try alternative npm command if the first fails
            alt_npm_cmd = "npm" if npm_cmd == "npm.cmd" else "npm.cmd"
            npm_version = subprocess.run(
                [alt_npm_cmd, "--version"], 
                capture_output=True, 
                text=True, 
                check=True
            ).stdout.strip()
            print_success(f"npm {npm_version} installed")
            # Update npm command for future use
            npm_command = alt_npm_cmd
        except (subprocess.SubprocessError, FileNotFoundError):
            print_error("npm is not installed or not in PATH")
            print_info("If npm is installed, make sure it's in your PATH or use full path to npm")
            return False
    
    # Check MongoDB connection
    try:
        # Read MongoDB URI from server/.env if it exists
        mongo_uri = None
        env_path = Path("server/.env")
        if env_path.exists():
            with open(env_path, "r") as f:
                for line in f:
                    if line.startswith("MONGODB_URI="):
                        mongo_uri = line.strip().split("=", 1)[1]
                        break
        
        if not mongo_uri:
            mongo_uri = os.environ.get("MONGODB_URI")
            
        if not mongo_uri:
            print_warning("MongoDB URI not found in environment or server/.env")
            print_warning("Will attempt to connect to MongoDB using default connection")
            print_info("If your application uses MongoDB, ensure it's running and accessible")
        else:
            print_info("MongoDB URI found, but connection test not implemented")
            print_info("If your application uses MongoDB, ensure it's running and accessible")
    except Exception as e:
        print_warning(f"Error checking MongoDB: {e}")
    
    return True

def check_env_files():
    """Check if environment files exist and copy from examples if needed"""
    print_header("Checking environment files")
    
    for service_name, config in CONFIG.items():
        env_file = os.path.join(config["dir"], config["env_file"])
        example_file = os.path.join(config["dir"], "env.example")
        
        if not os.path.exists(env_file):
            if os.path.exists(example_file):
                print_warning(f"{env_file} not found, copying from {example_file}")
                try:
                    with open(example_file, "r") as src, open(env_file, "w") as dest:
                        dest.write(src.read())
                    print_success(f"Created {env_file} from example")
                except Exception as e:
                    print_error(f"Failed to copy example environment file: {e}")
            else:
                print_warning(f"No environment file found for {service_name}")
        else:
            print_success(f"Environment file for {service_name} exists")
    
    return True

def install_dependencies():
    """Install dependencies for each service"""
    print_header("Installing dependencies")
    
    # Check if AI service dependencies are already installed
    print_info("Checking AI service dependencies...")
    try:
        # Try importing key dependencies instead of installing them all
        import_check = subprocess.run(
            [sys.executable, "-c", "import fastapi, uvicorn, python_dotenv, requests"],
            capture_output=True,
            text=True
        )
        
        if import_check.returncode == 0:
            print_success("AI service dependencies already installed")
        else:
            print_info("Installing AI service dependencies...")
            try:
                subprocess.run(
                    [sys.executable, "-m", "pip", "install", "fastapi", "uvicorn", "python-dotenv", "requests"],
                    check=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE
                )
                print_success("Essential AI service dependencies installed")
            except subprocess.CalledProcessError as e:
                print_error(f"Failed to install AI service dependencies: {e}")
                print_warning("Continuing without installing all AI service dependencies")
    except Exception as e:
        print_error(f"Error checking AI service dependencies: {e}")
        print_warning("Continuing without installing AI service dependencies")
    
    # Install server dependencies
    print_info("Installing server dependencies...")
    try:
        server_install_result = subprocess.run(
            [npm_command, "install", "--prefix", "server"],
            capture_output=True,
            text=True
        )
        
        if server_install_result.returncode != 0:
            print_warning(f"Server dependency installation returned non-zero: {server_install_result.stderr}")
            print_warning("Continuing anyway as some npm warnings are not fatal")
        else:
            print_success("Server dependencies installed")
    except Exception as e:
        print_error(f"Failed to install server dependencies: {e}")
        print_warning("Continuing without installing server dependencies")
    
    # Install client dependencies
    print_info("Installing client dependencies...")
    try:
        client_install_result = subprocess.run(
            [npm_command, "install", "--prefix", "client"],
            capture_output=True,
            text=True
        )
        
        if client_install_result.returncode != 0:
            print_warning(f"Client dependency installation returned non-zero: {client_install_result.stderr}")
            print_warning("Continuing anyway as some npm warnings are not fatal")
        else:
            print_success("Client dependencies installed")
    except Exception as e:
        print_error(f"Failed to install client dependencies: {e}")
        print_warning("Continuing without installing client dependencies")
    
    return True

def is_port_in_use(port):
    """Check if a port is already in use"""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('localhost', port)) == 0

def check_port_availability():
    """Check if required ports are available"""
    print_header("Checking port availability")
    
    ports = [8000, 5000, 3000]  # AI service, server, client
    
    for port in ports:
        if is_port_in_use(port):
            print_error(f"Port {port} is already in use")
            return False
        else:
            print_success(f"Port {port} is available")
    
    return True

def start_ai_service():
    """Start the AI service"""
    print_header("Starting AI Service")
    
    # Change directory to ai_service
    original_dir = os.getcwd()
    os.chdir("ai_service")
    
    # Start the AI service
    try:
        print_info("Starting AI service with command: python -m uvicorn app:app --host 0.0.0.0 --port 8000")
        
        # First check if the app.py file exists
        if not os.path.isfile("app.py"):
            print_error("app.py not found in ai_service directory")
            os.chdir(original_dir)
            return None
        
        # Try running the AI service
        process = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        # Go back to the original directory
        os.chdir(original_dir)
        
        # Check if the process started
        if process.poll() is not None:
            print_error(f"AI service process exited immediately with code {process.returncode}")
            # Get the output
            stdout, stderr = process.communicate()
            if stdout:
                print_error(f"STDOUT: {stdout}")
            if stderr:
                print_error(f"STDERR: {stderr}")
            return None
        
        # Wait for the service to start
        print_info("Waiting for AI service to start...")
        max_attempts = 30
        for attempt in range(1, max_attempts + 1):
            try:
                print_info(f"Health check attempt {attempt}/{max_attempts}...")
                response = requests.get("http://localhost:8000/health", timeout=2)
                if response.status_code == 200:
                    print_success("AI service started successfully")
                    print_info(f"AI service response: {response.text}")
                    return process
                else:
                    print_warning(f"Health check returned status code {response.status_code}")
            except requests.exceptions.ConnectionError:
                # Check if process is still running
                if process.poll() is not None:
                    print_error(f"AI service process exited with code {process.returncode}")
                    stdout, stderr = process.communicate()
                    if stdout:
                        print_error(f"STDOUT: {stdout}")
                    if stderr:
                        print_error(f"STDERR: {stderr}")
                    return None
                time.sleep(1)
            except Exception as e:
                print_warning(f"Error during health check: {e}")
                time.sleep(1)
        
        print_error("AI service failed to start in time")
        
        # Attempt to get output from the process
        try:
            process.terminate()
            stdout, stderr = process.communicate(timeout=5)
            if stdout:
                print_error(f"STDOUT: {stdout}")
            if stderr:
                print_error(f"STDERR: {stderr}")
        except Exception as e:
            print_error(f"Error getting process output: {e}")
        
        return None
    except Exception as e:
        os.chdir(original_dir)
        print_error(f"Failed to start AI service: {e}")
        return None

def start_server(ai_service_process):
    """Start the server"""
    print_header("Starting Server")
    
    if not ai_service_process:
        print_error("Cannot start server because AI service is not running")
        return None
    
    # Change directory to server
    os.chdir("server")
    
    # Start the server
    try:
        process = subprocess.Popen(
            ["node", "index.js"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        # Go back to the original directory
        os.chdir("..")
        
        # Wait for the service to start
        print_info("Waiting for server to start...")
        for _ in range(30):  # Wait up to 30 seconds
            try:
                response = requests.get("http://localhost:5000/api/health")
                if response.status_code == 200:
                    print_success("Server started successfully")
                    return process
            except requests.exceptions.ConnectionError:
                time.sleep(1)
        
        print_error("Server failed to start in time")
        process.terminate()
        ai_service_process.terminate()
        return None
    except Exception as e:
        os.chdir("..")
        print_error(f"Failed to start server: {e}")
        ai_service_process.terminate()
        return None

def start_client(ai_service_process, server_process):
    """Start the client"""
    print_header("Starting Client")
    
    if not ai_service_process or not server_process:
        print_error("Cannot start client because AI service or server is not running")
        return None
    
    # Change directory to client
    os.chdir("client")
    
    # Start the client
    try:
        process = subprocess.Popen(
            [npm_command, "start"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        # Go back to the original directory
        os.chdir("..")
        
        print_info("Client starting... This may take a moment.")
        print_info("The client will open automatically in your default browser.")
        
        # No health check for the client as it depends on your browser
        time.sleep(5)  # Give it some time to start
        
        print_success("Client started")
        return process
    except Exception as e:
        os.chdir("..")
        print_error(f"Failed to start client: {e}")
        ai_service_process.terminate()
        server_process.terminate()
        return None

def main():
    """Main function to run the application"""
    print_header("QA-Genie Application Launcher")
    
    # Check prerequisites
    if not check_prerequisites():
        sys.exit(1)
    
    # Check environment files
    if not check_env_files():
        sys.exit(1)
    
    # Install dependencies
    if not install_dependencies():
        sys.exit(1)
    
    # Check port availability
    if not check_port_availability():
        sys.exit(1)
    
    # Start services in order
    ai_service_process = start_ai_service()
    if not ai_service_process:
        sys.exit(1)
    
    server_process = start_server(ai_service_process)
    if not server_process:
        sys.exit(1)
    
    client_process = start_client(ai_service_process, server_process)
    if not client_process:
        sys.exit(1)
    
    print_header("All services started successfully")
    print_info("AI Service: http://localhost:8000")
    print_info("Server: http://localhost:5000")
    print_info("Client: http://localhost:3000")
    
    print_info("\nPress Ctrl+C to stop all services\n")
    
    try:
        # Keep the script running until Ctrl+C
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print_header("Stopping all services")
        client_process.terminate()
        server_process.terminate()
        ai_service_process.terminate()
        print_success("All services stopped")

if __name__ == "__main__":
    main()