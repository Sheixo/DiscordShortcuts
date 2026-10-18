# Validation — mise à jour le 18 octobre 2026

## Assistant graphique Windows 0.1.0 — 18 octobre 2026

- Compilation native .NET Framework WinForms réussie ; fenêtre affichée et boutons lisibles. Le mode aperçu désactive les opérations.
- **22 tests d’opérations** réussis dans des installations fictives : intégrité du paquet, destinations refusées, remplacement Stream Deck, manifeste endommagé, sauvegarde, arrêt si l’application reste ouverte, désinstallation répétée, source partiellement absente, conservation des autres plugins et profils, et restauration après échec de compilation ou de déplacement.
- Le bouton **Vérifier seulement** a été exécuté dans l’application native sur le PC de développement : fichiers du connecteur et du compagnon conformes, avec identification de la copie active dans AppData. Ce contrôle n’a modifié aucune installation et ne teste pas la connexion en cours.
- Le dialogue de désinstallation a été ouvert puis annulé : périmètre explicite et choix **Non** sélectionné par défaut. Aucune désinstallation réelle n’a été exécutée sur le PC de l’utilisateur pendant cette validation.
- Les opérations d’installation/réparation/désinstallation du nouvel assistant graphique restent validées par simulation. Son moteur de connecteur est partagé avec l’assistant en console testé en réel ci-dessous.

## Assistant d’installation — 18 octobre 2026

- 25 tests dédiés réussis : lecture du bootstrap sans exécution de code, choix de la version Discord, destinations refusées, compilation sans connecteur, fichiers manquants, sauvegarde, copie interrompue et restauration, installation initiale, mise à jour sans réinjection et réouverture de Discord pendant la préparation.
- Les tests de première installation et d’échec d’injection utilisent des processus simulés. Un essai complet de première installation sur un PC vierge n’a pas été effectué.
- Contrôle en lecture seule effectué sur le PC de développement : la copie chargée depuis AppData correspond aux fichiers compilés contenant ShortcutToggle. Ce contrôle ne prouve pas à lui seul la connexion en cours à Stream Deck.
- Après application de cette compilation et rechargement de Discord, ShortcutToggle apparaît dans Vencord et est activé. Le moteur du connecteur et l’installateur Stream Deck restent ceux de la version publiée.
- L’utilisateur a ensuite téléchargé et exécuté la procédure publiée en console, puis confirmé que les installations fonctionnaient correctement. Ce retour concerne son PC, sans constituer un essai sur un PC vierge.

## Version publiée

Discord Shortcuts 0.4.0 : plugin Stream Deck **0.4.0.0**, connecteur Vencord **0.3.0**.

## Vérifications automatisées et compilation

- **232 vérifications automatisées réussies** : moteur natif, deux ordres de notification Discord, raccourcis ajoutés pendant OFF, combinaisons et souris, modification de touche ou d’action, suppression, touches maintenues, sélection, reconnexion, sessions, doublons et délais, panneau et recherche de mises à jour.
- Tests du transfert de la recherche vers le nouveau dépôt, conservation du choix de vérification automatique et rejet d’un résultat mémorisé pour une autre source.
- Vérification TypeScript du connecteur contre les sources Vencord réussie.
- Vérification TypeScript du plugin Stream Deck et compilation Rollup réussies.
- Installateur validé et produit par le CLI officiel Elgato : **16 fichiers**, version **0.4.0.0** ; identifiants du plugin et de l’action conservés.
- Le connecteur est strictement identique à celui de la base testée : sa compilation complète Vencord avait réussi sur les six cibles bureau.

## Essais dans les applications

- Nouveau panneau installé dans Stream Deck avec le connecteur Discord actif.
- Connexion à Discord et état OFF retrouvés après rechargement du compagnon.
- Passage OFF → ON → OFF confirmé par Discord et affiché sur la touche et le panneau.
- État final OFF, identique à celui observé avant cette mise à jour.
- L’aperçu interactif utilise les vrais fichiers HTML, CSS et JavaScript du panneau avec un serveur fictif isolé. Bouton ON/OFF, sélection pendant OFF et affichage hors ligne vérifiés dans le navigateur.
- Présentation approuvée par l’utilisateur après consultation de l’aperçu.

Dans la base précédente, la sélection décochée puis recochée en conservant OFF et la reconnexion ont été vérifiées en réel. L’utilisateur a aussi confirmé le bouton physique et le test au clavier : action bloquée sur OFF et fonctionnelle sur ON. Le moteur correspondant est conservé dans cette version.

Les scénarios d’ajout, modification et suppression sont couverts par les simulations. Une validation complète de ces scénarios dans Discord reste possible avec le guide d’installation. L’usage des touches dans un jeu n’a pas été testé pendant cette session.

## Périmètre

Le connecteur Vencord reste nécessaire. Cette publication améliore la présentation et transfère les liens vers **Sheixo/DiscordShortcuts** ; elle ne constitue pas une version autonome pour Discord non modifié. La soumission Marketplace existante n’est pas mise à jour par cette publication GitHub.
