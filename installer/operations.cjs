// SPDX-License-Identifier: GPL-3.0-or-later
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const core = require('../scripts/installer-connecteur.cjs');
const UUID = 'fr.ethan.discord-shortcuts';
const PLUGIN = UUID + '.sdPlugin';
const same = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const fail = message => { throw new Error(message); };
const exists = file => { try { fs.lstatSync(file); return true; } catch (e) { if (e.code === 'ENOENT') return false; throw e; } };

function inside(parent, target) {
    const relative = path.relative(path.resolve(parent), path.resolve(target));
    if (!relative || relative.startsWith('..' + path.sep) || relative === '..' || path.isAbsolute(relative))
        fail('Emplacement hors du dossier prevu. Operation annulee.');
    return path.resolve(target);
}

function listFiles(root, relative = '') {
    const result = [];
    for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
        const file = path.join(relative, entry.name);
        if (entry.isSymbolicLink()) fail('Le paquet contient un lien : ' + file);
        if (entry.isDirectory()) result.push(...listFiles(root, file));
        else if (entry.isFile()) result.push(file);
        else fail('Type de fichier non pris en charge : ' + file);
    }
    return result;
}

function payload(context) {
    const root = path.join(context.packageRoot, 'payload', PLUGIN);
    const manifestPath = path.join(context.packageRoot, 'installer', 'payload-manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (manifest.uuid !== UUID || !Array.isArray(manifest.files) || !manifest.files.length) fail('Paquet Stream Deck invalide.');
    const seen = new Set();
    for (const item of manifest.files) {
        if (!item || typeof item.path !== 'string' || !item.path || item.path.includes(':') || item.path.includes('\\') ||
            item.path.split('/').some(part => !part || part === '..' || part === '.') || !/^[a-f0-9]{64}$/.test(item.sha256) || seen.has(item.path))
            fail('Liste des fichiers du paquet invalide.');
        seen.add(item.path);
        const file = inside(root, path.join(root, item.path));
        if (!exists(file) || digest(file) !== item.sha256) fail('Fichier du paquet absent ou endommage : ' + item.path);
    }
    const actualFiles = listFiles(root).map(file => file.split(path.sep).join('/'));
    if (actualFiles.length !== seen.size || actualFiles.some(file => !seen.has(file))) fail('Contenu inattendu dans le paquet Stream Deck.');
    const plugin = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
    if (plugin.UUID !== UUID || plugin.Version !== manifest.version || !seen.has('bin/plugin.js')) fail('Identite du plugin Stream Deck invalide.');
    return { root, manifest };
}

function streamDeckLocation(context) {
    const application = path.resolve(context.appData, 'Elgato', 'StreamDeck');
    const plugins = path.join(application, 'Plugins');
    const target = inside(plugins, path.join(plugins, PLUGIN));
    if (exists(application) && !same(fs.realpathSync(application), application)) fail('Le dossier Stream Deck est redirige. Utilise sa desinstallation officielle.');
    if (exists(plugins) && !same(fs.realpathSync(plugins), plugins)) fail('Le dossier Plugins Stream Deck est redirige. Operation annulee.');
    if (exists(target)) {
        const kind = fs.lstatSync(target);
        if (!kind.isDirectory() && !kind.isSymbolicLink()) fail('Le chemin du plugin Stream Deck n\'est pas un dossier.');
        let manifest = null;
        try { manifest = JSON.parse(fs.readFileSync(path.join(target, 'manifest.json'), 'utf8')); }
        catch (error) { if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error; }
        // An absent/broken manifest is repairable in our exact UUID directory, after backup.
        if (manifest?.UUID && manifest.UUID !== UUID) fail('Le dossier cible appartient a un autre plugin. Aucun fichier modifie.');
    }
    return { application, plugins, target };
}

function sdBackup(location, prefix) {
    const parent = inside(location.application, path.join(location.application, 'DiscordShortcutsBackups'));
    if (exists(parent) && fs.lstatSync(parent).isSymbolicLink()) fail('Dossier de sauvegarde Stream Deck redirige.');
    fs.mkdirSync(parent, { recursive: true });
    return fs.mkdtempSync(path.join(parent, prefix + '-'));
}

function streamDeckMatches(location, bundle) {
    return exists(location.target) && bundle.manifest.files.every(item => {
        const file = path.join(location.target, item.path);
        return exists(file) && digest(file) === item.sha256;
    });
}

function installStreamDeck(context) {
    const bundle = payload(context), location = streamDeckLocation(context);
    if (!exists(location.application)) fail('Installe et ouvre Stream Deck une premiere fois avant de continuer.');
    context.ensureClosed(['StreamDeck.exe']);
    if (streamDeckMatches(location, bundle)) {
        console.log('Le plugin Stream Deck correspond deja aux fichiers du paquet.');
        return { changed: false, ...location };
    }
    fs.mkdirSync(location.plugins, { recursive: true });
    const stage = fs.mkdtempSync(path.join(location.plugins, '.discord-shortcuts-preparation-'));
    const backup = sdBackup(location, 'installation');
    const saved = inside(backup, path.join(backup, PLUGIN));
    let moved = false, placed = false;
    try {
        for (const item of bundle.manifest.files) {
            const destination = inside(stage, path.join(stage, item.path));
            fs.mkdirSync(path.dirname(destination), { recursive: true });
            fs.copyFileSync(path.join(bundle.root, item.path), destination);
            if (digest(destination) !== item.sha256) fail('Echec de copie du plugin Stream Deck.');
        }
        context.ensureClosed(['StreamDeck.exe']);
        // Both moves remain within the validated Stream Deck directory, on the same volume.
        inside(location.application, location.target); inside(location.application, saved);
        if (exists(location.target)) { fs.renameSync(location.target, saved); moved = true; }
        fs.renameSync(stage, location.target); placed = true;
        if (!streamDeckMatches(location, bundle)) fail('Verification Stream Deck echouee.');
        console.log('Plugin Stream Deck installe. Sauvegarde : ' + backup);
        return { changed: true, backup, ...location };
    } catch (error) {
        if (placed && exists(location.target)) {
            const failed = inside(backup, path.join(backup, 'failed-plugin'));
            fs.renameSync(location.target, failed);
        }
        if (moved && exists(saved)) fs.renameSync(saved, location.target);
        throw error;
    } finally {
        if (exists(stage)) { inside(location.plugins, stage); fs.rmSync(stage, { recursive: true, force: true }); }
    }
}

function removeStreamDeck(context) {
    const location = streamDeckLocation(context);
    context.ensureClosed(['StreamDeck.exe']);
    if (!exists(location.target)) return { changed: false, ...location };
    const backup = sdBackup(location, 'desinstallation');
    const saved = inside(backup, path.join(backup, PLUGIN));
    inside(location.application, location.target); inside(location.application, saved);
    fs.renameSync(location.target, saved);
    if (exists(location.target)) fail('Le plugin Stream Deck est encore installe.');
    console.log('Plugin retire de Stream Deck. Sauvegarde : ' + backup);
    return { changed: true, saved, backup, ...location };
}

function snapshotFiles(source, backup, label) {
    const root = inside(backup, path.join(backup, label));
    fs.mkdirSync(root);
    const names = [...core.REQUIRED, ...core.OPTIONAL];
    for (const name of names) if (exists(path.join(source, name))) {
        if (fs.lstatSync(path.join(source, name)).isSymbolicLink()) fail('Fichier de compilation redirige. Operation annulee.');
        fs.copyFileSync(path.join(source, name), path.join(root, name));
    }
    return () => {
        for (const name of names) {
            const file = inside(source, path.join(source, name));
            if (exists(path.join(root, name))) fs.copyFileSync(path.join(root, name), file);
            else if (exists(file)) fs.unlinkSync(file);
        }
    };
}

function uninstall(context) {
    if (context.confirmed !== true) fail('La confirmation de desinstallation est requise.');
    context.ensureClosed(['Discord.exe', 'StreamDeck.exe']);
    streamDeckLocation(context); // Validate ownership before changing either component.
    const source = path.resolve(context.source);
    let resources = null;
    try { resources = core.findDiscord(context.localAppData); } catch { /* Discord may already have been uninstalled. */ }
    const runtime = resources ? core.resolveRuntime(source, context.appData, core.readBootstrap(resources)) : null;
    const active = runtime && exists(path.join(runtime, 'renderer.js')) && fs.readFileSync(path.join(runtime, 'renderer.js'), 'utf8').includes('ShortcutToggle');
    const connector = inside(source, path.join(source, 'src', 'userplugins', 'shortcutToggle'));
    const hasSource = exists(connector);
    if (!active && !hasSource) {
        removeStreamDeck(context);
        console.log('Le connecteur etait deja absent.');
        return;
    }
    if (!core.sourceIsValid(source)) fail('Les sources Vencord sont necessaires pour retirer uniquement ShortcutToggle en conservant les autres plugins. Choisis le bon dossier.');
    for (const part of ['src', 'src/userplugins', 'src/userplugins/shortcutToggle']) {
        const entry = inside(source, path.join(source, part));
        if (exists(entry) && fs.lstatSync(entry).isSymbolicLink()) fail('Le chemin du connecteur est redirige. Desinstallation annulee.');
    }
    const connectorFile = path.join(connector, 'index.tsx');
    if (hasSource && exists(connectorFile)) {
        const text = fs.readFileSync(connectorFile, 'utf8');
        if (text.trim() && !text.includes('name: "ShortcutToggle"'))
            fail('Le dossier shortcutToggle ne contient pas le connecteur attendu. Desinstallation annulee.');
    }
    const backup = core.backupDirectory(source);
    const restoreBuild = snapshotFiles(path.join(source, 'dist'), backup, 'build-before-uninstall');
    const restoreRuntime = runtime && !same(runtime, path.join(source, 'dist')) ? snapshotFiles(runtime, backup, 'runtime-before-uninstall') : () => {};
    const savedConnector = inside(backup, path.join(backup, 'shortcutToggle'));
    let moved = false, sd = null;
    try {
        inside(source, connector); inside(source, savedConnector);
        if (hasSource) { fs.renameSync(connector, savedConnector); moved = true; }
        console.log('Reconstruction de Vencord sans le connecteur. Les autres plugins sont conserves.');
        core.pnpm('install --frozen-lockfile', source, context.execute);
        core.pnpm('build', source, context.execute);
        core.verifyBuild(source, false);
        context.ensureClosed(['Discord.exe', 'StreamDeck.exe']);
        if (runtime) core.applyBuild(source, runtime, backup, false);
        sd = removeStreamDeck(context);
        if (exists(connector) || (runtime && fs.readFileSync(path.join(runtime, 'renderer.js'), 'utf8').includes('ShortcutToggle')))
            fail('Le connecteur est encore present.');
        console.log('Discord Shortcuts desinstalle. Sauvegarde du connecteur : ' + backup);
        console.log('Vencord, les autres plugins, les raccourcis Discord et les profils Stream Deck sont conserves.');
    } catch (error) {
        if (sd?.changed && exists(sd.saved) && !exists(sd.target)) fs.renameSync(sd.saved, sd.target);
        restoreBuild(); restoreRuntime();
        if (moved && exists(savedConnector) && !exists(connector)) fs.renameSync(savedConnector, connector);
        throw error;
    }
}

function prepareSource(context) {
    const source = path.resolve(context.source);
    const execute = context.execute || core.run;
    if (!exists(source)) {
        fs.mkdirSync(path.dirname(source), { recursive: true });
        execute('git', ['clone', 'https://github.com/Vendicated/Vencord.git', source]);
    }
    if (!core.sourceIsValid(source)) fail('Le dossier choisi ne contient pas les sources Vencord.');
    return fs.realpathSync(source);
}

function inspect(context) {
    const lines = [];
    try {
        const resources = core.findDiscord(context.localAppData);
        core.check(context.source, context.appData, resources);
        lines.push('Connecteur : fichiers verifies.');
    } catch (error) { lines.push('Connecteur : ' + error.message); }
    try {
        const bundle = payload(context), location = streamDeckLocation(context);
        lines.push(streamDeckMatches(location, bundle) ? 'Stream Deck : fichiers verifies.' : 'Stream Deck : absent ou fichiers differents.');
    } catch (error) { lines.push('Stream Deck : ' + error.message); }
    lines.forEach(line => console.log(line));
    return lines.every(line => line.includes('fichiers verifies.'));
}

function assertClosed(names) {
    for (const name of names) {
        if (!['Discord.exe', 'StreamDeck.exe'].includes(name)) fail('Application non reconnue.');
        const result = cp.spawnSync('tasklist.exe', ['/FI', 'IMAGENAME eq ' + name, '/FO', 'CSV', '/NH'], { encoding: 'utf8', windowsHide: true });
        if (result.error || result.status !== 0) fail('Impossible de verifier la fermeture de ' + name + '.');
        const pattern = new RegExp('^"' + name.replace('.', '\\.') + '"', 'im');
        if (pattern.test(result.stdout)) fail('Ferme completement ' + name + ' depuis son icone pres de l\'horloge, puis reessaie.');
    }
}

function executeAction(context, action) {
    if (!['check', 'install-all', 'repair', 'uninstall'].includes(action)) fail('Action inconnue.');
    context = { ...context, execute: context.execute || core.run, ensureClosed: context.ensureClosed || assertClosed };
    if (action === 'check') return inspect(context) ? 'Les fichiers des deux composants sont conformes.' : 'Verification terminee : consulte les points a corriger ci-dessous.';
    if (action === 'uninstall') { uninstall(context); return 'Discord Shortcuts desinstalle.'; }
    payload(context); streamDeckLocation(context);
    context.ensureClosed(['Discord.exe', 'StreamDeck.exe']);
    {
        context.source = prepareSource(context);
        const resources = core.findDiscord(context.localAppData);
        core.install({ source: context.source, appData: context.appData, resources,
            bundledConnector: path.join(context.packageRoot, 'shortcutToggle', 'index.tsx'), execute: context.execute,
            ensureClosed: () => context.ensureClosed(['Discord.exe', 'StreamDeck.exe']), showNextSteps: false });
    }
    installStreamDeck(context);
    return 'Installation terminee. Active ShortcutToggle dans Vencord si necessaire.';
}

module.exports = { UUID, PLUGIN, inside, listFiles, payload, streamDeckLocation, installStreamDeck,
    removeStreamDeck, uninstall, inspect, executeAction, assertClosed };
