#!/bin/bash

set -e
set -x

if ! [ -x "$(command -v docker)" ]; then
  echo 'Error: docker compose is not installed.' >&2
  exit 1
fi

domains=(battleforge.app closet.battleforge.app)
rsa_key_size=4096
data_path="./data/certbot"
email="fishgills@fishgills.net" # Adding a valid address is strongly recommended
staging=0 # Set to 1 if you're testing your setup to avoid hitting request limits

# Use the first domain as the certificate lineage name and live path folder
CERT_NAME="${domains[0]}"

# if [ -d "$data_path" ]; then
#   read -p "Existing data found for $domains. Continue and replace existing certificate? (y/N) " decision
#   if [ "$decision" != "Y" ] && [ "$decision" != "y" ]; then
#     exit
#   fi
# fi


if [ ! -e "$data_path/conf/options-ssl-nginx.conf" ] || [ ! -e "$data_path/conf/ssl-dhparams.pem" ]; then
  echo "### Downloading recommended TLS parameters ..."
  mkdir -p "$data_path/conf"
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf > "$data_path/conf/options-ssl-nginx.conf"
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem > "$data_path/conf/ssl-dhparams.pem"
  echo
fi

echo "### Creating dummy certificate for $CERT_NAME ..."
path="/etc/letsencrypt/live/$CERT_NAME"
mkdir -p "$data_path/conf/live/$CERT_NAME"
docker compose run --rm --entrypoint "\
  openssl req -x509 -nodes -newkey rsa:$rsa_key_size -days 1\
    -keyout '$path/privkey.pem' \
    -out '$path/fullchain.pem' \
    -subj '/CN=localhost'" certbot
echo


echo "### Starting nginx ..."
docker compose up --force-recreate -d nginx
echo

echo "### Deleting any existing certificate lineages for $CERT_NAME (including -000X) ..."
docker compose run --rm --entrypoint "\
  sh -c 'set -e; \
  rm -rf /etc/letsencrypt/live/${CERT_NAME}* || true; \
  rm -rf /etc/letsencrypt/archive/${CERT_NAME}* || true; \
  rm -rf /etc/letsencrypt/renewal/${CERT_NAME}*.conf || true'" certbot
echo


echo "### Requesting Let's Encrypt certificate for $domains ..."
#Join $domains to -d args
domain_args=""
for domain in "${domains[@]}"; do
  domain_args="$domain_args -d $domain"
done

# Select appropriate email arg
case "$email" in
  "") email_arg="--register-unsafely-without-email" ;;
  *) email_arg="--email $email" ;;
esac

# Enable staging mode if needed
if [ $staging != "0" ]; then staging_arg="--staging"; fi

docker compose run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
    $staging_arg \
    $email_arg \
    $domain_args \
    --cert-name ${CERT_NAME} \
    --rsa-key-size $rsa_key_size \
    --agree-tos \
    --force-renewal" certbot
echo

echo "### Testing nginx config ..."
if ! docker compose exec nginx nginx -t; then
  echo "Nginx configuration test failed. See errors above."
  exit 1
fi

echo "### Reloading nginx ..."
docker compose exec nginx nginx -s reload