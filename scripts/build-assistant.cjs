// SPDX-License-Identifier: GPL-3.0-or-later
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const output = path.resolve(process.argv[2] || path.join(root, 'releases', 'DiscordShortcuts-Assistant'));
const plugin = 'fr.ethan.discord-shortcuts.sdPlugin';
const windows = process.env.SystemRoot || 'C:\\Windows';
const compiler = path.join(windows, 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe');
if (!fs.existsSync(compiler)) throw new Error('Le compilateur .NET Framework de Windows est introuvable.');
fs.mkdirSync(output, { recursive: true });
function copy(relative, destination = relative) {
    const target = path.join(output, destination);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(root, relative), target);
}
for (const file of ['scripts/installer-connecteur.cjs', 'scripts/launcher-runner.cjs', 'installer/operations.cjs', 'installer/application-lifecycle.cjs', 'shortcutToggle/index.tsx', 'LICENSE']) copy(file);
copy('installer/LIRE-MOI.md', 'LIRE-MOI.md');
copy('releases/fr.ethan.discord-shortcuts.streamDeckPlugin', 'fr.ethan.discord-shortcuts.streamDeckPlugin');
const manifest = { uuid: 'fr.ethan.discord-shortcuts', version: '0.4.0.0', files: [] };
const sourcePlugin = path.join(root, 'stream-deck', plugin);
function collect(relative = '') {
    for (const entry of fs.readdirSync(path.join(sourcePlugin, relative), { withFileTypes: true })) {
        const file = path.join(relative, entry.name);
        if (entry.name === 'logs') continue;
        if (entry.isSymbolicLink()) throw new Error('Le paquet source contient un lien : ' + file);
        if (entry.isDirectory()) collect(file);
        else {
            const bytes = fs.readFileSync(path.join(sourcePlugin, file));
            manifest.files.push({ path: file.split(path.sep).join('/'), sha256: crypto.createHash('sha256').update(bytes).digest('hex') });
            copy(path.join('stream-deck', plugin, file), path.join('payload', plugin, file));
        }
    }
}
collect();
if (!manifest.files.some(item => item.path === 'bin/plugin.js')) throw new Error('Compile le plugin Stream Deck avant de produire cet assistant.');
manifest.files.sort((a, b) => a.path.localeCompare(b.path));
fs.writeFileSync(path.join(output, 'installer', 'payload-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
const result = cp.spawnSync(compiler, ['/nologo', '/target:winexe', '/platform:anycpu', '/optimize+', '/codepage:65001', '/utf8output',
    '/reference:System.Windows.Forms.dll', '/reference:System.Drawing.dll', '/reference:System.Web.Extensions.dll',
    '/out:' + path.join(output, 'DiscordShortcuts-Assistant.exe'), path.join(root, 'installer', 'Assistant.cs')], { encoding: 'utf8' });
process.stdout.write(result.stdout || ''); process.stderr.write(result.stderr || '');
if (result.error || result.status !== 0) throw result.error || new Error('Compilation Windows echouee.');
const helper = cp.spawnSync(compiler, ['/nologo', '/target:exe', '/platform:anycpu', '/optimize+', '/codepage:65001', '/utf8output',
    '/reference:System.Web.Extensions.dll', '/out:' + path.join(output, 'installer', 'ApplicationControl.exe'), path.join(root, 'installer', 'ApplicationControl.cs')], { encoding: 'utf8' });
process.stdout.write(helper.stdout || ''); process.stderr.write(helper.stderr || '');
if (helper.error || helper.status !== 0) throw helper.error || new Error('Compilation du gestionnaire des applications echouee.');
const validation = require('../installer/operations.cjs').payload({ packageRoot: output });
console.log('Assistant Windows compile. ' + validation.manifest.files.length + ' fichiers Stream Deck verifies.');
console.log(output);
