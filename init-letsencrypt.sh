#!/bin/bash
# CERTBOT/LET'S ENCRYPT DEPRECATED
#
# This helper previously provisioned Let's Encrypt certificates using the
# `nginx` + `certbot` Docker services. TLS termination has been moved to a
# Google HTTPS Load Balancer which manages certificates for you. Keep this
# file only for historical reference; it is now a no-op.

echo "This repository no longer uses certbot or Let's Encrypt locally."
echo "TLS is terminated by the Google HTTPS Load Balancer."
exit 0