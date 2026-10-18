// SPDX-License-Identifier: GPL-3.0-or-later
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
if (process.platform !== 'win32') {
    console.log('Native application control checks require Windows; skipped on this platform.');
} else {
    const root = path.resolve(__dirname, '..');
    const parent = path.join(root, '.test-tmp');
    fs.mkdirSync(parent, { recursive:true });
    const temporary = fs.mkdtempSync(path.join(parent, 'application-control-'));
    try {
        const compiler = path.join(process.env.SystemRoot || 'C:\\Windows', 'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
        const executable = path.join(temporary, 'tests.exe');
        const build = cp.spawnSync(compiler, ['/nologo','/target:exe','/main:ApplicationControlTests','/codepage:65001','/utf8output',
            '/reference:System.Web.Extensions.dll','/out:'+executable, path.join(root,'installer/ApplicationControl.cs'),path.join(__dirname,'ApplicationControlTests.cs')],{encoding:'utf8',windowsHide:true});
        if(build.error || build.status!==0)throw new Error(build.stdout+build.stderr);
        const test = cp.spawnSync(executable,[],{encoding:'utf8',windowsHide:true});
        if(test.error || test.status!==0)throw new Error(test.stdout+test.stderr);
        process.stdout.write(test.stdout);
    } finally {
        if(path.dirname(temporary)===parent && path.basename(temporary).startsWith('application-control-'))fs.rmSync(temporary,{recursive:true,force:true});
    }
}
