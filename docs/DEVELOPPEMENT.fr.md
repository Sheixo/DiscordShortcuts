# Développement

Le connecteur est dans **shortcutToggle/**. Le plugin Stream Deck est dans **stream-deck/**. Le connecteur dépend des sources et des fonctions internes de Vencord/Discord.

L’assistant Windows est **Installer-Connecteur.cmd** avec **scripts/installer-connecteur.cjs**. Il réutilise les sources Vencord choisies, compile le connecteur et lit le petit bootstrap Vencord de Discord pour trouver la copie active. Une destination étrangère est refusée. Les comptes et fichiers de session ne sont pas lus. L’installation initiale utilise le script officiel **scripts/runInstaller.mjs** des sources Vencord, avec Discord Stable comme cible.

Les tests de cet assistant se lancent séparément avec **node tests/installer-connecteur.cjs** et font également partie de **npm test**. Ils utilisent des installations fictives ; aucune injection réelle n’est exécutée par les tests. Le mode **node scripts/installer-connecteur.cjs --check --vencord "chemin"** vérifie une installation existante sans la modifier.

~~~powershell
npm ci
npm test
npm --prefix stream-deck ci
npm --prefix stream-deck run typecheck
npm --prefix stream-deck run build
~~~

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
