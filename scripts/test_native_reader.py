#!/usr/bin/env python3
"""Launch the native WebView twice to verify document opening, permission boundaries and persistence."""
import argparse,json,os,shutil,subprocess,sys,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--binary',required=True,type=Path)
    parser.add_argument('--book',type=Path,default=ROOT/'tests/fixtures/reader.cafd')
    parser.add_argument('--report',type=Path)
    parser.add_argument('--max-read-bytes',type=int)
    parser.add_argument('--max-cache-bytes',type=int)
    args=parser.parse_args();reports=[]
    with tempfile.TemporaryDirectory(prefix='caf-native-check-') as directory:
        root=Path(directory)
        for run in range(2):
            report=root/f'run-{run}.json'
            env=os.environ|{'CAF_SMOKE_OUTPUT':str(report),'CAF_SMOKE_DATA':str(root/'library')}
            if os.name=='posix':
                for key,folder in [('XDG_CACHE_HOME','browser-cache'),('XDG_CONFIG_HOME','browser-config'),('XDG_DATA_HOME','browser-data')]:
                    directory=root/f'{folder}-{run}';directory.mkdir(exist_ok=True);env[key]=str(directory)
            command=[str(args.binary.resolve()),'--smoke',str(args.book.resolve())]
            if sys.platform.startswith('linux') and shutil.which('dbus-run-session'):command=['dbus-run-session','--',*command]
            result=subprocess.run(command,env=env,capture_output=True,text=True,timeout=90)
            assert result.returncode==0,(result.returncode,result.stdout,result.stderr)
            assert report.is_file(),('Native process did not generate an acceptance report',result.returncode,result.stdout,result.stderr)
            data=json.loads(report.read_text());value=data['result']
            for key in ['ok','wasm','embeddedApp','fontsReady','visible','persisted','isolated','range','parentBlocked','networkBlocked','nativeDenied','tokenAbsent']:
                assert value[key] is True,(key,data)
            if args.max_read_bytes is not None:assert value['runtimeStats']['bytesFetched']<=args.max_read_bytes,data
            if args.max_cache_bytes is not None:assert value['runtimeStats']['cachedBytes']<=args.max_cache_bytes,data
            assert value['previousStarts']==run,data
            assert value['sandbox']=='allow-scripts',data
            reports.append(data)
            if args.report:args.report.with_name(args.report.stem+f'-run-{run+1}.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
            print('Runtime read statistics: '+json.dumps(value.get('runtimeStats',{}),ensure_ascii=False),flush=True)
            print(f'PASS Native launch {run+1}: {data["platform"]} / WebView {data["webview"]}; document, fonts, WASM, Range, isolation and persistence',flush=True)
        assert reports[0]['result']['rootHash']==reports[1]['result']['rootHash']
    if args.report:args.report.write_text(json.dumps(dict(status='passed',runs=reports),ensure_ascii=False,indent=2)+'\n')

if __name__=='__main__':main()
