# Validation — 16 octobre 2026

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
