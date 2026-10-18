// SPDX-License-Identifier: GPL-3.0-or-later
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const installer = require('../scripts/installer-connecteur.cjs');
let passed = 0;
function test(name, fn) {
    fn();
    passed++;
    console.log('OK ' + name);
}
function asar(target, extra = '') {
    const js = Buffer.from('require(' + JSON.stringify(target) + ')' + extra);
    const json = Buffer.from(JSON.stringify({ files: { 'index.js': { size: js.length, offset: '0' } } }));
    const padded = (json.length + 3) & ~3;
    const header = Buffer.alloc(16 + padded);
    header.writeUInt32LE(4, 0);
    header.writeUInt32LE(8 + padded, 4);
    header.writeUInt32LE(4 + padded, 8);
    header.writeUInt32LE(json.length, 12);
    json.copy(header, 16);
    return Buffer.concat([header, js]);
}
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'discord-shortcuts-installer-'));
let index = 0;
function fixture() {
    const root = path.join(temporaryRoot, String(index++));
    const source = path.join(root, 'Vencord sources');
    const appData = path.join(root, 'AppData');
    const resources = path.join(root, 'Discord', 'app-1.2.3', 'resources');
    const runtime = path.join(appData, 'Vencord', 'dist');
    for (const dir of [source, resources, runtime, path.join(source, 'src/utils'), path.join(source, 'scripts'), path.join(source, 'dist')]) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(source, 'package.json'), '{"name":"vencord"}');
    fs.writeFileSync(path.join(source, 'src/utils/types.ts'), 'types');
    fs.writeFileSync(path.join(source, 'scripts/runInstaller.mjs'), 'installer');
    const bundledConnector = path.join(root, 'index.tsx');
    fs.writeFileSync(bundledConnector, 'name: "ShortcutToggle"');
    for (const file of ['patcher.js', 'preload.js', 'renderer.js', 'renderer.css']) {
        fs.writeFileSync(path.join(source, 'dist', file), 'new ShortcutToggle ' + file);
        fs.writeFileSync(path.join(runtime, file), 'old ' + file);
    }
    fs.writeFileSync(path.join(resources, 'app.asar'), asar(path.join(runtime, 'patcher.js')));
    return { root, source, appData, resources, runtime, bundledConnector };
}
try {
    test('reads the real bootstrap format without executing JavaScript', () => {
        const target = 'C:\\Users\\Example\\AppData\\Roaming\\Vencord\\dist\\patcher.js';
        assert.equal(installer.bootstrapTarget(asar(target)), target);
    });
    test('rejects additional bootstrap JavaScript', () => assert.equal(installer.bootstrapTarget(asar('C:\\Vencord\\dist\\patcher.js', ';evil()')), null));
    test('rejects a relative target', () => assert.equal(installer.bootstrapTarget(asar('..\\patcher.js')), null));
    test('rejects another module', () => assert.equal(installer.bootstrapTarget(asar('C:\\Vencord\\dist\\other.js')), null));
    test('rejects truncated archives', () => assert.equal(installer.bootstrapTarget(asar('C:\\Vencord\\dist\\patcher.js').subarray(0, 21)), null));
    test('rejects huge original application archives', () => assert.equal(installer.bootstrapTarget(Buffer.alloc(65537)), null));
    test('accepts only documented CLI options', () => {
        assert.deepEqual(installer.parseArguments(['--vencord', 'C:\\Vencord', '--check']), { source: 'C:\\Vencord', checkOnly: true });
        for (const args of [['--unknown'], ['--vencord'], ['--check', '--check'], ['--vencord', '--check']])
            assert.throws(() => installer.parseArguments(args));
    });
    test('unknown pnpm commands cannot reach the shell', () => {
        let called = false;
        assert.throws(() => installer.pnpm('build & echo unsafe', '.', () => { called = true; }));
        assert.equal(called, false);
    });
    test('custom source paths are passed as cwd, outside shell command text', () => {
        installer.pnpm('build', 'C:\\Example & test\\Vencord', (command, args, options) => {
            assert.equal(command, 'pnpm.cmd build');
            assert.deepEqual(args, []);
            assert.equal(options.cwd, 'C:\\Example & test\\Vencord');
        });
    });
    test('rejects a directory without genuine Vencord source markers', () => {
        const f = fixture();
        fs.unlinkSync(path.join(f.source, 'scripts/runInstaller.mjs'));
        assert.equal(installer.sourceIsValid(f.source), false);
    });
    test('uses the newest numeric Discord version', () => {
        const f = fixture();
        const local = path.join(f.root, 'Local');
        for (const version of ['1.0.9', '1.0.100', '1.0.20']) {
            const app = path.join(local, 'Discord', 'app-' + version);
            fs.mkdirSync(path.join(app, 'resources'), { recursive: true });
            fs.writeFileSync(path.join(app, 'Discord.exe'), '');
            fs.writeFileSync(path.join(app, 'resources', 'app.asar'), '');
        }
        assert.equal(installer.findDiscord(local), path.join(local, 'Discord', 'app-1.0.100', 'resources'));
    });
    test('refuses to write into an unrelated injected installation', () => {
        const f = fixture();
        assert.throws(() => installer.resolveRuntime(f.source, f.appData, path.join(f.root, 'unrelated', 'patcher.js')));
    });
    test('missing build outputs leave the active runtime intact', () => {
        const f = fixture();
        fs.unlinkSync(path.join(f.source, 'dist', 'preload.js'));
        assert.throws(() => installer.applyBuild(f.source, f.runtime, f.root));
        assert.equal(fs.readFileSync(path.join(f.runtime, 'renderer.js'), 'utf8'), 'old renderer.js');
    });
    test('build without the connector is rejected before any runtime copy', () => {
        const f = fixture();
        fs.writeFileSync(path.join(f.source, 'dist', 'renderer.js'), 'official build');
        assert.throws(() => installer.applyBuild(f.source, f.runtime, f.root));
        assert.equal(fs.readFileSync(path.join(f.runtime, 'renderer.js'), 'utf8'), 'old renderer.js');
    });
    test('copies and verifies all runtime files while preserving settings and backups', () => {
        const f = fixture();
        fs.writeFileSync(path.join(f.runtime, 'package.json'), 'untouched package');
        installer.applyBuild(f.source, f.runtime, f.root);
        assert.equal(fs.readFileSync(path.join(f.runtime, 'renderer.js'), 'utf8'), 'new ShortcutToggle renderer.js');
        assert.equal(fs.readFileSync(path.join(f.root, 'runtime', 'renderer.js'), 'utf8'), 'old renderer.js');
        assert.equal(fs.readFileSync(path.join(f.runtime, 'package.json'), 'utf8'), 'untouched package');
    });
    test('failed copy restores files already overwritten', () => {
        const f = fixture();
        const original = fs.copyFileSync;
        fs.copyFileSync = (from, to) => {
            if (from === path.join(f.source, 'dist', 'preload.js') && to === path.join(f.runtime, 'preload.js')) throw new Error('simulated disk failure');
            return original(from, to);
        };
        try { assert.throws(() => installer.applyBuild(f.source, f.runtime, f.root), /disk failure/); }
        finally { fs.copyFileSync = original; }
        assert.equal(fs.readFileSync(path.join(f.runtime, 'patcher.js'), 'utf8'), 'old patcher.js');
        assert.equal(fs.readFileSync(path.join(f.runtime, 'renderer.js'), 'utf8'), 'old renderer.js');
    });
    test('existing injected runtime is updated without reinjection', () => {
        const f = fixture();
        const calls = [];
        const result = installer.install({ ...f, execute: command => calls.push(command) });
        assert.deepEqual(calls, ['pnpm.cmd install --frozen-lockfile', 'pnpm.cmd build']);
        assert.equal(result.runtime, f.runtime);
        assert.equal(fs.readFileSync(path.join(f.source, 'src/userplugins/shortcutToggle/index.tsx'), 'utf8'), 'name: "ShortcutToggle"');
    });
    test('first installation uses the official injection command then verifies its target', () => {
        const f = fixture();
        fs.writeFileSync(path.join(f.resources, 'app.asar'), 'original Discord');
        const calls = [];
        installer.install({ ...f, execute: (command, args) => {
            calls.push([command, args]);
            if (args[0]?.endsWith('runInstaller.mjs')) fs.writeFileSync(path.join(f.resources, 'app.asar'), asar(path.join(f.source, 'dist', 'patcher.js')));
        } });
        assert.deepEqual(calls[2], [process.execPath, [path.join(f.source, 'scripts', 'runInstaller.mjs'), '--', '-install', '-branch', 'stable']]);
    });
    test('injection that reports success but does not change Discord is rejected', () => {
        const f = fixture();
        fs.writeFileSync(path.join(f.resources, 'app.asar'), 'original Discord');
        assert.throws(() => installer.install({ ...f, execute: () => {} }), /n'a pas relie/);
    });
    test('a build failure never copies into the separate active runtime', () => {
        const f = fixture();
        assert.throws(() => installer.install({ ...f, execute: command => {
            if (command === 'pnpm.cmd build') throw new Error('build failed');
        } }), /build failed/);
        assert.equal(fs.readFileSync(path.join(f.runtime, 'renderer.js'), 'utf8'), 'old renderer.js');
    });
    test('unknown bootstrap destination is rejected before running dependencies', () => {
        const f = fixture();
        fs.writeFileSync(path.join(f.resources, 'app.asar'), asar(path.join(f.root, 'other', 'patcher.js')));
        let called = false;
        assert.throws(() => installer.install({ ...f, execute: () => { called = true; } }));
        assert.equal(called, false);
        assert.equal(fs.existsSync(path.join(f.source, 'src/userplugins/shortcutToggle/index.tsx')), false);
    });
    test('failed compilation restores a runtime loaded directly from the sources', () => {
        const f = fixture();
        fs.writeFileSync(path.join(f.resources, 'app.asar'), asar(path.join(f.source, 'dist', 'patcher.js')));
        assert.throws(() => installer.install({ ...f, execute: command => {
            if (command === 'pnpm.cmd build') {
                fs.writeFileSync(path.join(f.source, 'dist', 'renderer.js'), 'partial failed output');
                throw new Error('build failed');
            }
        } }), /build failed/);
        assert.equal(fs.readFileSync(path.join(f.source, 'dist', 'renderer.js'), 'utf8'), 'new ShortcutToggle renderer.js');
    });
    test('reopening Discord during preparation prevents the active runtime copy', () => {
        const f = fixture();
        let checks = 0;
        assert.throws(() => installer.install({ ...f, execute: () => {}, ensureClosed: () => {
            if (++checks === 2) throw new Error('Discord reopened');
        } }), /Discord reopened/);
        assert.equal(fs.readFileSync(path.join(f.runtime, 'renderer.js'), 'utf8'), 'old renderer.js');
    });
    test('read-only check detects a stale active copy', () => {
        const f = fixture();
        assert.throws(() => installer.check(f.source, f.appData, f.resources), /absent/);
        assert.equal(fs.readFileSync(path.join(f.runtime, 'renderer.js'), 'utf8'), 'old renderer.js');
    });
    test('read-only check also detects a partially outdated runtime', () => {
        const f = fixture();
        fs.writeFileSync(path.join(f.runtime, 'renderer.js'), 'new ShortcutToggle renderer.js');
        assert.throws(() => installer.check(f.source, f.appData, f.resources), /differe/);
    });
    console.log('\n' + passed + ' installer checks passed.');
} finally {
    // The verified mkdtemp root contains only fixtures created above.
    if (path.dirname(temporaryRoot) === os.tmpdir() && path.basename(temporaryRoot).startsWith('discord-shortcuts-installer-'))
        fs.rmSync(temporaryRoot, { recursive: true, force: true });
}
