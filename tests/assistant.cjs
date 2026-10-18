// SPDX-License-Identifier: GPL-3.0-or-later
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const operations = require('../installer/operations.cjs');
const lifecycle = require('../installer/application-lifecycle.cjs');
const fixtureRoot = path.resolve(__dirname, '..', '.test-tmp');
fs.mkdirSync(fixtureRoot, { recursive: true });
const temporary = fs.mkdtempSync(path.join(fixtureRoot, 'discord-shortcuts-assistant-'));
let count = 0, number = 0;
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function test(name, fn) { fn(); count++; console.log('OK ' + name); }
function bootstrap(target) {
    const js = Buffer.from('require(' + JSON.stringify(target) + ')');
    const json = Buffer.from(JSON.stringify({ files: { 'index.js': { size: js.length, offset: '0' } } }));
    const pad = (json.length + 3) & ~3, header = Buffer.alloc(16 + pad);
    header.writeUInt32LE(4, 0); header.writeUInt32LE(8 + pad, 4); header.writeUInt32LE(4 + pad, 8); header.writeUInt32LE(json.length, 12); json.copy(header, 16);
    return Buffer.concat([header, js]);
}
function put(file, content) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); }
function fixture() {
    const base = path.join(temporary, String(number++)), source = path.join(base, 'Vencord');
    const appData = path.join(base, 'Roaming'), localAppData = path.join(base, 'Local'), packageRoot = path.join(base, 'package');
    const runtime = path.join(appData, 'Vencord/dist');
    const resources = path.join(localAppData, 'Discord/app-1.0.100/resources');
    const target = path.join(appData, 'Elgato/StreamDeck/Plugins', operations.PLUGIN);
    put(path.join(source, 'package.json'), '{"name":"vencord"}');
    put(path.join(source, 'src/utils/types.ts'), 'types');
    put(path.join(source, 'scripts/runInstaller.mjs'), 'official installer');
    put(path.join(source, 'src/userplugins/shortcutToggle/index.tsx'), 'name: "ShortcutToggle"');
    put(path.join(source, 'src/userplugins/otherPlugin/index.tsx'), 'other user plugin');
    put(path.join(packageRoot, 'shortcutToggle/index.tsx'), 'name: "ShortcutToggle"');
    put(path.join(resources, 'app.asar'), bootstrap(path.join(runtime, 'patcher.js')));
    put(path.join(path.dirname(resources), 'Discord.exe'), 'application');
    for (const name of ['patcher.js', 'preload.js', 'renderer.js', 'renderer.css']) {
        put(path.join(source, 'dist', name), 'ShortcutToggle original ' + name);
        put(path.join(runtime, name), 'ShortcutToggle original ' + name);
    }
    const files = { 'manifest.json': JSON.stringify({ UUID: operations.UUID, Version: '0.4.0.0' }), 'bin/plugin.js': 'companion runtime', 'ui/settings.html': 'inspector' };
    const manifest = { uuid: operations.UUID, version: '0.4.0.0', files: [] };
    for (const [file, content] of Object.entries(files)) {
        put(path.join(packageRoot, 'payload', operations.PLUGIN, file), content);
        put(path.join(target, file), content);
        manifest.files.push({ path: file, sha256: hash(content) });
    }
    put(path.join(packageRoot, 'installer/payload-manifest.json'), JSON.stringify(manifest));
    put(path.join(appData, 'Elgato/StreamDeck/ProfilesV2/keep.json'), 'all user profiles');
    const context = { source, appData, localAppData, packageRoot, confirmed: true, ensureClosed: () => {},
        execute: command => {
            if (command === 'pnpm.cmd build') for (const name of ['patcher.js', 'preload.js', 'renderer.js', 'renderer.css'])
                put(path.join(source, 'dist', name), (fs.existsSync(path.join(source, 'src/userplugins/shortcutToggle')) ? 'ShortcutToggle' : 'without connector') + ' otherPlugin ' + name);
        } };
    return { context, base, runtime, resources, target, manifest };
}
try {
    test('payload hash detects damaged files before installation', () => {
        const f = fixture(); put(path.join(f.context.packageRoot, 'payload', operations.PLUGIN, 'bin/plugin.js'), 'corrupted');
        assert.throws(() => operations.payload(f.context), /endommage/);
    });
    test('payload rejects traversal and additional files', () => {
        const f = fixture(); f.manifest.files.push({ path: '../outside', sha256: 'a'.repeat(64) });
        put(path.join(f.context.packageRoot, 'installer/payload-manifest.json'), JSON.stringify(f.manifest));
        assert.throws(() => operations.payload(f.context), /invalide/);
        const g = fixture(); put(path.join(g.context.packageRoot, 'payload', operations.PLUGIN, 'extra'), 'unexpected');
        assert.throws(() => operations.payload(g.context), /inattendu/);
    });
    test('destination guard rejects the parent itself and outside paths', () => {
        assert.throws(() => operations.inside(temporary, temporary));
        assert.throws(() => operations.inside(temporary, path.dirname(temporary)));
    });
    test('removed Stream Deck-only action is rejected before changing files', () => {
        const f = fixture(); f.context.execute = () => { throw new Error('unexpected build'); };
        assert.throws(() => operations.executeAction(f.context, 'install-streamdeck'), /inconnue/);
        assert.throws(() => lifecycle.executeManagedAction(f.context, 'install-streamdeck'), /inconnue/);
        assert.equal(fs.readFileSync(path.join(f.runtime, 'renderer.js'), 'utf8'), 'ShortcutToggle original renderer.js');
    });
    test('Stream Deck replacement saves the old plugin and preserves profiles', () => {
        const f = fixture(); put(path.join(f.target, 'bin/plugin.js'), 'old');
        const result = operations.installStreamDeck(f.context);
        assert.equal(fs.readFileSync(path.join(result.backup, operations.PLUGIN, 'bin/plugin.js'), 'utf8'), 'old');
        assert.equal(fs.readFileSync(path.join(f.context.appData, 'Elgato/StreamDeck/ProfilesV2/keep.json'), 'utf8'), 'all user profiles');
    });
    test('refuses another plugin identity in the target folder', () => {
        const f = fixture(); put(path.join(f.target, 'manifest.json'), '{"UUID":"another.plugin"}');
        assert.throws(() => operations.installStreamDeck(f.context), /autre plugin/);
    });
    test('repair replaces a damaged own manifest after preserving its previous files', () => {
        const f = fixture(); put(path.join(f.target, 'manifest.json'), '{broken');
        const result = operations.installStreamDeck(f.context);
        assert.equal(fs.readFileSync(path.join(result.backup, operations.PLUGIN, 'manifest.json'), 'utf8'), '{broken');
        assert.equal(JSON.parse(fs.readFileSync(path.join(f.target, 'manifest.json'), 'utf8')).UUID, operations.UUID);
    });
    test('installation stops if Stream Deck is running', () => {
        const f = fixture(); put(path.join(f.target, 'bin/plugin.js'), 'old');
        f.context.ensureClosed = () => { throw new Error('still running'); };
        assert.throws(() => operations.installStreamDeck(f.context), /still running/);
        assert.equal(fs.readFileSync(path.join(f.target, 'bin/plugin.js'), 'utf8'), 'old');
    });
    test('failed Stream Deck replacement restores the previous plugin folder', () => {
        const f = fixture(); put(path.join(f.target, 'bin/plugin.js'), 'old runtime');
        const rename = fs.renameSync;
        fs.renameSync = (from, to) => {
            if (path.basename(from).startsWith('.discord-shortcuts-preparation-') && to === f.target) throw new Error('placement failed');
            return rename(from, to);
        };
        try { assert.throws(() => operations.installStreamDeck(f.context), /placement failed/); }
        finally { fs.renameSync = rename; }
        assert.equal(fs.readFileSync(path.join(f.target, 'bin/plugin.js'), 'utf8'), 'old runtime');
    });
    test('uninstallation requires explicit confirmation', () => {
        const f = fixture(); f.context.confirmed = false;
        assert.throws(() => operations.uninstall(f.context), /confirmation/);
        assert(fs.existsSync(f.target));
    });
    test('uninstallation removes both components and keeps other plugins and profiles', () => {
        const f = fixture(); operations.uninstall(f.context);
        assert.equal(fs.existsSync(f.target), false);
        assert.equal(fs.existsSync(path.join(f.context.source, 'src/userplugins/shortcutToggle')), false);
        assert(!fs.readFileSync(path.join(f.runtime, 'renderer.js'), 'utf8').includes('ShortcutToggle'));
        assert.equal(fs.readFileSync(path.join(f.context.source, 'src/userplugins/otherPlugin/index.tsx'), 'utf8'), 'other user plugin');
        assert.equal(fs.readFileSync(path.join(f.context.appData, 'Elgato/StreamDeck/ProfilesV2/keep.json'), 'utf8'), 'all user profiles');
    });
    test('uninstallation is safe to repeat without rebuilding a removed connector', () => {
        const f = fixture(); operations.uninstall(f.context);
        f.context.execute = () => { throw new Error('must not build twice'); };
        operations.uninstall(f.context);
    });
    test('uninstallation still removes a compiled connector when its source file is missing', () => {
        const f = fixture(); fs.unlinkSync(path.join(f.context.source, 'src/userplugins/shortcutToggle/index.tsx'));
        operations.uninstall(f.context);
        assert(!fs.readFileSync(path.join(f.runtime, 'renderer.js'), 'utf8').includes('ShortcutToggle'));
        assert.equal(fs.existsSync(f.target), false);
    });
    test('failed uninstallation build restores source and compiled files', () => {
        const f = fixture(); f.context.execute = command => {
            if (command === 'pnpm.cmd build') { put(path.join(f.context.source, 'dist/renderer.js'), 'failed output'); throw new Error('build failed'); }
        };
        assert.throws(() => operations.uninstall(f.context), /build failed/);
        assert(fs.existsSync(path.join(f.context.source, 'src/userplugins/shortcutToggle/index.tsx')));
        assert.equal(fs.readFileSync(path.join(f.context.source, 'dist/renderer.js'), 'utf8'), 'ShortcutToggle original renderer.js');
        assert.equal(fs.readFileSync(path.join(f.runtime, 'renderer.js'), 'utf8'), 'ShortcutToggle original renderer.js');
        assert(fs.existsSync(f.target));
    });
    test('a build that still contains the connector cannot be called uninstalled', () => {
        const f = fixture(); f.context.execute = () => {};
        assert.throws(() => operations.uninstall(f.context), /encore ShortcutToggle/);
        assert(fs.existsSync(f.target)); assert(fs.existsSync(path.join(f.context.source, 'src/userplugins/shortcutToggle/index.tsx')));
    });
    test('Stream Deck removal failure restores the connector and active runtime', () => {
        const f = fixture(); const rename = fs.renameSync;
        fs.renameSync = (from, to) => { if (from === f.target) throw new Error('plugin folder locked'); return rename(from, to); };
        try { assert.throws(() => operations.uninstall(f.context), /plugin folder locked/); }
        finally { fs.renameSync = rename; }
        assert.equal(fs.readFileSync(path.join(f.runtime, 'renderer.js'), 'utf8'), 'ShortcutToggle original renderer.js');
        assert(fs.existsSync(path.join(f.context.source, 'src/userplugins/shortcutToggle/index.tsx')));
        assert(fs.existsSync(f.target));
    });
    test('uninstall handles a runtime loaded directly from the sources', () => {
        const f = fixture(); put(path.join(f.resources, 'app.asar'), bootstrap(path.join(f.context.source, 'dist/patcher.js')));
        operations.uninstall(f.context);
        assert(!fs.readFileSync(path.join(f.context.source, 'dist/renderer.js'), 'utf8').includes('ShortcutToggle'));
        assert(fs.readFileSync(path.join(f.context.source, 'dist/renderer.js'), 'utf8').includes('otherPlugin'));
    });
    test('refuses uninstallation if the source folder belongs to another plugin', () => {
        const f = fixture(); put(path.join(f.context.source, 'src/userplugins/shortcutToggle/index.tsx'), 'a different plugin');
        assert.throws(() => operations.uninstall(f.context), /attendu/);
        assert(fs.existsSync(f.target));
    });
    test('unknown active Vencord installation is refused before removing Stream Deck', () => {
        const f = fixture(); put(path.join(f.resources, 'app.asar'), bootstrap(path.join(f.base, 'unknown/dist/patcher.js')));
        assert.throws(() => operations.uninstall(f.context), /autre installation/);
        assert(fs.existsSync(f.target));
    });
    test('read-only verification never calls build or modifies files', () => {
        const f = fixture(); f.context.execute = () => { throw new Error('unexpected command'); };
        assert.equal(operations.inspect(f.context), true);
        assert(fs.existsSync(path.join(f.context.source, 'src/userplugins/shortcutToggle/index.tsx')));
    });
    test('unknown action is rejected', () => {
        assert.throws(() => operations.executeAction(fixture().context, 'remove-everything'), /inconnue/);
    });
    test('install-all and repair both use the connector build and verify the companion', () => {
        for (const action of ['install-all', 'repair']) {
            const f = fixture(); put(path.join(f.target, 'bin/plugin.js'), 'bad companion');
            const result = operations.executeAction(f.context, action);
            assert(result.includes('Installation terminee'));
            assert(fs.readFileSync(path.join(f.runtime, 'renderer.js'), 'utf8').includes('ShortcutToggle'));
            assert.equal(fs.readFileSync(path.join(f.target, 'bin/plugin.js'), 'utf8'), 'companion runtime');
        }
    });
    test('managed install, repair and uninstall close before mutation and restart after verification', () => {
        for (const action of ['install-all', 'repair', 'uninstall']) {
            const f = fixture(), events = []; let running = true;
            f.context.ensureClosed = () => { assert.equal(running, false); };
            const apps = { prepare: () => events.push('prepare'), stop: () => { events.push('stop'); running = false; }, start: () => {
                events.push('start');
                assert.equal(fs.readFileSync(path.join(f.runtime, 'renderer.js'), 'utf8').includes('ShortcutToggle'), action !== 'uninstall');
                assert.equal(fs.existsSync(f.target), action !== 'uninstall');
                running = true;
            } };
            const result = lifecycle.executeManagedAction(f.context, action, apps);
            assert.deepEqual(events, ['prepare','stop','start']); assert.equal(running, true); assert(result.includes('ont ete relances'));
        }
    });
    test('read-only managed verification never stops or starts applications', () => {
        const f = fixture();
        const never = () => { throw new Error('unexpected lifecycle call'); };
        assert(lifecycle.executeManagedAction(f.context, 'check', { prepare: never, stop: never, start: never }).includes('conformes'));
    });
    test('corrupt payload and unconfirmed uninstall cannot interrupt applications', () => {
        const f = fixture(); const never = () => { throw new Error('unexpected lifecycle call'); };
        const apps = { prepare:never,stop:never,start:never };
        put(path.join(f.context.packageRoot,'payload',operations.PLUGIN,'bin/plugin.js'),'corrupted');
        assert.throws(() => lifecycle.executeManagedAction(f.context,'install-all',apps),/endommage/);
        f.context.confirmed = false;
        assert.throws(() => lifecycle.executeManagedAction(f.context,'uninstall',apps),/confirmation/);
    });
    test('a failed build still restarts both applications and keeps the active files', () => {
        const f = fixture(), events = [];
        f.context.execute = command => { if(command === 'pnpm.cmd build')throw new Error('build failed'); };
        const apps = { prepare:()=>events.push('prepare'),stop:()=>events.push('stop'),start:()=>events.push('start') };
        assert.throws(()=>lifecycle.executeManagedAction(f.context,'repair',apps),/build failed/);
        assert.deepEqual(events,['prepare','stop','start']);
        assert.equal(fs.readFileSync(path.join(f.runtime,'renderer.js'),'utf8'),'ShortcutToggle original renderer.js');
    });
    test('failed discovery does not close or restart any application', () => {
        const calls=[];
        assert.throws(()=>lifecycle.withApplications({prepare:()=>{throw Error('discovery failed');},stop:()=>calls.push('stop'),start:()=>calls.push('start')},()=>calls.push('operation')),/discovery failed/);
        assert.deepEqual(calls,[]);
    });
    test('a partial close failure triggers reopening without changing files', () => {
        const calls=[];
        assert.throws(()=>lifecycle.withApplications({prepare:()=>{},stop:()=>{throw Error('stop failed');},start:()=>calls.push('start')},()=>calls.push('operation')),/stop failed/);
        assert.deepEqual(calls,['start']);
    });
    test('reopening failure is not reported as a successful installation', () => {
        const calls=[];
        assert.throws(()=>lifecycle.withApplications({prepare:()=>{},stop:()=>{},start:()=>{throw Error('start failed');}},()=>{calls.push('operation');return 'installed';}),/fichiers ont ete traites.*start failed/);
        assert.deepEqual(calls,['operation']);
    });
    test('an operation error and a restart error are both retained', () => {
        assert.throws(()=>lifecycle.withApplications({prepare:()=>{},stop:()=>{},start:()=>{throw Error('start failed');}},()=>{throw Error('build failed');}),error=>error.message.includes('build failed')&&error.message.includes('start failed'));
    });
    console.log('\n' + count + ' assistant checks passed.');
} finally {
    if (path.dirname(temporary) === fixtureRoot && path.basename(temporary).startsWith('discord-shortcuts-assistant-')) fs.rmSync(temporary, { recursive: true, force: true });
}
