# Installer ou mettre à jour Discord Shortcuts

[← Accueil](../README.md) · [Télécharger le paquet Windows](https://github.com/Sheixo/DiscordShortcuts/releases/latest/download/DiscordShortcuts-Installation-Windows-0.4.0.zip)

**Une seule procédure pour une première installation et pour les mises à jour.** Le paquet contient l’assistant du connecteur et l’installateur Stream Deck. Tu n’as pas de commandes PowerShell à recopier ni de fichiers compilés à déplacer toi-même.

Deux composants restent nécessaires : **ShortcutToggle dans Vencord** et **Discord Shortcuts dans Stream Deck**. Cet assistant facilite leur installation ; il ne rend pas le plugin indépendant de Vencord.

## Avant de commencer

- **Discord officiel Stable**, sous Windows 10 ou plus récent.
- **Stream Deck 7.1** ou plus récent.
- [Node.js 22 ou une version LTS plus récente](https://nodejs.org/), [Git pour Windows](https://git-scm.com/downloads/win) et [pnpm](https://pnpm.io/installation), installés et accessibles dans le PATH. Ce sont les outils nécessaires à la compilation de Vencord.
- Une connexion Internet pour les sources et les dépendances.

Si tu possèdes déjà les sources Vencord avec d’autres plugins personnalisés, garde ce dossier : l’assistant peut le réutiliser. Il ne télécharge pas une nouvelle copie par-dessus un dossier existant et ne met pas automatiquement ses sources à jour.

## 1. Installer le connecteur Discord

1. Télécharge [**DiscordShortcuts-Installation-Windows-0.4.0.zip**](https://github.com/Sheixo/DiscordShortcuts/releases/latest/download/DiscordShortcuts-Installation-Windows-0.4.0.zip), puis utilise **Extraire tout**. Garde ensemble tous les fichiers extraits.
2. **Quitte complètement Discord depuis son icône près de l’horloge.** Un éventuel appel vocal sera interrompu.
3. Dans le dossier extrait, double-clique sur **Installer-Connecteur.cmd**.
4. L’assistant propose ton dossier **Documents\Vencord**. Appuie sur **Entrée** pour le garder, ou indique le dossier qui contient tes sources Vencord. Si le dossier choisi n’existe pas, l’assistant y télécharge les sources officielles.
5. Attends le message **Installation terminée**. L’assistant place le connecteur, prépare les dépendances, compile Vencord, installe la compilation dans Discord si nécessaire et vérifie les fichiers réellement chargés. S’il existe deux copies de Vencord, il applique les fichiers à la bonne copie. Une sauvegarde des fichiers remplacés est conservée.
6. Relance Discord, puis active **ShortcutToggle** dans **Paramètres → Vencord → Plugins**.

Le nom à rechercher dans Discord est **ShortcutToggle**. Les réglages du plugin se trouvent dans Stream Deck.

L’assistant utilise le [processus officiel de compilation et d’installation de Vencord](https://docs.vencord.dev/installing/). Il ne demande aucun identifiant Discord et ne modifie pas les fichiers de session.

## 2. Installer le plugin Stream Deck

1. Dans le même dossier extrait, ouvre **fr.ethan.discord-shortcuts.streamDeckPlugin**. Accepte la mise à jour proposée par Stream Deck si une ancienne version est présente.
2. Ajoute l’action de la catégorie **Discord Shortcuts** à une touche. Son nom peut apparaître comme **Discord Keybinds** ou **Raccourcis Discord**, selon la langue. Les touches déjà configurées conservent leur identifiant.
3. Sélectionne la touche : le panneau doit indiquer **Discord connecté** et afficher tes raccourcis.

## Pour une prochaine mise à jour

**Télécharge le nouveau paquet et refais les deux étapes ci-dessus.** Choisis le même dossier Vencord dans l’assistant. Il reprend la compilation et vérifie la copie active ; tu n’as pas à déterminer toi-même où copier les fichiers ou quand relancer l’injection.

Les vérifications de mise à jour du panneau restent disponibles, mais elles n’installent pas automatiquement le connecteur.

## Vérifier le fonctionnement

1. Mets **OFF** et essaie un raccourci Discord habituel : son action doit être suspendue.
2. Décoche ce raccourci dans Stream Deck : son action doit redevenir disponible, même sur OFF.
3. Recoche-le, puis remets **ON** : son action doit fonctionner à nouveau.

Les touches restent utilisables pour écrire et jouer. Configure les nouveaux raccourcis dans Discord : ils apparaissent automatiquement, cochés par défaut, dans Stream Deck. Le redémarrage de Discord remet ON ; une reconnexion de Stream Deck conserve l’état existant.

## En cas de problème

- **L’assistant s’arrête :** lis la dernière ligne. Une erreur de téléchargement ou de compilation doit être résolue avant de relancer le même assistant. Il ne faut pas ajouter des commandes au hasard.
- **ShortcutToggle est absent :** vérifie que l’assistant a terminé avec succès, puis ferme et relance complètement Discord. Après une réinstallation de Vencord ou une réparation de Discord, relance le même assistant pour réappliquer le connecteur.
- **Le panneau Stream Deck reste hors ligne :** vérifie que Discord est ouvert, que ShortcutToggle est activé et que l’action Discord Shortcuts est présente. Utilise ensuite **Actualiser la connexion** dans le panneau.
- **Discord utilise un autre dossier Vencord :** l’assistant affiche le dossier et s’arrête pour éviter de modifier une installation qu’il ne reconnaît pas. Choisis les sources correspondantes, ou joins ce message à une [demande d’aide](https://github.com/Sheixo/DiscordShortcuts/issues).

Cette procédure vise **Discord Stable sous Windows**. Elle ne prend pas en charge Vesktop, Discord PTB/Canary, le navigateur, macOS ou Linux.

Pour le développement manuel, les fichiers source du connecteur restent dans **shortcutToggle/** ; consulte le [guide officiel des plugins personnalisés Vencord](https://docs.vencord.dev/installing/custom-plugins/) et le [guide de développement du projet](DEVELOPPEMENT.fr.md).
