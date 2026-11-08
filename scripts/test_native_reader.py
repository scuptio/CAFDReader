#!/usr/bin/env python3
"""实际运行原生 WebView 两次，核对开卷、权限边界与跨进程保存。"""
import argparse,json,os,subprocess,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--binary',required=True,type=Path)
    parser.add_argument('--book',type=Path,default=ROOT/'tests/fixtures/reader.cafd')
    parser.add_argument('--report',type=Path)
    args=parser.parse_args();reports=[]
    with tempfile.TemporaryDirectory(prefix='caf-native-check-') as directory:
        root=Path(directory)
        for run in range(2):
            report=root/f'run-{run}.json'
            env=os.environ|{'CAF_SMOKE_OUTPUT':str(report),'CAF_SMOKE_DATA':str(root/'library')}
            result=subprocess.run([str(args.binary.resolve()),'--smoke',str(args.book.resolve())],env=env,capture_output=True,text=True,timeout=90)
            assert result.returncode==0,(result.returncode,result.stdout,result.stderr)
            data=json.loads(report.read_text());value=data['result']
            for key in ['ok','wasm','embeddedApp','fontsReady','visible','persisted','isolated','range','parentBlocked','networkBlocked','nativeDenied','tokenAbsent']:
                assert value[key] is True,(key,data)
            assert value['previousStarts']==run,data
            assert value['sandbox']=='allow-scripts',data
            reports.append(data)
            print(f'PASS 原生启动 {run+1}：{data["platform"]} / WebView {data["webview"]}，书页、字体、WASM、Range、隔离与持久保存',flush=True)
        assert reports[0]['result']['rootHash']==reports[1]['result']['rootHash']
    if args.report:args.report.write_text(json.dumps(dict(status='passed',runs=reports),ensure_ascii=False,indent=2)+'\n')

if __name__=='__main__':main()
