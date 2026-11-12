"""Set up Android build dependencies on Ubuntu / Windows x64; configuration is stored in this project under build/."""
import argparse
import hashlib
import json
import os
import platform
import re
import shlex
import shutil
import stat
import subprocess
import sys
import tempfile
import urllib.request
import zipfile
from pathlib import Path, PureWindowsPath, PurePosixPath

ROOT = Path(__file__).resolve().parent.parent
TOOLCHAIN = json.loads((ROOT / 'config/android-toolchain.json').read_text(encoding='utf-8'))
APT_PACKAGES = [f'openjdk-{TOOLCHAIN["java_major"]}-jdk-headless', 'build-essential', 'pkg-config', 'libssl-dev', 'ca-certificates']


def sdk_location(host, override=None, env=None):
    env = os.environ if env is None else env
    path_type = PureWindowsPath if host == 'win32' else PurePosixPath
    existing = override or env.get('ANDROID_HOME') or env.get('ANDROID_SDK_ROOT')
    if existing:
        return path_type(existing)
    if host == 'win32':
        local = env.get('LOCALAPPDATA') or str(path_type(env.get('USERPROFILE', 'C:/Users/USER')) / 'AppData/Local')
        return path_type(local) / 'Android/Sdk'
    return path_type(env.get('HOME', str(Path.home()))) / 'Android/Sdk'


def packages():
    return ['platform-tools', 'platforms;' + TOOLCHAIN['platform'],
            'build-tools;' + TOOLCHAIN['build_tools'], 'ndk;' + TOOLCHAIN['ndk']]


def windows_batch_command(args, comspec='cmd.exe'):
    # cmd.exe 不使用 POSIX 或 CreateProcess 的转义规则；所有参数加双引号，
    # 拒绝仍会展开的百分号和无法安全嵌入的引号/换行，关闭 delayed expansion。
    if any(any(c in str(arg) for c in '"%\r\n') for arg in [comspec, *args]):
        raise ValueError('Windows batch paths/arguments cannot contain double quotes, percent signs or newlines')
    return f'"{comspec}" /d /v:off /s /c "' + ' '.join('"' + str(a) + '"' for a in args) + '"'


def run(args, env=None, capture=False, input=None):
    args = [str(a) for a in args]
    print('  > ' + subprocess.list2cmdline(args), flush=True)
    command = windows_batch_command(args, os.environ.get('COMSPEC', 'cmd.exe')) if os.name == 'nt' and args[0].lower().endswith(('.bat', '.cmd')) else args
    return subprocess.run(command, cwd=ROOT, env=env, check=True, input=input,
                          text=True, capture_output=capture)


def java_home(host, env=None):
    env = os.environ if env is None else env
    candidates = []
    if env.get('JAVA_HOME'):
        candidates.append(Path(env['JAVA_HOME']))
    if shutil.which('java', path=env.get('PATH')):
        candidates.append(Path(shutil.which('java', path=env.get('PATH'))).resolve().parent.parent)
    if host == 'linux':
        candidates += sorted(Path('/usr/lib/jvm').glob(f'*{TOOLCHAIN["java_major"]}*'))
    else:
        candidates += sorted((Path(env.get('ProgramFiles', 'C:/Program Files')) / 'Eclipse Adoptium').glob(f'jdk-{TOOLCHAIN["java_major"]}*'))
    for candidate in candidates:
        binary = candidate / 'bin' / ('java.exe' if host == 'win32' else 'java')
        compiler = candidate / 'bin' / ('javac.exe' if host == 'win32' else 'javac')
        if not binary.is_file() or not compiler.is_file():
            continue
        result = subprocess.run([str(binary), '-version'], capture_output=True, text=True)
        match = re.search(r'version "(\d+)', result.stderr + result.stdout)
        if result.returncode == 0 and match and int(match[1]) == TOOLCHAIN['java_major']:
            return candidate.resolve()
    return None


def visual_studio(required=True):
    vswhere = Path(os.environ.get('ProgramFiles(x86)', 'C:/Program Files (x86)')) / 'Microsoft Visual Studio/Installer/vswhere.exe'
    if not vswhere.is_file():
        return None
    requirements = ['-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64'] if required else []
    result = subprocess.run([str(vswhere), '-products', '*', '-latest', *requirements, '-property', 'installationPath'],
                            text=True, capture_output=True)
    return result.stdout.strip() if result.returncode == 0 and result.stdout.strip() else None


def install_system(host):
    if host == 'linux':
        sudo = [] if os.geteuid() == 0 else ['sudo']
        run([*sudo, 'apt-get', 'update'])
        run([*sudo, 'apt-get', 'install', '-y', *APT_PACKAGES])
    else:
        def winget(args):
            if not shutil.which('winget'):
                raise RuntimeError('winget from Windows App Installer is required; install it and rerun.')
            run(['winget', 'install', *args, *common])

        common = ['--exact', '--source', 'winget', '--accept-source-agreements', '--accept-package-agreements']
        if not java_home(host):
            winget(['--id', f'EclipseAdoptium.Temurin.{TOOLCHAIN["java_major"]}.JDK'])
        if not visual_studio():
            existing = visual_studio(required=False)
            if existing:
                installer = Path(os.environ.get('ProgramFiles(x86)', 'C:/Program Files (x86)')) / 'Microsoft Visual Studio/Installer/setup.exe'
                run([installer, 'modify', '--installPath', existing, '--passive', '--norestart',
                     '--add', 'Microsoft.VisualStudio.Workload.VCTools', '--includeRecommended'])
            else:
                winget(['--id', 'Microsoft.VisualStudio.2022.BuildTools',
                        '--override', '--wait --passive --norestart --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended'])


def checked_extract(archive, directory):
    """只解压普通相对路径，拒绝路径穿越和符号链接。"""
    directory = Path(directory).resolve()
    with zipfile.ZipFile(archive) as source:
        for item in source.infolist():
            parts = item.filename.replace('\\', '/').split('/')
            mode = item.external_attr >> 16
            if item.filename.startswith(('/', '\\')) or ':' in parts[0] or '..' in parts or stat.S_ISLNK(mode):
                raise ValueError('Unsafe path in SDK archive: ' + item.filename)
            target = directory.joinpath(*parts)
            if not target.resolve().is_relative_to(directory):
                raise ValueError('SDK extraction path escapes the destination')
        source.extractall(directory)
        for item in source.infolist():
            path = directory / item.filename
            if path.is_file() and (item.external_attr >> 16) & 0o111:
                path.chmod(path.stat().st_mode | 0o111)


def download(url, destination, expected):
    h = hashlib.sha256()
    request = urllib.request.Request(url, headers={'User-Agent': 'CAFDReader-Android-Setup'})
    with urllib.request.urlopen(request, timeout=120) as incoming, destination.open('wb') as output:
        if not incoming.url.startswith('https://'):
            raise ValueError('SDK downloads must use HTTPS')
        while data := incoming.read(1024 * 1024):
            output.write(data)
            h.update(data)
    if h.hexdigest() != expected:
        raise ValueError('Android command-line tools SHA-256 mismatch; not installed')


def install_cli(host, sdk):
    config = TOOLCHAIN['command_line_tools']
    destination = sdk / 'cmdline-tools' / ('cafd-' + config['revision'])
    executable = 'sdkmanager.bat' if host == 'win32' else 'sdkmanager'
    manager = destination / 'bin' / executable
    if manager.is_file() and (destination / 'lib').is_dir():
        return manager
    if destination.exists():
        raise RuntimeError(f'Incomplete command-line tools directory: {destination}; move it aside and retry.')
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='.cafd-setup-', dir=destination.parent) as folder:
        folder = Path(folder)
        archive = folder / 'tools.zip'
        print('Download and verify: ' + config[host]['url'], flush=True)
        download(config[host]['url'], archive, config[host]['sha256'])
        checked_extract(archive, folder / 'unpacked')
        extracted = folder / 'unpacked/cmdline-tools'
        if not (extracted / 'bin' / executable).is_file() or not (extracted / 'lib').is_dir():
            raise ValueError('Invalid SDK command-line tools archive layout')
        extracted.rename(destination)
    return manager


def environment(host, sdk, jdk):
    paths = [str(jdk / 'bin'), str(sdk / 'platform-tools'),
             str(sdk / 'cmdline-tools' / ('cafd-' + TOOLCHAIN['command_line_tools']['revision']) / 'bin')]
    return dict(schema_version=1, platform=host, env={
        'JAVA_HOME': str(jdk), 'ANDROID_HOME': str(sdk), 'ANDROID_SDK_ROOT': str(sdk),
        'NDK_HOME': str(sdk / 'ndk' / TOOLCHAIN['ndk'])}, path=paths)


def write_environment(settings):
    output = ROOT / 'build'
    output.mkdir(exist_ok=True)
    temporary = output / 'android-env.json.tmp'
    temporary.write_text(json.dumps(settings, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temporary.replace(output / 'android-env.json')
    if settings['platform'] == 'linux':
        lines = [f'export {key}={shlex.quote(value)}' for key, value in settings['env'].items()]
        lines.append('export PATH=' + shlex.quote(':'.join(settings['path'])) + ':"$PATH"')
        (output / 'android-env.sh').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    else:
        quote = lambda s: "'" + s.replace("'", "''") + "'"
        lines = [f'$env:{key} = {quote(value)}' for key, value in settings['env'].items()]
        lines.append('$env:Path = ' + quote(';'.join(settings['path']) + ';') + ' + $env:Path')
        (output / 'android-env.ps1').write_text('\n'.join(lines) + '\n', encoding='utf-8-sig')


def print_plan(host, sdk, skip_system, skip_npm):
    print('Android setup plan (no installation or writes)')
    print('Platform: ' + ('Ubuntu x64' if host == 'linux' else 'Windows x64'))
    print('Prerequisites: Node.js 24+, Python 3.11+, Rust/rustup, cargo-make 0.37.24+')
    if not skip_system:
        print('System dependencies: ' + ('apt-get install ' + ' '.join(APT_PACKAGES) if host == 'linux' else 'winget: Temurin 21 JDK, Visual Studio 2022 C++ Build Tools (install if missing)'))
    print('Android SDK: ' + str(sdk))
    print('Download: ' + TOOLCHAIN['command_line_tools'][host]['url'])
    print('SHA-256: ' + TOOLCHAIN['command_line_tools'][host]['sha256'])
    print('sdkmanager --licenses; sdkmanager ' + ' '.join(packages()))
    print('rustup target add ' + ' '.join(TOOLCHAIN['rust_targets']))
    if not skip_npm:
        print('npm ci')
    print('Project configuration: build/android-env.json; loaded automatically by cargo make reader android')


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--plan', action='store_true', help='Show the plan without downloading, installing or writing files')
    parser.add_argument('--platform', choices=['ubuntu', 'windows'], help='Preview another platform with --plan only')
    parser.add_argument('--sdk-root', help='SDK directory; defaults to ANDROID_HOME or the user SDK directory')
    parser.add_argument('--yes', action='store_true', help='Accept SDK licenses automatically (for CI)')
    parser.add_argument('--skip-system', action='store_true', help='Reuse the installed JDK and system build tools')
    parser.add_argument('--skip-npm', action='store_true', help='Skip npm ci')
    args = parser.parse_args(argv)
    if sys.version_info < (3, 11):
        parser.error('Python 3.11 or newer is required')
    host = {'ubuntu': 'linux', 'windows': 'win32'}.get(args.platform, sys.platform)
    if host not in {'linux', 'win32'}:
        parser.error('Only Ubuntu / Windows x64 is supported')
    if args.platform and not args.plan:
        parser.error('--platform requires --plan; installation detects the host automatically')
    sdk = sdk_location(host, args.sdk_root, {} if host != sys.platform else None)
    if args.plan:
        print_plan(host, sdk, args.skip_system, args.skip_npm)
        return
    if platform.machine().lower() not in {'x86_64', 'amd64'}:
        raise RuntimeError('The pinned Android tools only support x64 build hosts')
    if host == 'linux':
        release = platform.freedesktop_os_release()
        if release.get('ID') != 'ubuntu' or tuple(map(int, release.get('VERSION_ID', '0').split('.'))) < (22, 4):
            raise RuntimeError('Linux setup only supports Ubuntu 22.04 or newer')
    for executable in ['node', 'rustup', 'cargo']:
        if not shutil.which(executable):
            raise RuntimeError(f'Missing prerequisite {executable}; install the base toolchain as described in README')
    if int(run(['node', '-p', 'process.versions.node.split(".")[0]'], capture=True).stdout.strip()) < 24:
        raise RuntimeError('Node.js 24 or newer is required')
    if not args.skip_system:
        install_system(host)
    jdk = java_home(host)
    if not jdk:
        raise RuntimeError('Java 21 JDK not found; check JAVA_HOME or rerun system dependency setup')
    if host == 'win32' and not visual_studio():
        raise RuntimeError('MSVC C++ Build Tools not found; reboot and retry if requested by the installer')
    sdk = Path(sdk).expanduser().resolve()
    manager = install_cli(host, sdk)
    settings = environment(host, sdk, jdk)
    env = os.environ | settings['env']
    env['PATH'] = os.pathsep.join(settings['path'] + [env.get('PATH', '')])
    run([manager, '--sdk_root=' + str(sdk), '--licenses'], env=env, input='y\n' * 100 if args.yes else None)
    run([manager, '--sdk_root=' + str(sdk), *packages()], env=env, input='y\n' * 100 if args.yes else None)
    run(['rustup', 'target', 'add', *TOOLCHAIN['rust_targets']], env=env)
    if not args.skip_npm:
        # Windows 的批处理参数统一由 run() 处理。
        npm = shutil.which('npm.cmd' if host == 'win32' else 'npm', path=env['PATH'])
        if not npm:
            raise RuntimeError('npm not found; check the Node.js installation')
        run([npm, 'ci'], env=env)
    expected = [sdk / 'platforms' / TOOLCHAIN['platform'] / 'android.jar',
                sdk / 'build-tools' / TOOLCHAIN['build_tools'] / ('aapt2.exe' if host == 'win32' else 'aapt2'),
                sdk / 'ndk' / TOOLCHAIN['ndk'] / 'source.properties']
    if any(not p.is_file() for p in expected):
        raise RuntimeError('SDK packages are incomplete; project environment was not saved. Rerun setup')
    write_environment(settings)
    print('Android build environment configured. Next: cargo make doctor android; cargo make reader android')


if __name__ == '__main__':
    try:
        main()
    except (OSError, RuntimeError, ValueError, subprocess.CalledProcessError, zipfile.BadZipFile) as error:
        print('Android setup failed: ' + str(error), file=sys.stderr)
        sys.exit(1)
