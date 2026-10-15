const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const esbuild=require(process.env.ESBUILD_PATH || 'esbuild');
async function run(){
    const root=path.resolve(__dirname,'..');
    const source=fs.readFileSync(path.join(root,'shortcutToggle/index.tsx'),'utf8');
    const compiled=await esbuild.transform(source,{loader:'tsx',target:'esnext',format:'cjs'});
    let checks=await require('./engine.cjs')(compiled.code);
    const hub=await esbuild.build({entryPoints:[path.join(root,'stream-deck/src/hub.ts')],bundle:true,platform:'node',format:'cjs',write:false});
    const context={module:{exports:{}},exports:{},require,structuredClone,Date,setTimeout,clearTimeout};
    vm.runInNewContext(hub.outputFiles[0].text,context);
    checks+=await require('./hub.cjs')(context.module.exports);
    checks+=await require('./integration.cjs')(compiled.code,context.module.exports);
    checks+=require('./interface.cjs')();
    checks+=await require('./updates.cjs')();
    console.log('Connector TSX compilation and '+checks+' behavioral checks: PASS');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
