# Healthcare Service Log Portal - Production Deployment Guide

This guide provides comprehensive instructions for deploying the Healthcare Service Log Portal to production environments with HIPAA compliance and enterprise-grade security.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Security Configuration](#security-configuration)
4. [Database Setup](#database-setup)
5. [Docker Deployment](#docker-deployment)
6. [SSL/TLS Configuration](#ssltls-configuration)
7. [Monitoring Setup](#monitoring-setup)
8. [Backup and Recovery](#backup-and-recovery)
9. [CI/CD Pipeline](#cicd-pipeline)
10. [HIPAA Compliance](#hipaa-compliance)
11. [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements

- **OS**: Ubuntu 20.04+ LTS / CentOS 8+ / RHEL 8+
- **CPU**: 4+ cores (8+ cores recommended)
- **RAM**: 8GB minimum (16GB+ recommended)
- **Storage**: 100GB+ SSD storage
- **Network**: Dedicated static IP with firewall

### Software Requirements

- Docker Engine 24.0+
- Docker Compose 2.0+
- Nginx 1.20+
- OpenSSL 1.1.1+
- Git 2.30+

### Installation Commands

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt install docker-compose-plugin

# Install Nginx
sudo apt install nginx

# Install OpenSSL
sudo apt install openssl

# Verify installations
docker --version
docker compose version
nginx -v
openssl version
```

## Environment Setup

### 1. Clone Repository

```bash
git clone https://github.com/your-org/healthcare-portal.git
cd healthcare-portal
```

### 2. Configure Environment Variables

Copy and configure the production environment file:

```bash
cp .env.production .env
```

**CRITICAL**: Edit `.env` and replace all default values:

```bash
# Generate secure secrets
openssl rand -base64 64  # For JWT_SECRET
openssl rand -base64 64  # For JWT_REFRESH_SECRET
openssl rand -base64 32  # For DB_ENCRYPTION_KEY

# Edit configuration
sudo nano .env
```

### 3. Set File Permissions

```bash
# Secure environment file
chmod 600 .env

# Create required directories
sudo mkdir -p /app/{data,backups,logs,uploads}
sudo chown -R $USER:$USER /app
chmod 755 /app/{data,backups,logs,uploads}
```

## Security Configuration

### 1. Generate SSL Certificates

#### Option A: Let's Encrypt (Recommended)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Generate certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Verify auto-renewal
sudo certbot renew --dry-run
```

#### Option B: Self-Signed (Development Only)

```bash
# Generate private key
openssl genrsa -out healthcare-portal.key 4096

# Generate certificate
openssl req -new -x509 -key healthcare-portal.key -out healthcare-portal.crt -days 365

# Move to appropriate location
sudo mv healthcare-portal.* /etc/ssl/private/
sudo chmod 600 /etc/ssl/private/healthcare-portal.*
```

### 2. Configure Firewall

```bash
# Enable UFW
sudo ufw enable

# Allow SSH
sudo ufw allow ssh

# Allow HTTP/HTTPS
sudo ufw allow 80
sudo ufw allow 443

# Allow application port (internal only)
sudo ufw allow from 127.0.0.1 to any port 3001

# Check status
sudo ufw status
```

### 3. Configure Nginx

```bash
# Copy Nginx configuration
sudo cp nginx/nginx.conf /etc/nginx/nginx.conf

# Create site configuration
sudo ln -sf /etc/nginx/sites-available/healthcare-portal /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

## Database Setup

### 1. Create Database Directories

```bash
sudo mkdir -p /app/data/database
sudo chown -R $USER:$USER /app/data
chmod 755 /app/data/database
```

### 2. Initialize Database

```bash
# Start database container temporarily
docker compose up healthcare-portal -d

# Run initial setup
docker compose exec healthcare-portal npm run db:migrate

# Stop temporary container
docker compose down
```

### 3. Configure Backup System

```bash
# Create backup script
sudo cp scripts/backup-database.sh /usr/local/bin/
sudo chmod +x /usr/local/bin/backup-database.sh

# Add to crontab
echo "0 2 * * * /usr/local/bin/backup-database.sh" | sudo crontab -
```

## Docker Deployment

### 1. Build and Deploy

```bash
# Make deployment script executable
chmod +x deploy.sh

# Run deployment
./deploy.sh deploy
```

### 2. Manual Deployment Steps

```bash
# Build images
docker compose build --no-cache

# Start services
docker compose up -d

# Verify services
docker compose ps
docker compose logs healthcare-portal
```

### 3. Health Check

```bash
# Check application health
curl -f http://localhost:3001/api/health/basic
curl -f http://localhost:3001/api/health/database
curl -f http://localhost:3001/api/health/detailed
```

## SSL/TLS Configuration

### 1. Configure SSL in Application

Update `.env` file:

```bash
SSL_CERT_PATH=/etc/ssl/certs/healthcare-portal.crt
SSL_KEY_PATH=/etc/ssl/private/healthcare-portal.key
FORCE_HTTPS=true
HSTS_MAX_AGE=31536000
```

### 2. Update Nginx SSL Configuration

Edit `/etc/nginx/sites-available/healthcare-portal`:

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /etc/ssl/certs/healthcare-portal.crt;
    ssl_certificate_key /etc/ssl/private/healthcare-portal.key;
    
    # Additional SSL configuration in nginx/nginx.conf
}
```

## Monitoring Setup

### 1. Start Monitoring Services

```bash
# Start Prometheus monitoring
docker compose up healthcare-monitor -d

# Verify monitoring
curl http://localhost:9090/metrics
```

### 2. Configure Alerts

```bash
# Edit alert rules
sudo nano monitoring/alert_rules.yml

# Restart monitoring
docker compose restart healthcare-monitor
```

### 3. Set Up Log Rotation

```bash
# Configure logrotate
sudo cp scripts/healthcare-logrotate /etc/logrotate.d/healthcare-portal

# Test log rotation
sudo logrotate -d /etc/logrotate.d/healthcare-portal
```

## Backup and Recovery

### 1. Automated Backups

Backups run automatically via Docker Compose. To verify:

```bash
# Check backup service
docker compose logs healthcare-backup

# List backups
ls -la /app/backups/
```

### 2. Manual Backup

```bash
# Create manual backup
sqlite3 /app/data/healthcare.db ".backup /app/backups/manual-$(date +%Y%m%d-%H%M%S).db"
```

### 3. Restore from Backup

```bash
# Stop application
docker compose down

# Restore database
cp /app/backups/healthcare-20231201-120000.db /app/data/healthcare.db

# Start application
docker compose up -d
```

## CI/CD Pipeline

### 1. GitHub Actions Setup

The repository includes a comprehensive CI/CD pipeline in `.github/workflows/deploy.yml`.

Required secrets in GitHub:

- `DOCKER_USERNAME`
- `DOCKER_PASSWORD`
- `SLACK_WEBHOOK`
- Production environment variables

### 2. Manual Pipeline Trigger

```bash
# Deploy to staging
gh workflow run deploy.yml -f environment=staging

# Deploy to production
gh workflow run deploy.yml -f environment=production
```

## HIPAA Compliance

### 1. Compliance Checklist

- ✅ Encryption at rest (database)
- ✅ Encryption in transit (HTTPS/TLS)
- ✅ Audit logging enabled
- ✅ Access controls implemented
- ✅ Data retention policies
- ✅ Security monitoring
- ✅ Backup and recovery procedures

### 2. Audit Log Verification

```bash
# Check audit logs
docker compose exec healthcare-portal ls -la /app/logs/audit/

# View audit entries
docker compose exec healthcare-portal tail -f /app/logs/audit/hipaa-audit.log
```

### 3. Compliance Monitoring

```bash
# Run compliance check
curl http://localhost:3001/api/monitoring/compliance-metrics
```

## Troubleshooting

### Common Issues

#### 1. Application Won't Start

```bash
# Check logs
docker compose logs healthcare-portal

# Check database connection
docker compose exec healthcare-portal npm run db:health

# Verify environment variables
docker compose exec healthcare-portal env | grep -E "JWT_|DB_|CORS_"
```

#### 2. SSL Certificate Issues

```bash
# Test SSL configuration
openssl s_client -connect your-domain.com:443

# Check certificate validity
openssl x509 -in /etc/ssl/certs/healthcare-portal.crt -text -noout

# Verify Nginx configuration
sudo nginx -t
```

#### 3. Database Connection Errors

```bash
# Check database file permissions
ls -la /app/data/healthcare.db

# Test database connectivity
sqlite3 /app/data/healthcare.db "SELECT 1;"

# Check database health
curl http://localhost:3001/api/health/database
```

#### 4. Performance Issues

```bash
# Check system resources
docker stats

# Monitor database performance
curl http://localhost:3001/api/monitoring/database-metrics

# Check application metrics
curl http://localhost:3001/api/monitoring/performance-metrics
```

### Emergency Procedures

#### 1. Application Rollback

```bash
# Immediate rollback
./deploy.sh rollback
```

#### 2. Database Recovery

```bash
# Stop services
docker compose down

# Restore from backup
cp /app/backups/latest-backup.db /app/data/healthcare.db

# Start services
docker compose up -d
```

#### 3. Emergency Maintenance Mode

```bash
# Enable maintenance mode in Nginx
sudo cp nginx/maintenance.html /var/www/html/
sudo systemctl reload nginx
```

## Support and Maintenance

### Regular Maintenance Tasks

- **Daily**: Check application logs and health status
- **Weekly**: Review security logs and audit trails
- **Monthly**: Update dependencies and security patches
- **Quarterly**: Review and rotate secrets/certificates
- **Annually**: Conduct security audit and compliance review

### Contact Information

- **Technical Support**: support@healthcare-portal.com
- **Security Issues**: security@healthcare-portal.com
- **Emergency Contact**: +1-xxx-xxx-xxxx

---

**Note**: This is a production deployment guide. Always test deployments in a staging environment first. Ensure all security requirements are met before handling any PHI (Protected Health Information).