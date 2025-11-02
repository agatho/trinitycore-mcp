#!/bin/bash
# SSL Certificate Setup Script for TrinityCore MCP Server
# Supports Let's Encrypt (certbot) and self-signed certificates

set -e

# Configuration
DOMAIN="mcp.trinitycore.local"
EMAIL="admin@trinitycore.local"
SSL_DIR="/etc/nginx/ssl"
CERTBOT_DIR="/var/www/certbot"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}TrinityCore MCP Server - SSL Setup${NC}"
echo "=================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Error: This script must be run as root${NC}"
    exit 1
fi

# Create SSL directory
mkdir -p "$SSL_DIR"
mkdir -p "$CERTBOT_DIR"

# Function: Generate self-signed certificate
generate_self_signed() {
    echo -e "${YELLOW}Generating self-signed certificate...${NC}"

    openssl req -x509 -nodes -days 365 -newkey rsa:4096 \
        -keyout "$SSL_DIR/privkey.pem" \
        -out "$SSL_DIR/fullchain.pem" \
        -subj "/C=US/ST=State/L=City/O=TrinityCore/OU=MCP/CN=$DOMAIN"

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Self-signed certificate generated successfully${NC}"
        echo "Certificate: $SSL_DIR/fullchain.pem"
        echo "Private key: $SSL_DIR/privkey.pem"
        echo ""
        echo -e "${YELLOW}Warning: Self-signed certificates are not trusted by browsers${NC}"
        echo "Use Let's Encrypt for production deployments"
    else
        echo -e "${RED}Failed to generate self-signed certificate${NC}"
        exit 1
    fi
}

# Function: Setup Let's Encrypt certificate
setup_letsencrypt() {
    echo -e "${YELLOW}Setting up Let's Encrypt certificate...${NC}"

    # Check if certbot is installed
    if ! command -v certbot &> /dev/null; then
        echo -e "${YELLOW}Installing certbot...${NC}"
        if command -v apt-get &> /dev/null; then
            apt-get update
            apt-get install -y certbot
        elif command -v yum &> /dev/null; then
            yum install -y certbot
        else
            echo -e "${RED}Error: Package manager not supported${NC}"
            exit 1
        fi
    fi

    # Obtain certificate
    certbot certonly --webroot \
        -w "$CERTBOT_DIR" \
        -d "$DOMAIN" \
        --email "$EMAIL" \
        --agree-tos \
        --non-interactive

    if [ $? -eq 0 ]; then
        # Create symlinks to cert files
        ln -sf "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" "$SSL_DIR/fullchain.pem"
        ln -sf "/etc/letsencrypt/live/$DOMAIN/privkey.pem" "$SSL_DIR/privkey.pem"

        echo -e "${GREEN}Let's Encrypt certificate obtained successfully${NC}"
        echo "Certificate will auto-renew before expiration"

        # Setup auto-renewal cron job
        (crontab -l 2>/dev/null; echo "0 0,12 * * * certbot renew --quiet") | crontab -
        echo "Auto-renewal cron job installed"
    else
        echo -e "${RED}Failed to obtain Let's Encrypt certificate${NC}"
        echo "Falling back to self-signed certificate..."
        generate_self_signed
    fi
}

# Function: Verify certificate
verify_certificate() {
    echo -e "${YELLOW}Verifying certificate...${NC}"

    if [ ! -f "$SSL_DIR/fullchain.pem" ] || [ ! -f "$SSL_DIR/privkey.pem" ]; then
        echo -e "${RED}Error: Certificate files not found${NC}"
        exit 1
    fi

    # Check certificate details
    openssl x509 -in "$SSL_DIR/fullchain.pem" -text -noout | head -20

    # Check if certificate matches private key
    CERT_MODULUS=$(openssl x509 -noout -modulus -in "$SSL_DIR/fullchain.pem" | openssl md5)
    KEY_MODULUS=$(openssl rsa -noout -modulus -in "$SSL_DIR/privkey.pem" | openssl md5)

    if [ "$CERT_MODULUS" = "$KEY_MODULUS" ]; then
        echo -e "${GREEN}Certificate and private key match${NC}"
    else
        echo -e "${RED}Error: Certificate and private key do not match${NC}"
        exit 1
    fi

    # Set correct permissions
    chmod 644 "$SSL_DIR/fullchain.pem"
    chmod 600 "$SSL_DIR/privkey.pem"

    echo -e "${GREEN}Certificate verification completed${NC}"
}

# Main menu
echo "Select SSL certificate type:"
echo "1) Let's Encrypt (recommended for production)"
echo "2) Self-signed (development/testing only)"
echo "3) Use existing certificate"
echo ""
read -p "Enter choice [1-3]: " choice

case $choice in
    1)
        setup_letsencrypt
        verify_certificate
        ;;
    2)
        generate_self_signed
        verify_certificate
        ;;
    3)
        echo "Using existing certificate"
        verify_certificate
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}SSL setup completed!${NC}"
echo "Restart NGINX to apply changes:"
echo "  docker-compose restart nginx"
echo ""
