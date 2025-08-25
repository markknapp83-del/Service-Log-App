# Healthcare Service Log Portal - Quick Production Setup Guide

This guide provides step-by-step instructions for deploying the Healthcare Service Log Portal to production with HIPAA compliance and enterprise security.

## Quick Start (5 Minutes)

### 1. Prerequisites Check
```bash
# Verify required software
docker --version          # Should be 24.0+
docker compose version    # Should be 2.0+
curl --version            # For health checks
openssl version           # For certificate management
```

### 2. Clone and Configure
```bash
# Clone repository
git clone https://github.com/your-org/healthcare-portal.git
cd healthcare-portal

# Set up production environment
cp .env.production .env

# CRITICAL: Edit .env and change all default secrets
nano .env
```

**Required Changes in .env:**
```bash
# Generate secure secrets
openssl rand -base64 64  # Use output for JWT_SECRET
openssl rand -base64 64  # Use output for JWT_REFRESH_SECRET

# Update these values in .env:
JWT_SECRET=your-generated-secret-here
JWT_REFRESH_SECRET=your-different-secret-here
CORS_ORIGIN=https://your-domain.com
```

### 3. Deploy
```bash
# Make deployment script executable
chmod +x deploy.sh

# Run production deployment
./deploy.sh deploy
```

### 4. Verify Deployment
```bash
# Check application health
curl -f http://localhost:3001/api/health/basic

# Check all services are running
docker compose ps
```

**That's it!** Your healthcare portal is now running with production-grade security.

## Detailed Setup Options

### Option A: Docker Compose (Recommended for Single Server)

#### Production Deployment
```bash
# Use production compose file
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Monitor logs
docker compose logs -f healthcare-portal
```

#### Development Deployment
```bash
# Use development overrides
docker compose up -d

# Access at http://localhost:3005 (frontend) and http://localhost:3001 (backend)
```

### Option B: Kubernetes (Recommended for Clusters)

```bash
# Create namespace and deploy
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/pvc.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml

# Check deployment
kubectl get pods -n healthcare-portal
```

### Option C: AWS ECS with Terraform

```bash
# Configure Terraform
cd terraform
terraform init

# Plan and apply
terraform plan -var="environment=production"
terraform apply
```

## SSL/HTTPS Setup

### Option 1: Let's Encrypt (Free)
```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Generate certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal is configured automatically
```

### Option 2: Custom Certificate
```bash
# Place your certificate files
sudo cp your-cert.crt /etc/ssl/certs/healthcare-portal.crt
sudo cp your-key.key /etc/ssl/private/healthcare-portal.key
sudo chmod 600 /etc/ssl/private/healthcare-portal.key

# Update nginx configuration
sudo cp nginx/nginx.conf /etc/nginx/nginx.conf
sudo systemctl restart nginx
```

## Monitoring Setup

### Basic Monitoring (Included)
```bash
# Prometheus metrics available at
curl http://localhost:3001/api/monitoring/metrics

# Health checks
curl http://localhost:3001/api/health/detailed
```

### Advanced Monitoring
```bash
# Start monitoring stack
docker compose up healthcare-monitor -d

# Access Prometheus at http://localhost:9090
# Configure Grafana dashboards as needed
```

## Security Configuration

### Firewall Setup
```bash
# Enable firewall
sudo ufw enable

# Allow necessary ports
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443

# Block application port from external access
sudo ufw deny 3001
```

### Security Headers Verification
```bash
# Test security headers
curl -I https://your-domain.com

# Should see headers like:
# Strict-Transport-Security: max-age=31536000
# X-Frame-Options: DENY
# X-Content-Type-Options: nosniff
```

## Backup Configuration

### Automated Backups (Included)
```bash
# Backup service runs automatically via Docker Compose
docker compose logs healthcare-backup

# Manual backup
./scripts/backup-database.sh backup
```

### Backup Verification
```bash
# List backups
ls -la /app/backups/

# Verify backup integrity
./scripts/backup-database.sh verify /app/backups/healthcare-20231201-120000.tar.gz.enc
```

## Common Deployment Scenarios

### Scenario 1: Small Practice (Single Server)
```bash
# Use Docker Compose with minimal resources
docker compose -f docker-compose.yml up -d

# Suitable for <100 users
# Requires 4GB RAM, 2 CPU cores minimum
```

### Scenario 2: Multi-Location Practice (Load Balanced)
```bash
# Use Kubernetes or multiple Docker servers
# Configure load balancer (nginx/AWS ALB)
# Set up database replication if needed
```

### Scenario 3: Enterprise Healthcare System
```bash
# Use Kubernetes cluster
# Configure high availability
# Set up monitoring and alerting
# Implement disaster recovery
```

## Environment-Specific Configurations

### Staging Environment
```bash
# Use staging configuration
cp .env.production .env.staging
# Modify for staging-specific settings
docker compose -f docker-compose.yml -f docker-compose.staging.yml up -d
```

### Development Environment
```bash
# Use development overrides
docker compose up -d
# Hot reloading enabled
# Debug logging enabled
```

## Troubleshooting

### Common Issues

#### Issue: Application won't start
```bash
# Check logs
docker compose logs healthcare-portal

# Common causes:
# - Wrong environment variables
# - Database connection issues
# - Port conflicts
```

#### Issue: SSL certificate errors
```bash
# Verify certificate
openssl x509 -in /etc/ssl/certs/healthcare-portal.crt -text -noout

# Check nginx configuration
sudo nginx -t
```

#### Issue: Database connection failures
```bash
# Check database file permissions
ls -la /app/data/healthcare.db

# Should be owned by application user with 600 permissions
```

### Health Check Commands
```bash
# Comprehensive health check
./scripts/health-check.sh check

# Continuous monitoring
./scripts/health-check.sh monitor 60

# With retry logic
./scripts/health-check.sh retry
```

## Performance Tuning

### Database Optimization
```bash
# Already configured in production:
# - WAL mode for concurrency
# - Optimized cache size
# - Memory-mapped I/O
# - Proper indexing
```

### Application Optimization
```bash
# Already configured:
# - Response compression
# - Static asset optimization
# - Connection pooling
# - Caching strategies
```

## Security Best Practices

### Implemented Security Features
- ✅ HTTPS/TLS encryption
- ✅ JWT authentication with secure secrets  
- ✅ Rate limiting and DDoS protection
- ✅ Input validation and sanitization
- ✅ SQL injection prevention
- ✅ XSS protection
- ✅ CSRF protection
- ✅ Security headers (HSTS, CSP, etc.)
- ✅ Audit logging
- ✅ Data encryption at rest
- ✅ HIPAA compliance measures

### Additional Security Steps
```bash
# Regular security updates
sudo apt update && sudo apt upgrade

# Monitor security logs
tail -f /var/log/healthcare-security.log

# Regular backup verification
./scripts/backup-database.sh verify
```

## Compliance Features

### HIPAA Compliance
- ✅ Audit logging (7-year retention)
- ✅ Data encryption (at rest and in transit)
- ✅ Access controls and authentication
- ✅ Data integrity and availability
- ✅ Risk assessment capabilities
- ✅ Breach detection and reporting

### Monitoring and Alerting
- ✅ Failed authentication attempts
- ✅ Unauthorized access attempts  
- ✅ Data access monitoring
- ✅ System performance monitoring
- ✅ Backup monitoring
- ✅ SSL certificate expiry monitoring

## Support and Maintenance

### Regular Maintenance Tasks
- **Daily**: Check logs and system health
- **Weekly**: Review security events and performance metrics
- **Monthly**: Update dependencies and security patches
- **Quarterly**: Rotate secrets and review security configuration

### Support Contacts
- **Technical Issues**: Create GitHub issue or contact support team
- **Security Concerns**: Contact security team immediately
- **Compliance Questions**: Consult with compliance officer

### Documentation References
- [Deployment Guide](./DEPLOYMENT.md) - Comprehensive deployment documentation
- [Production Checklist](./PRODUCTION_CHECKLIST.md) - Pre-deployment verification
- [API Documentation](./API_DOCUMENTATION.md) - API reference
- [Security Documentation](./SECURITY_IMPLEMENTATION_SUMMARY.md) - Security details

---

**Need Help?** 

1. Check the [troubleshooting section](#troubleshooting) above
2. Review logs: `docker compose logs healthcare-portal`
3. Run health checks: `./scripts/health-check.sh check`
4. Consult the detailed [DEPLOYMENT.md](./DEPLOYMENT.md) guide
5. Create an issue in the repository for additional support

**Security Note**: This system handles Protected Health Information (PHI). Ensure all security and compliance requirements are met before production deployment.