# Discord Shortcuts — Assistant Windows 0.2.0

Extrais tout le ZIP, puis ouvre **DiscordShortcuts-Assistant.exe**. Garde tous les fichiers du dossier ensemble. Une fenêtre marquée **Aperçu** n’exécute aucune opération.

## Prérequis

Windows 10 ou plus récent, Discord officiel Stable et Stream Deck 7.1 ou plus récent dans leurs emplacements habituels, Stream Deck ayant été ouvert une première fois. Node.js 22 ou une version LTS plus récente, Git et pnpm accessibles dans le PATH, ainsi qu’une connexion Internet pour compiler Vencord.

- Node.js : https://nodejs.org/
- Git : https://git-scm.com/downloads/win
- pnpm : https://pnpm.io/installation

Vencord reste nécessaire. Choisis ton dossier de sources Vencord existant pour conserver tes autres plugins.

## Trois actions

| Bouton | Résultat |
| --- | --- |
| Tout installer | Installer ou mettre à jour le connecteur Vencord et le plugin Stream Deck du paquet. |
| Vérifier / Réparer | Reconstruire, appliquer à la bonne copie et vérifier les fichiers. |
| Tout désinstaller | Retirer nos deux composants après confirmation. |

**Discord et Stream Deck sont fermés puis relancés automatiquement.** Un éventuel appel vocal sera interrompu : enregistre tes réglages avant de lancer une opération. Attends le message final. En cas d’erreur, l’assistant tente aussi de rouvrir les applications ; une relance impossible est signalée.

**Vérifier seulement** compare les fichiers sans modification ni redémarrage.

Après installation : active **ShortcutToggle** dans **Discord → Paramètres → Vencord → Plugins** si nécessaire, puis ajoute l’action **Discord Shortcuts** à une touche Stream Deck.

## Désinstallation

Vencord, les autres plugins, les raccourcis et comptes Discord, les profils Stream Deck, Node.js, Git et pnpm sont conservés. Garde les sources Vencord et les outils de compilation pour retirer uniquement le connecteur. Les touches Discord Shortcuts déjà placées dans les profils peuvent rester comme actions manquantes.

Les sauvegardes restent dans **.discord-shortcuts-backups** sous les sources Vencord et dans **%APPDATA%\Elgato\StreamDeck\DiscordShortcutsBackups** pour Stream Deck.

## Aide

Assistant 0.2.0, plugin Stream Deck 0.4.0.0 et connecteur 0.3.0. L’installation des mises à jour reste manuelle.

Guide : https://github.com/Sheixo/DiscordShortcuts/blob/main/docs/INSTALLATION.fr.md

Projet : https://github.com/Sheixo/DiscordShortcuts

Licence GPL-3.0-or-later. Projet communautaire indépendant de Discord, Vencord et Elgato.
