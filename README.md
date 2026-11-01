[![CI](https://github.com/IlhanYapici/lmu-livery-editor/actions/workflows/ci.yml/badge.svg)](https://github.com/IlhanYapici/lmu-livery-editor/actions/workflows/ci.yml)


1. Trouver les fichiers modèles (Templates)

• Allez dans le répertoire d'installation de Steam : `.../Steam/steamapps/common/Le Mans Ultimate/support/LiveryTemplates/`
• Ouvrez le dossier correspondant au modèle de voiture souhaité (ex: Lexus RCF, Porsche 911, etc.).
• Le dossier contient des fichiers au format PSD ou compatible avec Photoshop / GIMP. Ne modifiez pas les calques de plaques d'immatriculation ou de carbone de base.

2. Concevoir la livrée et les régions de matériaux

Vous devez créer deux fichiers distincts en format TGA (.tga) non compressé (32 bits conseillé) :
1. customskin.tga : Le design principal de la peinture de la voiture (désactivez les calques de grille/mesh avant l'export).
2. customskin_region.tga : La carte des matériaux et finitions basée sur des codes couleur spécifiques :
	• Noir : Peinture de base / métallique / flake
	• Rouge : Finition Carbone (Carbon override)
	• Bleu / Vert : Chrome, autocollants ou finitions vinyle
	• Blanc : Logos et plaques de course
Important lors de l'exportation en TGA : Décochez l'option "Use RLE compression" (compression RLE) dans la fenêtre d'export pour éviter d'altérer les textures.

3. Installer les fichiers dans le jeu

• Placez vos deux fichiers (customskin.tga et customskin_region.tga) dans le dossier des livrées de l'utilisateur :
`.../Steam/steamapps/common/Le Mans Ultimate/UserData/Liveries/`
• Lancez Le Mans Ultimate, rendez-vous dans le Showroom de la voiture concernée et cliquez sur RELOAD pour voir apparaître vos modifications.

4. Utilisation en ligne (Multijoueur)

• Vous devez d'abord créer ou rejoindre une équipe en tant que chef d'équipe via le Team Hub.
• Pour faire apparaître la livrée en course en ligne, un abonnement RaceControl Pro / Pro+ est requis pour procéder à l'UPLOAD (téléchargement/approbation) de la livrée et l'assigner à votre équipage (Assign to Lineup).