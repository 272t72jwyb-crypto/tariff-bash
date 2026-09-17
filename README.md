# Tariff Bash

Renvoyez la balle. Pas la facture.

Jeu Pong statique en HTML, CSS et JavaScript : Carney contre Trump, solo ou duo,
portrait/paysage, dommages progressifs et danses de victoire. L'intro apparaît
une fois par session d'onglet. Les dix derniers matchs sont stockés localement
dans le navigateur. Aucun serveur applicatif, base de données, PHP, Node.js ou
étape de compilation n'est nécessaire pour l'hébergement.

## Fichiers

- `dist/index.html` : interface et écran d'introduction.
- `dist/style.css` : présentation et animations.
- `dist/game.js` : règles, commandes, scores et célébrations.
- `dist/intro.js` : bouton START et mémorisation de la session.
- `dist/assets/` : portraits et illustrations indispensables.
- `deploy/nginx-tariff-bash.conf` : exemple de configuration HTTP.

Il faut publier **le contenu de `dist/`**, pas la racine du dépôt.
Les polices du jeu sont chargées depuis Google Fonts, avec des polices de secours.

## 1. Créer ton dépôt Git

L'archive exportée contient les sources actuelles, sans l'historique Git ni
identifiants d'accès. Le dépôt utilisé par Sites emploie une authentification
temporaire ; pour des `git clone` et `git pull` durables sur ton serveur, utilise
un dépôt sous ton propre compte GitHub ou GitLab.

Sur GitHub, crée un dépôt **vide**, par exemple `tariff-bash`, sans ajouter de
README automatique. Configure ton accès SSH à GitHub sur ton ordinateur.
Après extraction de l'archive, dans le dossier `tariff-bash` :

```bash
git init -b main
git add dist README.md deploy
git commit -m "Import de Tariff Bash"
git remote add origin git@github.com:TON_COMPTE/tariff-bash.git
git push -u origin main
```

Remplace `TON_COMPTE` par ton compte ou ton organisation. Cette adresse est un
exemple, pas un dépôt déjà créé. Si Git le demande, renseigne ton nom et ton
adresse de commit avec `git config user.name` et `git config user.email`.
Procédure officielle : [importer des sources locales sur GitHub](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github).

## 2. Cloner sur ton serveur Ubuntu / EC2

Avec ton utilisateur de déploiement habituel, installe Git s'il manque :

```bash
sudo apt update
sudo apt install git
sudo install -d -m 755 -o "$USER" -g "$(id -gn)" /srv/tariff-bash
git clone git@github.com:TON_COMPTE/tariff-bash.git /srv/tariff-bash
```

Le répertoire cible doit être vide avant le premier clone. Pour un dépôt privé,
le serveur doit avoir un accès SSH au dépôt. Une clé de déploiement dédiée en
lecture seule suffit pour cloner et tirer les mises à jour : génère la clé sur
le serveur, ajoute **sa partie publique** dans GitHub → dépôt → Settings → Deploy
keys, et garde la partie privée sur le serveur. Si tu utilises une clé au nom
personnalisé, indique-la avec `IdentityFile` dans la configuration SSH.
Voir [la procédure GitHub des clés de déploiement](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys).

## 3. Servir le jeu avec Nginx

Sur ton site Nginx existant, configure la racine suivante dans le bloc `server`
du domaine concerné, en conservant sa configuration HTTPS déjà en place :

```nginx
root /srv/tariff-bash/dist;
index index.html;

location / {
    try_files $uri $uri/ =404;
    add_header Cache-Control "no-cache";
}
```

Le dossier `deploy/` contient un exemple HTTP complet pour un nouveau site.
Il utilise `tariffbash.com` et `www.tariffbash.com` ; adapte les noms à tes DNS.
N'ajoute pas un second bloc concurrent si ton domaine est déjà configuré.
Sur un serveur vierge, Nginx peut être installé avec `sudo apt install nginx`.
Après modification de la configuration, valide-la puis recharge-la :

```bash
sudo nginx -t && sudo systemctl reload nginx
```

Nginx doit pouvoir traverser les dossiers parents et lire les fichiers de
`dist/` ; il n'a pas besoin d'y écrire. Pour EC2, les DNS doivent pointer vers
l'adresse publique du serveur et le groupe de sécurité autoriser HTTP/HTTPS.
Si ton domaine fonctionne déjà, conserve ses réglages réseau et son certificat.
Voir [la documentation Nginx sur les fichiers statiques](https://nginx.org/en/docs/beginners_guide.html#static).

## 4. Mettre le site à jour

Sur ton ordinateur, modifie les fichiers puis envoie-les au dépôt :

```bash
git add dist
git commit -m "Mise à jour du jeu"
git push origin main
```

Sur le serveur :

```bash
git -C /srv/tariff-bash pull --ff-only origin main
```

Les fichiers statiques sont immédiatement servis dans leur nouvelle version.
Il n'y a pas de build et pas de redémarrage Nginx à faire pour une simple mise
à jour des fichiers. Recharge la page dans le navigateur. `--ff-only` refuse
une mise à jour si des commits locaux ont fait diverger le serveur du dépôt.
Fais les modifications sur ton ordinateur, puis utilise le serveur pour déployer.

Les modifications réalisées dans Sites ne sont **pas automatiquement synchronisées**
avec le nouveau dépôt GitHub. Pour ce flux, il faudra y pousser les nouvelles
sources avant de lancer `git pull` sur le serveur.

## Données et premier lancement

Changer de domaine ne transfère pas les scores déjà enregistrés dans un autre
navigateur ou sur une autre origine. Le Hall of Fame reste propre au navigateur.
L'intro est mémorisée dans `sessionStorage` après START ; un rechargement dans le
même onglet ouvre directement le jeu. Un nouvel onglet indépendant ou une nouvelle
session permet de revoir l'introduction.
