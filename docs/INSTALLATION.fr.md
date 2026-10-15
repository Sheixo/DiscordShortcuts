# Installer Discord Shortcuts

[← Accueil](../README.md) · [Téléchargements](https://github.com/Sheixo/DiscordShortcuts/releases/latest)

Il faut installer **deux composants** : le connecteur dans Vencord et le plugin dans Stream Deck. Le bouton Stream Deck ne peut pas contrôler les raccourcis sans le connecteur.

## Avant de commencer

- Discord officiel sous Windows 10 ou plus récent.
- Stream Deck 7.1 ou plus récent.
- Une installation Vencord construite depuis ses sources. Si tu n’en as pas encore, suis le [guide officiel des plugins personnalisés Vencord](https://docs.vencord.dev/installing/custom-plugins/), puis reprends ici.

## 1. Installer le connecteur Discord

1. Télécharge **index.tsx** depuis la dernière publication. Avec l’archive complète, utilise le même fichier dans le dossier **shortcutToggle**.
2. Ferme complètement Discord, y compris son icône près de l’horloge : un éventuel appel vocal sera interrompu.
3. Dans ton dossier des sources Vencord, crée au besoin **src/userplugins/shortcutToggle**, puis remplace son **index.tsx** par le fichier téléchargé. Si tu possèdes l’ancien ShortcutToggle, remplace-le à cet emplacement plutôt que d’ajouter un second plugin.
4. Ouvre PowerShell dans ton dossier Vencord et exécute :

   ~~~powershell
   pnpm.cmd build
   ~~~

5. Pour une première installation de Vencord depuis les sources, termine l’injection selon le guide officiel. Pour une simple mise à jour du connecteur sur une installation déjà injectée, la reconstruction suffit normalement : ne relance pas l’injection à chaque modification.
6. Relance Discord et active **ShortcutToggle** dans **Paramètres → Vencord → Plugins**, s’il n’est pas déjà actif.

Le connecteur n’a pas de panneau de contrôle dans Discord. Tous les réglages se trouvent dans Stream Deck.

## 2. Installer le plugin Stream Deck

1. Télécharge **fr.ethan.discord-shortcuts.streamDeckPlugin** depuis la même publication.
2. Ouvre ce fichier et accepte sa mise à jour dans Stream Deck si une ancienne version est présente.
3. Ajoute l’action **Discord Shortcuts → Raccourcis Discord** à une touche. Les touches déjà configurées sont conservées grâce au même identifiant de plugin.
4. Sélectionne la touche dans Stream Deck. Le panneau indique **Discord connecté**, puis affiche tes raccourcis.
5. Appuie sur le bouton : **OFF** suspend les actions cochées ; **ON** les réactive.

Tu peux également télécharger l’archive **DiscordShortcuts-0.4.0.zip**, qui contient les sources, le connecteur, l’installateur et les guides.

## Vérifier l’installation

1. Mets OFF et essaie un raccourci Discord habituel : son action doit être suspendue.
2. Décoche ce raccourci : son action doit redevenir disponible, sans repasser sur ON.
3. Recoche-le, puis remets ON : son action doit fonctionner à nouveau.
4. Vérifie que les touches restent utilisables pour écrire et jouer.

Les nouveaux raccourcis se configurent dans Discord et apparaissent automatiquement dans la liste, cochés par défaut. Le redémarrage de Discord remet ON ; une reconnexion de Stream Deck conserve l’état existant.

## Dépannage

### Le panneau reste hors ligne

Vérifie que Discord officiel est ouvert, que Vencord est chargé et que **ShortcutToggle** est actif. Le connecteur requis est la version **0.3.0** ou compatible. Relance le compagnon Stream Deck si nécessaire, puis utilise **Actualiser la connexion** pour redemander l’état.

### La reconstruction ne change rien dans Discord

Vérifie que tu reconstruis le dossier Vencord réellement chargé. Certaines installations chargent leurs fichiers depuis **%APPDATA%/Vencord/dist**, tandis que la compilation se fait dans un autre dossier **Vencord/dist**. Discord doit être complètement fermé lors du remplacement des fichiers compilés. Suis le guide officiel pour utiliser la bonne installation ; ne modifie pas les fichiers de session de Discord.

### Une touche rouge ou verte ne correspond pas au panneau

Les images et titres personnalisés dans Stream Deck peuvent masquer ceux du plugin. Retrouve les images par défaut sur la touche si tu veux voir l’état fourni. Une commande sans confirmation n’est jamais renvoyée automatiquement : contrôle la connexion avant de réessayer.

### Les mises à jour sont introuvables

Vérifie Internet et réessaie dans **Mises à jour**. La vérification quotidienne peut être désactivée ; le téléchargement et l’installation restent manuels. Les liens et la recherche de cette version utilisent le nouveau dépôt **Sheixo/DiscordShortcuts**.

### J’utilise Vesktop

Cette version vise les raccourcis natifs de Discord officiel sous Windows. La présence de Vencord dans Vesktop ne garantit pas leur disponibilité.
