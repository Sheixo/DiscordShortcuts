# Changements

## Assistant Windows 0.2.0 — 18 octobre 2026

- Trois actions principales : Tout installer, Vérifier / Réparer et Tout désinstaller.
- Fermeture puis relance automatiques de Discord et Stream Deck, y compris une tentative de relance après échec.
- Attente de fin de compilation et vérification des fichiers avant la relance. Une relance impossible ne devient pas un faux succès.
- Détection limitée aux exécutables officiels habituels dans la session Windows courante ; contrôle Vérifier seulement sans interruption.
- Version visible dans le titre pour distinguer le nouvel assistant des anciennes fenêtres.

## Assistant Windows 0.1.0 — 18 octobre 2026

- Nouvelle fenêtre : Tout installer, Stream Deck uniquement, Vérifier / Réparer, Tout désinstaller et contrôle des fichiers sans modification.
- Détection de la compilation Vencord réellement chargée par Discord pour éviter le problème des deux copies.
- Sauvegardes et désinstallation des deux composants sans retirer Vencord, les autres plugins ou les profils Stream Deck.
- Guide et paquet unique avec les prérequis. Plugin Stream Deck 0.4.0.0 et connecteur 0.3.0 conservés.

## 0.4.0

- Panneau Stream Deck plus compact, état de connexion et titres ON/OFF explicites.
- Liste sans défilement imbriqué ; mises à jour et aide repliables.
- Nouveau dépôt DiscordShortcuts, guide pour les deux composants et aperçu interactif.
- Recherche de mises à jour transférée vers ce dépôt ; un résultat mémorisé pour une ancienne source ne devient pas un téléchargement du nouveau dépôt.
- Moteur du connecteur 0.3.0 conservé, identifiants du plugin Stream Deck et des actions conservés.

## Base 0.3.0

Gestion des raccourcis déplacée dans Stream Deck, connecteur Vencord minimal, ajouts automatiques, sélection synchronisée, état confirmé et reconnexion. Test ON/OFF au clavier confirmé par l’utilisateur.
