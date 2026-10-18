# Développement

Le connecteur est dans **shortcutToggle/**. Le plugin Stream Deck est dans **stream-deck/**. Le connecteur dépend des sources et des fonctions internes de Vencord/Discord.

L’assistant graphique Windows est dans **installer/Assistant.cs** (.NET Framework WinForms). Il lance **scripts/launcher-runner.cjs**, qui transmet uniquement l’action et le dossier choisi à **installer/operations.cjs**. Le journal est récupéré sans ouvrir de console. L’ancien **Installer-Connecteur.cmd** et **scripts/installer-connecteur.cjs** restent utilisables ; ce dernier contient le moteur de compilation commun.

Le moteur réutilise les sources Vencord choisies, compile le connecteur et lit le petit bootstrap Vencord de Discord pour trouver la copie active. Une destination étrangère est refusée. Les comptes et fichiers de session ne sont pas lus. L’installation initiale utilise le script officiel **scripts/runInstaller.mjs** des sources Vencord, avec Discord Stable comme cible.

Les tests de cet assistant se lancent séparément avec **node tests/installer-connecteur.cjs** et font également partie de **npm test**. Ils utilisent des installations fictives ; aucune injection réelle n’est exécutée par les tests. Le mode **node scripts/installer-connecteur.cjs --check --vencord "chemin"** vérifie une installation existante sans la modifier.

**node tests/assistant.cjs** couvre les opérations graphiques avec des dossiers fictifs : remplacement Stream Deck, sauvegardes, désinstallation, restauration après échec et conservation des autres plugins et profils. Le dossier temporaire **.test-tmp/** reste sous le projet et est ignoré par Git.

~~~powershell
npm ci
npm test
npm --prefix stream-deck ci
npm --prefix stream-deck run typecheck
npm --prefix stream-deck run build
~~~

Pour compiler l’assistant après la construction du compagnon et la génération de son installateur :

~~~powershell
npm run build:assistant
~~~

Cette commande Windows utilise le compilateur .NET Framework de Windows, copie le connecteur et les 16 fichiers compilés du plugin Stream Deck, puis produit un manifeste SHA-256 du contenu. Le dossier complet **releases/DiscordShortcuts-Assistant/** est à distribuer dans un ZIP ; l’exécutable seul ne suffit pas. L’option **DiscordShortcuts-Assistant.exe --preview** désactive toutes les opérations pour présenter la fenêtre.

L’installation directe du plugin Stream Deck exige sa fermeture et conserve une sauvegarde de son ancien dossier. La désinstallation déplace uniquement notre plugin et les sources ShortcutToggle vers les sauvegardes, recompile Vencord sans connecteur puis vérifie son absence. Vencord, les autres plugins et les profils restent en place. Une erreur de compilation ou de copie restaure les éléments modifiés par la désinstallation.

Les tests compilent le connecteur et vérifient le moteur, les notifications natives, les ajouts et modifications pendant OFF, les confirmations, la reconnexion, le panneau et les mises à jour. Ils n’injectent rien dans Discord.

Pour contrôler les types du connecteur contre une installation Vencord :

~~~powershell
node scripts/typecheck.cjs "C:/chemin/vers/Vencord"
~~~

Pour produire l’installateur avec le CLI Elgato installé dans les dépendances Stream Deck :

~~~powershell
npm --prefix stream-deck run pack
~~~

Le compagnon écoute localement sur **127.0.0.1:45873**. Son protocole contrôle les sessions, révisions, confirmations, délais et doublons. Les commandes non confirmées ne sont pas répétées automatiquement.

Les publications qui doivent être détectées par la recherche de mise à jour incluent l’installateur et **streamdeck-update.json**. Le descripteur contient la version Stream Deck à quatre composantes, le tag, l’identifiant du plugin, le nom, la taille et le SHA-256 de l’installateur. Les métadonnées sont vérifiées contre celles de la publication GitHub.
