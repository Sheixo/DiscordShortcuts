# Installer, mettre à jour ou désinstaller Discord Shortcuts

[← Accueil](../README.md) · [Télécharger l’assistant Windows](https://github.com/Sheixo/DiscordShortcuts/releases/download/v0.4.0/DiscordShortcuts-Assistant-Windows-0.2.0.zip)

**Trois actions, avec fermeture et relance automatiques.** L’assistant Windows 0.2.0 installe, répare ou désinstalle les deux composants : **ShortcutToggle dans Vencord** et **Discord Shortcuts dans Stream Deck**. Vencord reste nécessaire.

![Assistant Windows — aperçu sans opérations](assistant-windows.jpg)

## Avant de commencer

- Windows 10 ou plus récent, **Discord officiel Stable** et **Stream Deck 7.1** ou plus récent, installé et ouvert une première fois.
- [Node.js 22 ou une version LTS plus récente](https://nodejs.org/), [Git pour Windows](https://git-scm.com/downloads/win) et [pnpm](https://pnpm.io/installation), accessibles dans le PATH.
- Une connexion Internet pour les sources et les dépendances de compilation Vencord.

Les trois actions principales ferment puis relancent automatiquement Discord et Stream Deck. **Un éventuel appel vocal sera interrompu : enregistre tes réglages avant de lancer une opération.** Tu n’as plus à quitter les applications toi-même. Le contrôle **Vérifier seulement** reste disponible sans fermeture ni modification.

La détection automatique vise Discord Stable dans son emplacement Windows habituel et Stream Deck dans **Program Files\Elgato\StreamDeck**. Une installation ouverte dans un autre emplacement est refusée avant la fermeture automatique.

## Installer ou mettre à jour

1. Télécharge [**DiscordShortcuts-Assistant-Windows-0.2.0.zip**](https://github.com/Sheixo/DiscordShortcuts/releases/download/v0.4.0/DiscordShortcuts-Assistant-Windows-0.2.0.zip), puis utilise **Extraire tout**. Garde tous les fichiers ensemble.
2. Ouvre **DiscordShortcuts-Assistant.exe**. Le titre affiche **Assistant 0.2.0** ; une fenêtre marquée **Aperçu** n’exécute aucune opération.
3. Garde **Documents\Vencord** si c’est ton dossier de sources, ou utilise **Parcourir** pour choisir ton dossier existant. Cela conserve tes autres plugins personnalisés. Un dossier absent est créé par téléchargement des sources officielles ; un dossier existant qui ne contient pas Vencord est refusé.
4. Clique sur **Tout installer** et laisse faire : détection, fermeture des deux applications, préparation des dépendances, compilation, application à la bonne copie Vencord, installation du plugin Stream Deck, vérification des fichiers, puis relance des applications.
5. Attends le résultat final dans la fenêtre. Active **ShortcutToggle** dans **Discord → Paramètres → Vencord → Plugins** si nécessaire.
6. Dans Stream Deck, ajoute l’action de la catégorie **Discord Shortcuts** à une touche. Son nom peut apparaître comme **Discord Keybinds** ou **Raccourcis Discord** selon la langue. Sélectionne-la : le panneau doit indiquer **Discord connecté** et afficher tes raccourcis.

Pour une mise à jour, télécharge le nouveau paquet et réutilise **Tout installer** avec le même dossier Vencord. Le panneau recherche les nouvelles versions ; leur installation reste manuelle.

L’assistant utilise le [processus officiel de compilation et d’installation Vencord](https://docs.vencord.dev/installing/). Il ne demande aucun identifiant Discord et ne modifie pas les fichiers de session. Si Discord utilise une autre copie Vencord reconnue, l’assistant y applique la compilation et vérifie les fichiers actifs.

## Les trois actions

| Action | Résultat |
| --- | --- |
| **Tout installer** | Installe ou met à jour le connecteur Vencord et le plugin Stream Deck du paquet. |
| **Vérifier / Réparer** | Reconstruit et réapplique les fichiers du paquet, puis les vérifie. Utilise un nouveau paquet pour obtenir une version plus récente. |
| **Tout désinstaller** | Après confirmation, retire ShortcutToggle des sources et de la compilation active, puis retire le plugin Stream Deck. |

Les applications ne sont relancées qu’après la fin de la compilation et des vérifications de copie. En cas d’échec, l’assistant affiche l’erreur et tente aussi de les rouvrir. Une relance impossible est signalée, même si les fichiers ont été correctement traités. La relance des processus ne prouve pas que les composants sont déjà connectés : laisse quelques secondes au panneau pour retrouver Discord.

Le petit bouton **Vérifier seulement** compare les fichiers sans lancer de compilation, fermer d’application ou modifier l’installation. Ce contrôle ne prouve pas la connexion en cours.

## Désinstaller

1. Garde les sources Vencord et les outils de compilation disponibles.
2. Ouvre l’assistant, choisis le dossier Vencord utilisé lors de l’installation et clique sur **Tout désinstaller**.
3. Confirme le retrait, puis laisse l’assistant fermer les applications, reconstruire Vencord sans connecteur, retirer le plugin Stream Deck et relancer les applications.

**Sont conservés :** Vencord, les autres plugins personnalisés, les raccourcis et comptes Discord, les profils Stream Deck, Node.js, Git et pnpm. Les touches Discord Shortcuts déjà placées dans les profils peuvent rester visibles comme actions manquantes ; tu peux les retirer dans Stream Deck.

Les sauvegardes restent dans **.discord-shortcuts-backups** sous les sources Vencord et dans **%APPDATA%\Elgato\StreamDeck\DiscordShortcutsBackups** pour Stream Deck. L’assistant ne les efface pas automatiquement.

## Vérifier le fonctionnement

1. Mets **OFF** et essaie un raccourci Discord habituel : son action doit être suspendue.
2. Décoche ce raccourci dans Stream Deck : son action doit redevenir disponible, même sur OFF.
3. Recoche-le et remets **ON** : son action doit fonctionner à nouveau.

Les touches restent utilisables pour écrire et jouer. Les nouveaux raccourcis créés dans Discord apparaissent automatiquement, cochés par défaut, dans Stream Deck. Un redémarrage de Discord remet ON ; une simple reconnexion Stream Deck conserve l’état existant.

## Dépannage

- **La fenêtre porte la mention Aperçu :** ouvre l’exécutable normal du paquet, sans l’option de présentation.
- **L’assistant demande de fermer les applications manuellement :** vérifie que tu utilises bien la nouvelle version ; l’ancien assistant 0.1.0 ne gère pas leur fermeture.
- **La fermeture automatique est refusée :** lis le message. Le gestionnaire ne ferme que Discord Stable et Stream Deck reconnus dans ta session Windows, jamais un processus inconnu. Une application relancée pendant la compilation peut arrêter l’opération avant la copie des fichiers.
- **La compilation échoue :** consulte la dernière erreur, corrige le prérequis indiqué et relance la même action. L’assistant tente de rouvrir les applications même dans ce cas.
- **La relance échoue :** ouvre manuellement l’application indiquée. Le journal distingue cette erreur d’une erreur d’installation.
- **ShortcutToggle est absent :** utilise **Vérifier seulement**, puis **Vérifier / Réparer**. Active ensuite le connecteur dans Vencord.
- **Le panneau reste hors ligne :** vérifie que ShortcutToggle est activé, puis utilise **Actualiser la connexion** dans le panneau.
- **Le dossier Vencord n’est pas reconnu :** choisis les sources utilisées lors de l’installation ou joins le message à une [demande d’aide](https://github.com/Sheixo/DiscordShortcuts/issues).

Discord PTB/Canary, Vesktop, le navigateur, macOS et Linux ne sont pas pris en charge. [Développement manuel](DEVELOPPEMENT.fr.md).
