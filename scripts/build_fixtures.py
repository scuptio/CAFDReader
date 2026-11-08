"""可重现的独立 CAFD 测试夹具：只需 rustc wasm target 和 CAF_TOOL，不依赖内容仓库。"""
import argparse,hashlib,json,os,shutil,subprocess,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--caf-tool',default=os.environ.get('CAF_TOOL') or shutil.which('caf-tool'))
    args=p.parse_args()
    if not args.caf_tool:p.error('重建夹具需要 caf-tool，请用 CAF_TOOL 或 --caf-tool 指定；日常测试直接用已提交夹具。')
    tool=str(Path(args.caf_tool).resolve());out=ROOT/'tests/fixtures';work=ROOT/'build';work.mkdir(exist_ok=True)
    wasm=work/'fixture.wasm'
    subprocess.run(['rustc','--edition=2021','--crate-type=cdylib','--target=wasm32-unknown-unknown','-C','opt-level=z','-C','panic=abort','-C','strip=symbols',str(out/'component.rs'),'-o',str(wasm)],cwd=ROOT,check=True)
    with tempfile.TemporaryDirectory(prefix='cafd-fixtures-') as directory:
        base=Path(directory)
        for kind in ['reader','legacy','unsupported','future']:
            root=base/kind;payload=root/'payload';(payload/'app').mkdir(parents=True)
            meta=dict(title='交互文档验证',author='CAFD Reader',note='<img id="metadata-injection">')
            if kind!='legacy':meta['web_app_manifest']='/app/manifest.json'
            (payload/'meta.json').write_text(json.dumps(meta,ensure_ascii=False,sort_keys=True),encoding='utf-8')
            (payload/'app/manifest.json').write_text(json.dumps(dict(protocol='future' if kind=='future' else 'caf:doc-web@1',component='ebook',entry='/app/index.html',methods=['info']),sort_keys=True),encoding='utf-8')
            shutil.copyfile(out/'app.html',payload/'app/index.html');shutil.copyfile(wasm,root/'fixture.wasm')
            config='name = "CAFD 协议夹具"\nversion = "1.0.0"\ninterfaces = ['+json.dumps(str(ROOT/'spec/ebook.wit'))+']\n[payload]\nroot = "payload"\n'
            if kind!='unsupported':config+='[[components]]\nname = "ebook"\nworld = "ebook-reader"\npath = "fixture.wasm"\ncapabilities = ["caf:doc@1"]\naccess = ["/"]\n'
            (root/'build.toml').write_text(config,encoding='utf-8')
            target=out/(kind+('.caf' if kind=='legacy' else '.cafd'))
            subprocess.run([tool,'build','-c',str(root/'build.toml'),'-o',str(target)],check=True,stdout=subprocess.DEVNULL)
            subprocess.run([tool,'verify',str(target)],check=True,stdout=subprocess.DEVNULL)
        values={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(out.iterdir()) if p.suffix in {'.cafd','.caf','.rs','.html'}}
        (out/'sha256.json').write_text(json.dumps(values,sort_keys=True,indent=2)+'\n',encoding='utf-8')
    print('PASS 独立夹具已重建和 verify：reader、legacy、unsupported、future')
if __name__=='__main__':main()
