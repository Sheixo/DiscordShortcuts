# Développement

Le connecteur est dans **shortcutToggle/**. Le plugin Stream Deck est dans **stream-deck/**. Le connecteur dépend des sources et des fonctions internes de Vencord/Discord.

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
