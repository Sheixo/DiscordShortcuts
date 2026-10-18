// SPDX-License-Identifier: GPL-3.0-or-later
const path = require('node:path');
const cp = require('node:child_process');
const operations = require('./operations.cjs');

function controller(packageRoot) {
    const helper = path.join(packageRoot, 'installer', 'ApplicationControl.exe');
    function invoke(command) {
        const result = cp.spawnSync(helper, [command], { encoding: 'utf8', windowsHide: true, timeout: 45000 });
        if (result.error || result.status !== 0)
            throw new Error(result.stderr?.trim() || result.error?.message || 'Gestion automatique des applications impossible.');
        if (command !== 'plan' && result.stdout) process.stdout.write(result.stdout);
    }
    return { prepare: () => invoke('plan'), stop: () => invoke('stop'), start: () => invoke('start') };
}

function withApplications(applications, operation) {
    applications.prepare(); // No application is closed if discovery fails.
    let result, failure, restartFailure;
    try {
        console.log('@@STATUS Fermeture automatique de Discord et Stream Deck…');
        applications.stop();
        console.log('@@STATUS Operation en cours — les fichiers seront verifies avant la relance.');
        result = operation();
    } catch (error) { failure = error; }
    // Also covers a partial stop or a failed build. Never report success if reopening failed.
    console.log('@@STATUS Relance de Discord et Stream Deck…');
    try { applications.start(); } catch (error) { restartFailure = error; }
    if (failure && restartFailure) throw new Error(failure.message + '\nLa relance a aussi echoue : ' + restartFailure.message);
    if (failure) throw failure;
    if (restartFailure) throw new Error('Les fichiers ont ete traites, mais ' + restartFailure.message);
    return result + ' Discord et Stream Deck ont ete relances.';
}

function executeManagedAction(context, action, applications = null) {
    if (!['check', 'install-all', 'repair', 'uninstall'].includes(action)) throw new Error('Action inconnue.');
    if (action === 'check') return operations.executeAction(context, action);
    if (action === 'uninstall' && context.confirmed !== true) throw new Error('La confirmation de desinstallation est requise.');
    // Verify the supplied files and destination before interrupting the applications.
    if (action !== 'uninstall') operations.payload(context);
    operations.streamDeckLocation(context);
    return withApplications(applications || controller(context.packageRoot), () => operations.executeAction(context, action));
}

module.exports = { controller, withApplications, executeManagedAction };
