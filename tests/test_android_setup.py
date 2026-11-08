import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import zipfile

SPEC = importlib.util.spec_from_file_location('android_setup', Path(__file__).resolve().parents[1] / 'scripts/setup_android.py')
setup = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(setup)


class AndroidSetupTests(unittest.TestCase):
    def test_cross_platform_plans_never_install_or_write(self):
        with patch.object(setup, 'install_system') as install, patch.object(setup, 'download') as download, patch.object(setup, 'write_environment') as write:
            for host in ['ubuntu', 'windows']:
                with patch('sys.stdout', new_callable=io.StringIO) as output:
                    setup.main(['--plan', '--platform', host, '--sdk-root', 'SDK with spaces'])
                self.assertIn('ndk;28.2.13676358', output.getvalue())
                self.assertIn('SDK with spaces', output.getvalue())
            install.assert_not_called()
            download.assert_not_called()
            write.assert_not_called()
        with patch('sys.stderr', new_callable=io.StringIO), self.assertRaises(SystemExit):
            setup.main(['--platform', 'windows'])

    def test_sdk_selection_respects_explicit_path_and_existing_sdk(self):
        env = {'ANDROID_HOME': '/existing', 'ANDROID_SDK_ROOT': '/other', 'HOME': '/home/test'}
        self.assertEqual(str(setup.sdk_location('linux', env=env)), '/existing')
        self.assertEqual(str(setup.sdk_location('linux', '/custom', env)), '/custom')
        self.assertEqual(str(setup.sdk_location('linux', env={'HOME': '/home/test'})), '/home/test/Android/Sdk')
        self.assertEqual(str(setup.sdk_location('win32', env={'LOCALAPPDATA': r'C:\Users\Test User\AppData\Local'})), r'C:\Users\Test User\AppData\Local\Android\Sdk')

    def test_download_hash_failure_prevents_use(self):
        with tempfile.TemporaryDirectory() as folder:
            source = io.BytesIO(b'corrupt download')
            source.url = 'https://dl.google.com/example.zip'
            with patch.object(setup.urllib.request, 'urlopen', return_value=source):
                with self.assertRaisesRegex(ValueError, 'SHA-256'):
                    setup.download(source.url, Path(folder) / 'tools.zip', hashlib.sha256(b'expected').hexdigest())

    def test_archive_rejects_traversal_windows_drives_and_symlinks(self):
        for name in ['../outside', '/absolute', r'..\outside', 'C:/outside']:
            with self.subTest(name=name), tempfile.TemporaryDirectory() as folder:
                archive = Path(folder) / 'bad.zip'
                with zipfile.ZipFile(archive, 'w') as z:
                    z.writestr(name, 'bad')
                with self.assertRaises(ValueError):
                    setup.checked_extract(archive, Path(folder) / 'output')
        with tempfile.TemporaryDirectory() as folder:
            archive = Path(folder) / 'link.zip'
            entry = zipfile.ZipInfo('link')
            entry.create_system = 3
            entry.external_attr = 0o120777 << 16
            with zipfile.ZipFile(archive, 'w') as z:
                z.writestr(entry, '/outside')
            with self.assertRaises(ValueError):
                setup.checked_extract(archive, Path(folder) / 'output')

    def test_windows_batch_quotes_shell_characters_and_rejects_expansion(self):
        command = setup.windows_batch_command([r'C:\SDK & tools\sdkmanager.bat', r'--sdk_root=C:\SDK&tools', 'ndk;28.2.13676358'])
        self.assertIn('"--sdk_root=C:\\SDK&tools"', command)
        self.assertIn('/v:off', command)
        for value in ['%PATH%', 'bad"path', 'bad\npath']:
            with self.assertRaises(ValueError):
                setup.windows_batch_command(['tool.cmd', value])

    def test_windows_reuses_ready_tools_without_winget(self):
        with patch.object(setup, 'java_home', return_value=Path('/jdk')), \
             patch.object(setup, 'visual_studio', return_value='existing VS'), \
             patch.object(setup.shutil, 'which', return_value=None), patch.object(setup, 'run') as run:
            setup.install_system('win32')
            run.assert_not_called()

    def test_windows_completes_existing_visual_studio_and_propagates_install_errors(self):
        with patch.object(setup, 'java_home', return_value=Path('/jdk')), \
             patch.object(setup, 'visual_studio', side_effect=[None, 'C:/VS Build Tools']), \
             patch.object(setup, 'run') as run:
            setup.install_system('win32')
            command = run.call_args.args[0]
            self.assertIn('modify', command)
            self.assertIn('C:/VS Build Tools', command)
            self.assertIn('Microsoft.VisualStudio.Workload.VCTools', command)
        with patch.object(setup, 'java_home', return_value=None), \
             patch.object(setup.shutil, 'which', return_value='winget.exe'), \
             patch.object(setup, 'run', side_effect=subprocess.CalledProcessError(5, ['winget'])):
            with self.assertRaises(subprocess.CalledProcessError):
                setup.install_system('win32')

    @unittest.skipUnless(os.name == 'nt', 'requires cmd.exe')
    def test_windows_batch_argument_roundtrip(self):
        with tempfile.TemporaryDirectory(prefix='SDK & tools ') as folder:
            script = Path(folder) / 'echo.py'
            script.write_text('import json,sys;print(json.dumps(sys.argv[1:]))', encoding='utf-8')
            batch = Path(folder) / 'tool.cmd'
            batch.write_text(f'@"{sys.executable}" "{script}" %*\n', encoding='utf-8')
            values = ['--sdk_root=C:\\SDK&tools', 'path with spaces', 'ndk;28.2.13676358']
            result = subprocess.run(setup.windows_batch_command([batch, *values]), text=True, capture_output=True, check=True)
            self.assertEqual(json.loads(result.stdout), values)

    @unittest.skipUnless(sys.platform == 'linux', 'Ubuntu installation simulation')
    def test_setup_propagates_environment_and_preserves_config_on_failure(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            sdk = root / 'SDK with spaces'
            jdk = root / 'jdk21'
            manager = sdk / 'sdkmanager'
            for relative in ['platforms/android-36/android.jar', 'build-tools/36.0.0/aapt2', 'ndk/28.2.13676358/source.properties']:
                file = sdk / relative
                file.parent.mkdir(parents=True, exist_ok=True)
                file.touch()
            commands = []

            def fake_run(args, env=None, capture=False, input=None):
                commands.append((args, env, input))
                return subprocess.CompletedProcess(args, 0, stdout='24\n')

            with patch.object(setup, 'ROOT', root), patch.object(setup, 'run', side_effect=fake_run), \
                 patch.object(setup, 'java_home', return_value=jdk), patch.object(setup, 'install_cli', return_value=manager), \
                 patch.object(setup.shutil, 'which', return_value='/usr/bin/tool'), \
                 patch.object(setup.platform, 'machine', return_value='x86_64'), \
                 patch.object(setup.platform, 'freedesktop_os_release', return_value={'ID': 'ubuntu', 'VERSION_ID': '24.04'}):
                setup.main(['--yes', '--skip-system', '--skip-npm', '--sdk-root', str(sdk)])
                config = root / 'build/android-env.json'
                saved = config.read_bytes()
                self.assertEqual(json.loads(saved)['env']['NDK_HOME'], str(sdk / 'ndk/28.2.13676358'))
                license_command = next(c for c in commands if '--licenses' in c[0])
                self.assertEqual(license_command[1]['JAVA_HOME'], str(jdk))
                self.assertTrue(license_command[2].startswith('y\n'))
                self.assertTrue(license_command[1]['PATH'].startswith(str(jdk / 'bin')))
                def fail_sdk(args, **kwargs):
                    if args[0] == manager and '--licenses' not in args:
                        raise subprocess.CalledProcessError(7, args)
                    return fake_run(args, **kwargs)

                with patch.object(setup, 'run', side_effect=fail_sdk):
                    with self.assertRaises(subprocess.CalledProcessError):
                        setup.main(['--skip-system', '--skip-npm', '--sdk-root', str(sdk)])
                self.assertEqual(config.read_bytes(), saved)


if __name__ == '__main__':
    unittest.main()
