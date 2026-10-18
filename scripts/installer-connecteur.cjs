// SPDX-License-Identifier: GPL-3.0-or-later
// Windows / Discord Stable only. No account, session or Discord settings files are read.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const readline = require('node:readline/promises');

const REQUIRED = ['patcher.js', 'preload.js', 'renderer.js', 'renderer.css'];
const OPTIONAL = ['patcher.js.LEGAL.txt', 'patcher.js.map', 'preload.js.map',
    'renderer.css.map', 'renderer.js.LEGAL.txt', 'renderer.js.map'];
const VENCORD_REPO = 'https://github.com/Vendicated/Vencord.git';
const fail = message => { throw new Error(message); };
const samePath = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function sourceIsValid(source) {
    try {
        const pkg = JSON.parse(fs.readFileSync(path.join(source, 'package.json'), 'utf8'));
        return pkg.name === 'vencord' && ['src/utils/types.ts', 'scripts/runInstaller.mjs']
            .every(file => fs.statSync(path.join(source, file)).isFile());
    } catch { return false; }
}

// Only read the small Vencord bootstrap archive, never the original Discord archive.
function bootstrapTarget(buffer) {
    if (buffer.length < 16 || buffer.length > 65536) return null;
    try {
        if (buffer.readUInt32LE(0) !== 4) return null;
        const headerSize = buffer.readUInt32LE(4);
        const jsonLength = buffer.readUInt32LE(12);
        if (headerSize < 8 || 16 + jsonLength > 8 + headerSize || 8 + headerSize > buffer.length) return null;
        const header = JSON.parse(buffer.subarray(16, 16 + jsonLength).toString('utf8'));
        const entry = header.files?.['index.js'];
        if (!entry || entry.unpacked || entry.link || !/^\d+$/.test(String(entry.offset))) return null;
        const size = entry.size, start = 8 + headerSize + Number(entry.offset);
        if (!Number.isSafeInteger(size) || size < 1 || !Number.isSafeInteger(start) || start < 8 + headerSize || start + size > buffer.length) return null;
        const js = buffer.subarray(start, start + size).toString('utf8');
        const match = /^\s*require\(\s*("(?:[^"\\]|\\.)*")\s*\)\s*;?\s*$/.exec(js);
        if (!match) return null;
        const target = JSON.parse(match[1]);
        if (!path.win32.isAbsolute(target) || path.win32.basename(target).toLowerCase() !== 'patcher.js') return null;
        return target;
    } catch { return null; }
}

function readBootstrap(resources) {
    const file = path.join(resources, 'app.asar');
    if (!fs.existsSync(file) || fs.statSync(file).size > 65536) return null;
    return bootstrapTarget(fs.readFileSync(file));
}

function findDiscord(localAppData) {
    const root = path.join(localAppData, 'Discord');
    if (!fs.existsSync(root)) fail('Discord officiel Stable est introuvable. Installez-le depuis discord.com.');
    const candidates = fs.readdirSync(root, { withFileTypes: true })
        .filter(e => e.isDirectory() && /^app-\d+(?:\.\d+)+$/.test(e.name))
        .map(e => ({ name: e.name, version: e.name.slice(4).split('.').map(Number) }))
        .sort((a, b) => {
            for (let i = 0; i < Math.max(a.version.length, b.version.length); i++) {
                const delta = (b.version[i] || 0) - (a.version[i] || 0);
                if (delta) return delta;
            }
            return 0;
        });
    const app = candidates.find(e => fs.existsSync(path.join(root, e.name, 'Discord.exe')) &&
        fs.existsSync(path.join(root, e.name, 'resources', 'app.asar')));
    if (!app) fail('Aucune installation Discord Stable complete trouvee.');
    return path.join(root, app.name, 'resources');
}

function resolveRuntime(source, appData, target) {
    if (!target) return null;
    const runtime = path.dirname(target);
    const allowed = [path.join(source, 'dist'), path.join(appData, 'Vencord', 'dist')];
    if (!allowed.some(dir => samePath(runtime, dir))) {
        fail('Discord utilise une autre installation Vencord : ' + runtime +
            '\nRelancez cet outil en choisissant les sources de cette installation. Aucun fichier actif modifie.');
    }
    // Do not follow a link to an unrelated destination when copying compiled files.
    if (fs.existsSync(runtime) && !samePath(fs.realpathSync(runtime), runtime)) {
        fail('Le dossier Vencord actif est un lien vers un autre emplacement. Aucun fichier actif modifie.');
    }
    return runtime;
}

function verifyBuild(source) {
    const dist = path.join(source, 'dist');
    for (const name of REQUIRED) {
        const file = path.join(dist, name);
        if (!fs.existsSync(file) || !fs.statSync(file).isFile() || fs.statSync(file).size === 0)
            fail('Compilation incomplete : ' + name + '. Aucun fichier actif copie.');
    }
    if (!fs.readFileSync(path.join(dist, 'renderer.js'), 'utf8').includes('ShortcutToggle'))
        fail('La compilation ne contient pas ShortcutToggle. Aucun fichier actif copie.');
}

function backupDirectory(source) {
    const root = path.join(source, '.discord-shortcuts-backups');
    if (fs.existsSync(root) && fs.lstatSync(root).isSymbolicLink())
        fail('Le dossier de sauvegarde est un lien. Installation annulee.');
    fs.mkdirSync(root, { recursive: true });
    return fs.mkdtempSync(path.join(root, 'installation-'));
}

function applyBuild(source, runtime, backup) {
    verifyBuild(source);
    if (!samePath(path.join(source, 'dist'), runtime)) {
        const files = [...REQUIRED, ...OPTIONAL].filter(name => fs.existsSync(path.join(source, 'dist', name)));
        for (const name of files) {
            const destination = path.join(runtime, name);
            if (fs.existsSync(destination) && fs.lstatSync(destination).isSymbolicLink())
                fail('Fichier actif redirige : ' + name + '. Copie annulee.');
        }
        const saved = path.join(backup, 'runtime');
        fs.mkdirSync(saved);
        fs.mkdirSync(runtime, { recursive: true });
        const previous = new Set();
        for (const name of files) if (fs.existsSync(path.join(runtime, name))) {
            fs.copyFileSync(path.join(runtime, name), path.join(saved, name));
            previous.add(name);
        }
        const written = [];
        try {
            for (const name of files) {
                written.push(name);
                fs.copyFileSync(path.join(source, 'dist', name), path.join(runtime, name));
                if (sha(path.join(source, 'dist', name)) !== sha(path.join(runtime, name)))
                    fail('Verification de la copie echouee : ' + name);
            }
        } catch (error) {
            for (const name of written.reverse()) {
                if (previous.has(name)) fs.copyFileSync(path.join(saved, name), path.join(runtime, name));
                else fs.unlinkSync(path.join(runtime, name));
            }
            throw error;
        }
    }
    if (!fs.readFileSync(path.join(runtime, 'renderer.js'), 'utf8').includes('ShortcutToggle'))
        fail('Le connecteur est absent de la copie active.');
}

function run(command, args, options = {}) {
    const result = cp.spawnSync(command, args, { stdio: 'inherit', ...options });
    if (result.error || result.status !== 0)
        fail('Etape echouee : ' + command + ' ' + args.join(' ') + '. Consultez le message ci-dessus.');
}

function pnpm(command, source, execute = run) {
    // Only fixed commands below reach the shell. The user-selected path is passed as cwd.
    if (!['--version', 'install --frozen-lockfile', 'build'].includes(command))
        fail('Commande pnpm non autorisee.');
    execute('pnpm.cmd ' + command, [], { cwd: source, shell: true });
}

function check(source, appData, resources) {
    if (!sourceIsValid(source)) fail('Ce dossier ne contient pas les sources de Vencord.');
    verifyBuild(source);
    const runtime = resolveRuntime(source, appData, readBootstrap(resources));
    if (!runtime) fail('La compilation personnalisee de Vencord n\'est pas encore installee dans Discord.');
    const current = fs.existsSync(path.join(runtime, 'renderer.js')) &&
        fs.readFileSync(path.join(runtime, 'renderer.js'), 'utf8').includes('ShortcutToggle');
    console.log('Sources Vencord : ' + source);
    console.log('Copie chargee par Discord : ' + runtime);
    if (!current) fail('ShortcutToggle est absent de la copie chargee par Discord. Lancez Installer-Connecteur.cmd.');
    const identical = REQUIRED.every(name => fs.existsSync(path.join(runtime, name)) &&
        sha(path.join(source, 'dist', name)) === sha(path.join(runtime, name)));
    if (!identical) fail('La copie chargee differe de la compilation. Lancez Installer-Connecteur.cmd.');
    console.log('Verification reussie : les fichiers actifs correspondent a la compilation contenant ShortcutToggle.');
    console.log('Ce controle verifie les fichiers, pas la connexion en cours dans Discord.');
    return runtime;
}

function install({ source, appData, resources, bundledConnector, execute = run, ensureClosed = () => {} }) {
    if (!sourceIsValid(source)) fail('Le dossier choisi ne contient pas les sources de Vencord.');
    // Refuse an unknown existing injection before changing the source or running a build.
    const previousRuntime = resolveRuntime(source, appData, readBootstrap(resources));
    const connectorText = fs.readFileSync(bundledConnector, 'utf8');
    if (!connectorText.includes('name: "ShortcutToggle"')) fail('Connecteur fourni invalide.');
    const backup = backupDirectory(source);
    const connector = path.join(source, 'src', 'userplugins', 'shortcutToggle', 'index.tsx');
    for (const part of ['src', 'src/userplugins', 'src/userplugins/shortcutToggle', 'src/userplugins/shortcutToggle/index.tsx']) {
        const entry = path.join(source, part);
        if (fs.existsSync(entry) && fs.lstatSync(entry).isSymbolicLink())
            fail('Le chemin du connecteur contient un lien. Installation annulee.');
    }
    if (fs.existsSync(connector)) fs.copyFileSync(connector, path.join(backup, 'index.tsx'));
    fs.mkdirSync(path.dirname(connector), { recursive: true });
    fs.copyFileSync(bundledConnector, connector);
    const buildFiles = [...REQUIRED, ...OPTIONAL];
    const sourceActive = previousRuntime && samePath(previousRuntime, path.join(source, 'dist'));
    const beforeBuild = path.join(backup, 'before-build');
    if (sourceActive) {
        fs.mkdirSync(beforeBuild);
        for (const file of buildFiles) if (fs.existsSync(path.join(source, 'dist', file)))
            fs.copyFileSync(path.join(source, 'dist', file), path.join(beforeBuild, file));
    }
    ensureClosed();
    try {
        console.log('Installation des dependances de compilation...');
        pnpm('install --frozen-lockfile', source, execute);
        console.log('Compilation de Vencord avec ShortcutToggle...');
        pnpm('build', source, execute);
        verifyBuild(source);
    } catch (error) {
        if (sourceActive) for (const file of buildFiles) {
            const old = path.join(beforeBuild, file), current = path.join(source, 'dist', file);
            if (fs.existsSync(old)) fs.copyFileSync(old, current);
            else if (fs.existsSync(current)) fs.unlinkSync(current);
        }
        throw error;
    }
    ensureClosed();
    let runtime = resolveRuntime(source, appData, readBootstrap(resources));
    if (!runtime) {
        console.log('Installation de cette compilation dans Discord avec l\'installateur officiel Vencord...');
        execute(process.execPath, [path.join(source, 'scripts', 'runInstaller.mjs'), '--', '-install', '-branch', 'stable'], { cwd: source });
        runtime = resolveRuntime(source, appData, readBootstrap(resources));
        if (!runtime) fail('L\'installateur Vencord n\'a pas relie Discord a cette compilation. Aucun succes annonce.');
    }
    applyBuild(source, runtime, backup);
    check(source, appData, resources);
    console.log('\nInstallation terminee. Sauvegarde : ' + backup);
    console.log('Relancez Discord et activez ShortcutToggle dans Parametres > Vencord > Plugins.');
    console.log('Installez ensuite le fichier .streamDeckPlugin et ajoutez son action dans Stream Deck.');
    return { runtime, backup };
}

function discordIsRunning() {
    const result = cp.spawnSync('tasklist.exe', ['/FI', 'IMAGENAME eq Discord.exe', '/FO', 'CSV', '/NH'], { encoding: 'utf8', windowsHide: true });
    if (result.error || result.status !== 0) fail('Impossible de verifier si Discord est ferme. Installation annulee.');
    return /^"Discord\.exe"/im.test(result.stdout);
}

async function main(args) {
    if (process.platform !== 'win32') fail('Cet outil est reserve a Discord officiel Stable sous Windows.');
    if (Number(process.versions.node.split('.')[0]) < 22) fail('Installez Node.js 22 ou une version LTS plus recente depuis nodejs.org.');
    const parsed = parseArguments(args);
    const checkOnly = parsed.checkOnly;
    if (!process.env.APPDATA || !process.env.LOCALAPPDATA) fail('Les dossiers Windows APPDATA et LOCALAPPDATA sont introuvables.');
    const resources = findDiscord(process.env.LOCALAPPDATA);
    let source = parsed.source || path.join(os.homedir(), 'Documents', 'Vencord');
    if (checkOnly) return check(path.resolve(source), process.env.APPDATA, resources);
    const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
        console.log('Discord Shortcuts - Installer ou mettre a jour le connecteur');
        console.log('Discord officiel Stable, Git, Node.js et pnpm sont requis. Vencord reste necessaire.');
        console.log('Cet outil installe/compile Vencord et applique le connecteur a la copie utilisee par Discord.');
        console.log('Il ne ferme pas Discord et ne touche pas a vos fichiers de session.');
        console.log('Fermez Discord depuis son icone pres de l\'horloge avant de continuer.');
        const answer = (await prompt.question('Dossier des sources Vencord [' + source + '] (Entree pour accepter) : ')).trim();
        if (answer) source = answer.replace(/^"(.*)"$/, '$1');
        source = path.resolve(source);
        if (discordIsRunning()) fail('Discord est encore ouvert. Quittez-le depuis son icone pres de l\'horloge, puis relancez cet outil.');
        run('git', ['--version']);
        pnpm('--version', fs.existsSync(source) ? source : os.homedir());
        if (!fs.existsSync(source)) {
            console.log('Telechargement des sources officielles de Vencord dans : ' + source);
            fs.mkdirSync(path.dirname(source), { recursive: true });
            run('git', ['clone', VENCORD_REPO, source]);
        }
        if (!sourceIsValid(source)) fail('Ce dossier existe mais ne contient pas les sources de Vencord. Il n\'a pas ete remplace.');
        source = fs.realpathSync(source);
        install({ source, appData: process.env.APPDATA, resources,
            bundledConnector: path.join(__dirname, '..', 'shortcutToggle', 'index.tsx'),
            ensureClosed: () => { if (discordIsRunning()) fail('Discord a ete relance pendant la preparation. Quittez-le, puis relancez cet outil.'); } });
    } finally { prompt.close(); }
}

function parseArguments(args) {
    const result = { checkOnly: false, source: null };
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--check' && !result.checkOnly) result.checkOnly = true;
        else if (args[i] === '--vencord' && !result.source && args[i + 1] && !args[i + 1].startsWith('--')) result.source = args[++i];
        else fail('Arguments : --check et/ou --vencord "chemin".');
    }
    return result;
}

module.exports = { bootstrapTarget, readBootstrap, findDiscord, resolveRuntime, sourceIsValid,
    verifyBuild, applyBuild, install, check, pnpm, parseArguments };
if (require.main === module) main(process.argv.slice(2)).catch(error => {
    console.error('\nECHEC : ' + error.message);
    console.error('Aucune connexion Discord n\'est demandee. Aide : https://github.com/Sheixo/DiscordShortcuts/blob/main/docs/INSTALLATION.fr.md');
    process.exitCode = 1;
});
