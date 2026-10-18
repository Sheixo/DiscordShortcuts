# Discord Shortcuts — Assistant Windows 0.1.0

Extrais tout le ZIP, puis ouvre **DiscordShortcuts-Assistant.exe**. Garde tous les fichiers du dossier ensemble.

## Prérequis

Windows 10 ou plus récent, Discord officiel Stable et Stream Deck 7.1 ou plus récent, déjà ouvert une première fois. Pour installer, réparer ou retirer le connecteur : Node.js 22 ou une version LTS plus récente, Git et pnpm accessibles dans le PATH, ainsi qu’une connexion Internet pour la compilation de Vencord.

- Node.js : https://nodejs.org/
- Git : https://git-scm.com/downloads/win
- pnpm : https://pnpm.io/installation

Vencord reste nécessaire. Le plugin Stream Deck et le connecteur ShortcutToggle sont deux composants distincts, installés par le même assistant.

## Choisir une action

| Bouton | Résultat |
| --- | --- |
| Tout installer | Installe ou met à jour le connecteur Vencord et le plugin Stream Deck. |
| Stream Deck uniquement | Installe ou met à jour le plugin Stream Deck, sans reconstruire Vencord. |
| Vérifier / Réparer | Reconstruit le connecteur, l’applique à la copie chargée par Discord et remet les fichiers Stream Deck du paquet. |
| Tout désinstaller | Retire ShortcutToggle des sources et de la compilation Vencord, puis retire le plugin Stream Deck. |
| Vérifier seulement | Compare les fichiers sans installer, fermer ni supprimer quoi que ce soit. |

Pour toute opération qui modifie le connecteur, quitte complètement Discord et Stream Deck depuis leurs icônes près de l’horloge. Un appel vocal sera interrompu. Pour Stream Deck uniquement, il suffit de fermer Stream Deck. L’assistant ne ferme aucune application automatiquement.

Le dossier proposé est Documents\Vencord. Si tu possèdes déjà des sources Vencord avec d’autres plugins, choisis ce dossier existant. Si le dossier choisi n’existe pas, l’installation télécharge les sources officielles. Un dossier existant qui ne contient pas Vencord est refusé.

Après installation : relance Discord et Stream Deck, active **ShortcutToggle** dans **Paramètres → Vencord → Plugins**, puis ajoute l’action **Discord Shortcuts** à une touche Stream Deck. Sélectionne-la pour afficher les réglages.

Si Node.js est absent, **Stream Deck uniquement** ouvre l’installateur officiel .streamDeckPlugin fourni ; termine alors l’installation dans Stream Deck. Les autres actions demandent Node.js.

## Désinstallation et sauvegardes

La désinstallation demande confirmation. Elle conserve Vencord, les autres plugins personnalisés, les raccourcis et comptes Discord, les profils Stream Deck, Node.js, Git et pnpm. Les touches Discord Shortcuts déjà placées dans un profil peuvent rester visibles comme actions manquantes : tu peux les retirer dans Stream Deck.

Pour conserver les autres plugins, le connecteur est retiré par une nouvelle compilation de Vencord : garde ses sources et les outils de compilation jusqu’à la désinstallation.

Les sauvegardes sont conservées dans **.discord-shortcuts-backups** sous les sources Vencord et dans **%APPDATA%\Elgato\StreamDeck\DiscordShortcutsBackups** pour Stream Deck. L’assistant ne les efface pas. En cas d’échec, lis le journal avant de relancer l’opération.

## Versions et aide

Cet assistant 0.1.0 contient le plugin Stream Deck 0.4.0.0 et le connecteur 0.3.0. Les mises à jour du panneau recherchent les nouvelles versions ; l’installation reste manuelle.

Guide complet : https://github.com/Sheixo/DiscordShortcuts/blob/main/docs/INSTALLATION.fr.md

Projet et assistance : https://github.com/Sheixo/DiscordShortcuts

Licence GPL-3.0-or-later. Projet communautaire indépendant de Discord, Vencord et Elgato.
