#!/bin/bash

# Healthcare Service Log Portal - Production Deployment Script
# Automated deployment with security checks and rollback capability

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_NAME="healthcare-portal"
BACKUP_DIR="/opt/healthcare-backups"
LOG_FILE="/var/log/healthcare-deploy.log"
HEALTH_CHECK_URL="http://localhost:3001/api/health/basic"
MAX_ROLLBACK_ATTEMPTS=3

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

# Check if running as root (for production deployment)
check_permissions() {
    if [[ $EUID -eq 0 ]]; then
        warning "Running as root. Consider using a dedicated deployment user for security."
    fi
    
    if [[ ! -w "$LOG_FILE" ]]; then
        touch "$LOG_FILE" 2>/dev/null || {
            error "Cannot write to log file: $LOG_FILE"
            exit 1
        }
    fi
}

# Verify prerequisites
check_prerequisites() {
    log "Checking deployment prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        error "Docker is required but not installed"
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        error "Docker Compose is required but not installed"
        exit 1
    fi
    
    # Check if .env.production exists
    if [[ ! -f "$SCRIPT_DIR/.env.production" ]]; then
        error ".env.production file not found. Please create it from .env.production template"
        exit 1
    fi
    
    # Verify critical environment variables
    source "$SCRIPT_DIR/.env.production"
    if [[ -z "${JWT_SECRET:-}" || "$JWT_SECRET" == "CHANGE-THIS-TO-A-SECURE-64-CHARACTER-SECRET-KEY-FOR-PRODUCTION" ]]; then
        error "JWT_SECRET must be changed from default value in .env.production"
        exit 1
    fi
    
    if [[ -z "${JWT_REFRESH_SECRET:-}" || "$JWT_REFRESH_SECRET" == "CHANGE-THIS-TO-A-DIFFERENT-SECURE-64-CHARACTER-REFRESH-SECRET" ]]; then
        error "JWT_REFRESH_SECRET must be changed from default value in .env.production"
        exit 1
    fi
    
    success "Prerequisites check passed"
}

# Security validation
security_check() {
    log "Performing security validation..."
    
    # Check file permissions
    chmod 600 "$SCRIPT_DIR/.env.production"
    
    # Verify SSL certificates exist (if SSL is configured)
    if [[ "${FORCE_HTTPS:-}" == "true" ]]; then
        if [[ ! -f "${SSL_CERT_PATH:-}" ]] || [[ ! -f "${SSL_KEY_PATH:-}" ]]; then
            warning "HTTPS is enabled but SSL certificates not found. Ensure certificates are properly configured."
        fi
    fi
    
    # Check for secrets in Git
    if git status &>/dev/null; then
        if git ls-files | grep -q "\.env\.production$"; then
            error ".env.production is tracked in Git. Remove it and add to .gitignore"
            exit 1
        fi
    fi
    
    success "Security validation passed"
}

# Create backup of current deployment
backup_current() {
    log "Creating backup of current deployment..."
    
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_PATH="$BACKUP_DIR/backup_$TIMESTAMP"
    
    mkdir -p "$BACKUP_PATH"
    
    # Backup database
    if [[ -f "/app/data/healthcare.db" ]]; then
        cp "/app/data/healthcare.db" "$BACKUP_PATH/"
    fi
    
    # Backup docker-compose file
    if [[ -f "$SCRIPT_DIR/docker-compose.yml" ]]; then
        cp "$SCRIPT_DIR/docker-compose.yml" "$BACKUP_PATH/"
    fi
    
    # Store current image IDs for rollback
    docker images --format "table {{.Repository}}:{{.Tag}}\t{{.ID}}" | grep "$PROJECT_NAME" > "$BACKUP_PATH/image_ids.txt" || true
    
    echo "$BACKUP_PATH" > "$SCRIPT_DIR/.last_backup"
    
    success "Backup created at $BACKUP_PATH"
}

# Pull and build new images
build_images() {
    log "Building new Docker images..."
    
    # Set production environment for build
    export NODE_ENV=production
    
    # Build with no cache to ensure fresh build
    docker-compose -f docker-compose.yml build --no-cache --pull
    
    success "Docker images built successfully"
}

# Health check function
health_check() {
    local max_attempts=30
    local attempt=1
    
    log "Performing health check..."
    
    while [[ $attempt -le $max_attempts ]]; do
        if curl -f -s "$HEALTH_CHECK_URL" > /dev/null; then
            success "Health check passed"
            return 0
        fi
        
        log "Health check attempt $attempt/$max_attempts failed, waiting 10 seconds..."
        sleep 10
        ((attempt++))
    done
    
    error "Health check failed after $max_attempts attempts"
    return 1
}

# Database migration
migrate_database() {
    log "Running database migrations..."
    
    # Run migrations in the container
    docker-compose exec -T healthcare-portal npm run db:migrate
    
    success "Database migrations completed"
}

# Deploy application
deploy() {
    log "Starting deployment..."
    
    # Copy environment file
    cp "$SCRIPT_DIR/.env.production" "$SCRIPT_DIR/.env"
    
    # Start services with zero-downtime deployment strategy
    docker-compose -f docker-compose.yml up -d --remove-orphans
    
    # Wait for services to be ready
    sleep 30
    
    # Run database migrations
    migrate_database
    
    # Perform health check
    if ! health_check; then
        error "Deployment failed health check"
        return 1
    fi
    
    success "Deployment completed successfully"
}

# Rollback function
rollback() {
    local rollback_attempt=1
    
    error "Deployment failed, initiating rollback..."
    
    if [[ ! -f "$SCRIPT_DIR/.last_backup" ]]; then
        error "No backup information found for rollback"
        return 1
    fi
    
    local backup_path
    backup_path=$(cat "$SCRIPT_DIR/.last_backup")
    
    while [[ $rollback_attempt -le $MAX_ROLLBACK_ATTEMPTS ]]; do
        log "Rollback attempt $rollback_attempt/$MAX_ROLLBACK_ATTEMPTS"
        
        # Stop current services
        docker-compose down
        
        # Restore database
        if [[ -f "$backup_path/healthcare.db" ]]; then
            cp "$backup_path/healthcare.db" "/app/data/"
        fi
        
        # Restore docker-compose if available
        if [[ -f "$backup_path/docker-compose.yml" ]]; then
            cp "$backup_path/docker-compose.yml" "$SCRIPT_DIR/"
        fi
        
        # Restart services
        docker-compose up -d
        
        # Wait and check health
        sleep 30
        if health_check; then
            success "Rollback completed successfully"
            return 0
        fi
        
        ((rollback_attempt++))
    done
    
    error "Rollback failed after $MAX_ROLLBACK_ATTEMPTS attempts"
    return 1
}

# Cleanup old backups and images
cleanup() {
    log "Cleaning up old backups and images..."
    
    # Remove backups older than 30 days
    find "$BACKUP_DIR" -type d -name "backup_*" -mtime +30 -exec rm -rf {} \; 2>/dev/null || true
    
    # Remove dangling images
    docker image prune -f
    
    success "Cleanup completed"
}

# Post-deployment verification
verify_deployment() {
    log "Verifying deployment..."
    
    # Check all services are running
    if ! docker-compose ps | grep -q "Up"; then
        error "Some services are not running"
        return 1
    fi
    
    # Verify API endpoints
    local endpoints=("/api/health/basic" "/api/health/database" "/api/health/detailed")
    
    for endpoint in "${endpoints[@]}"; do
        if ! curl -f -s "http://localhost:3001$endpoint" > /dev/null; then
            error "Endpoint $endpoint is not responding"
            return 1
        fi
    done
    
    # Check logs for errors
    if docker-compose logs healthcare-portal | grep -i error | grep -v "test\|debug"; then
        warning "Errors found in application logs"
    fi
    
    success "Deployment verification passed"
}

# Main deployment process
main() {
    log "Starting Healthcare Portal deployment process"
    
    # Create log directory if it doesn't exist
    mkdir -p "$(dirname "$LOG_FILE")"
    
    check_permissions
    check_prerequisites
    security_check
    
    # Create backup
    mkdir -p "$BACKUP_DIR"
    backup_current
    
    # Deploy
    if build_images && deploy && verify_deployment; then
        success "Healthcare Portal deployment completed successfully!"
        cleanup
        
        # Send notification (if configured)
        log "Deployment completed at $(date)"
    else
        error "Deployment failed"
        if rollback; then
            warning "System rolled back to previous version"
        else
            error "CRITICAL: Rollback failed. Manual intervention required!"
        fi
        exit 1
    fi
}

# Script options
case "${1:-}" in
    "deploy")
        main
        ;;
    "rollback")
        rollback
        ;;
    "health-check")
        health_check
        ;;
    "cleanup")
        cleanup
        ;;
    *)
        echo "Usage: $0 {deploy|rollback|health-check|cleanup}"
        echo ""
        echo "Commands:"
        echo "  deploy      - Deploy the healthcare portal"
        echo "  rollback    - Rollback to previous version"
        echo "  health-check- Check application health"
        echo "  cleanup     - Clean up old backups and images"
        exit 1
        ;;
esac