// SPDX-License-Identifier: GPL-3.0-or-later
const fs = require('node:fs');
const path = require('node:path');
const operations = require('../installer/operations.cjs');
try {
    if (process.platform !== 'win32' || Number(process.versions.node.split('.')[0]) < 22)
        throw new Error('Windows et Node.js 22 ou LTS plus recent sont requis.');
    const args = process.argv.slice(2);
    if (args.length !== 2 || args[0] !== '--job' || fs.statSync(args[1]).size > 16384) throw new Error('Demande invalide.');
    const job = JSON.parse(fs.readFileSync(args[1], 'utf8'));
    if (typeof job.source !== 'string' || !path.isAbsolute(job.source) || !process.env.APPDATA || !process.env.LOCALAPPDATA)
        throw new Error('Dossier ou contexte Windows invalide.');
    const result = operations.executeAction({ source: job.source, confirmed: job.confirmed === true,
        appData: process.env.APPDATA, localAppData: process.env.LOCALAPPDATA, packageRoot: path.join(__dirname, '..') }, job.action);
    console.log('@@RESULT ' + result);
} catch (error) {
    console.error('ECHEC : ' + error.message);
    process.exitCode = 1;
}
