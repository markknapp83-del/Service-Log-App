#!/bin/bash

# Healthcare Service Log Portal - Database Backup Script
# HIPAA-compliant backup with encryption and secure storage

set -euo pipefail

# Configuration
BACKUP_DIR="/app/backups"
DATABASE_PATH="/app/data/healthcare.db"
AUDIT_DATABASE_PATH="/app/data/audit.db"
ENCRYPTION_KEY_FILE="/etc/healthcare/backup.key"
RETENTION_DAYS=2555  # 7 years for HIPAA compliance
LOG_FILE="/var/log/healthcare-backup.log"
BACKUP_PREFIX="healthcare"
DATE_FORMAT="%Y%m%d_%H%M%S"

# S3 Configuration (optional)
S3_BUCKET="${S3_BACKUP_BUCKET:-}"
AWS_REGION="${AWS_REGION:-us-east-1}"

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

# Create backup directory if it doesn't exist
create_backup_dir() {
    if [[ ! -d "$BACKUP_DIR" ]]; then
        mkdir -p "$BACKUP_DIR"
        chmod 750 "$BACKUP_DIR"
    fi
}

# Check if database files exist
check_database_files() {
    if [[ ! -f "$DATABASE_PATH" ]]; then
        error "Primary database file not found: $DATABASE_PATH"
        return 1
    fi
    
    if [[ ! -f "$AUDIT_DATABASE_PATH" ]]; then
        warning "Audit database file not found: $AUDIT_DATABASE_PATH"
    fi
    
    return 0
}

# Create encrypted backup
create_backup() {
    local timestamp
    timestamp=$(date +"$DATE_FORMAT")
    
    local backup_name="${BACKUP_PREFIX}_${timestamp}"
    local backup_path="${BACKUP_DIR}/${backup_name}"
    local temp_dir="/tmp/healthcare_backup_$$"
    
    log "Starting backup: $backup_name"
    
    # Create temporary directory
    mkdir -p "$temp_dir"
    
    try {
        # Backup primary database
        log "Backing up primary database..."
        sqlite3 "$DATABASE_PATH" ".backup ${temp_dir}/healthcare.db"
        
        # Backup audit database if it exists
        if [[ -f "$AUDIT_DATABASE_PATH" ]]; then
            log "Backing up audit database..."
            sqlite3 "$AUDIT_DATABASE_PATH" ".backup ${temp_dir}/audit.db"
        fi
        
        # Create metadata file
        cat > "${temp_dir}/backup_metadata.json" << EOF
{
    "backup_name": "$backup_name",
    "timestamp": "$timestamp",
    "primary_db_size": $(stat -c%s "$DATABASE_PATH"),
    "audit_db_size": $(stat -c%s "$AUDIT_DATABASE_PATH" 2>/dev/null || echo "0"),
    "backup_version": "1.0",
    "hipaa_compliant": true,
    "retention_until": "$(date -d "+$RETENTION_DAYS days" +%Y%m%d)"
}
EOF
        
        # Create compressed archive
        log "Creating compressed archive..."
        tar -czf "${backup_path}.tar.gz" -C "$temp_dir" .
        
        # Encrypt backup if encryption key exists
        if [[ -f "$ENCRYPTION_KEY_FILE" ]]; then
            log "Encrypting backup..."
            openssl enc -aes-256-cbc -salt -pbkdf2 -iter 100000 \
                -in "${backup_path}.tar.gz" \
                -out "${backup_path}.tar.gz.enc" \
                -pass file:"$ENCRYPTION_KEY_FILE"
            
            # Remove unencrypted file
            rm "${backup_path}.tar.gz"
            backup_file="${backup_path}.tar.gz.enc"
        else
            backup_file="${backup_path}.tar.gz"
            warning "No encryption key found. Backup is not encrypted!"
        fi
        
        # Set secure permissions
        chmod 600 "$backup_file"
        
        # Calculate checksum
        sha256sum "$backup_file" > "${backup_file}.sha256"
        
        success "Backup created successfully: $(basename "$backup_file")"
        log "Backup size: $(stat -c%s "$backup_file" | numfmt --to=iec)"
        
    } catch {
        error "Backup failed: $?"
        cleanup_temp "$temp_dir"
        return 1
    }
    
    # Cleanup temporary directory
    cleanup_temp "$temp_dir"
    
    return 0
}

# Upload backup to S3 (optional)
upload_to_s3() {
    local backup_file="$1"
    
    if [[ -z "$S3_BUCKET" ]]; then
        log "S3 backup not configured, skipping upload"
        return 0
    fi
    
    if ! command -v aws &> /dev/null; then
        warning "AWS CLI not found, skipping S3 upload"
        return 0
    fi
    
    log "Uploading backup to S3..."
    
    local s3_path="s3://$S3_BUCKET/healthcare-backups/$(basename "$backup_file")"
    
    if aws s3 cp "$backup_file" "$s3_path" --region "$AWS_REGION" --storage-class GLACIER; then
        success "Backup uploaded to S3: $s3_path"
        
        # Upload checksum file
        aws s3 cp "${backup_file}.sha256" "${s3_path}.sha256" --region "$AWS_REGION"
    else
        error "Failed to upload backup to S3"
        return 1
    fi
}

# Cleanup old backups
cleanup_old_backups() {
    log "Cleaning up backups older than $RETENTION_DAYS days..."
    
    local deleted_count=0
    
    # Local cleanup
    while IFS= read -r -d '' backup_file; do
        log "Removing old backup: $(basename "$backup_file")"
        rm -f "$backup_file" "${backup_file}.sha256"
        ((deleted_count++))
    done < <(find "$BACKUP_DIR" -name "${BACKUP_PREFIX}_*.tar.gz*" -mtime +$RETENTION_DAYS -print0)
    
    # S3 cleanup (if configured)
    if [[ -n "$S3_BUCKET" ]] && command -v aws &> /dev/null; then
        log "Cleaning up old S3 backups..."
        
        # List and delete old S3 objects
        aws s3api list-objects-v2 \
            --bucket "$S3_BUCKET" \
            --prefix "healthcare-backups/$BACKUP_PREFIX" \
            --query "Contents[?LastModified<='$(date -d "-$RETENTION_DAYS days" --iso-8601)'].Key" \
            --output text | while read -r key; do
            if [[ -n "$key" ]]; then
                aws s3 rm "s3://$S3_BUCKET/$key"
                ((deleted_count++))
            fi
        done
    fi
    
    if [[ $deleted_count -gt 0 ]]; then
        success "Cleaned up $deleted_count old backup files"
    else
        log "No old backups to clean up"
    fi
}

# Verify backup integrity
verify_backup() {
    local backup_file="$1"
    
    log "Verifying backup integrity..."
    
    # Verify checksum
    if sha256sum -c "${backup_file}.sha256" --quiet; then
        success "Backup checksum verification passed"
    else
        error "Backup checksum verification failed"
        return 1
    fi
    
    # Test database integrity (if not encrypted)
    if [[ "$backup_file" != *.enc ]]; then
        local temp_dir="/tmp/verify_backup_$$"
        mkdir -p "$temp_dir"
        
        tar -xzf "$backup_file" -C "$temp_dir"
        
        if sqlite3 "$temp_dir/healthcare.db" "PRAGMA integrity_check;" | grep -q "ok"; then
            success "Database integrity verification passed"
        else
            error "Database integrity verification failed"
            rm -rf "$temp_dir"
            return 1
        fi
        
        rm -rf "$temp_dir"
    fi
    
    return 0
}

# Cleanup temporary files
cleanup_temp() {
    local temp_dir="$1"
    if [[ -d "$temp_dir" ]]; then
        rm -rf "$temp_dir"
    fi
}

# Error handling
try() {
    "$@"
}

catch() {
    case $1 in
        0) ;;  # Success, do nothing
        *) return $1 ;;  # Failure, return error code
    esac
}

# Send notification (optional)
send_notification() {
    local status="$1"
    local message="$2"
    
    # Email notification (if configured)
    if command -v mail &> /dev/null && [[ -n "${BACKUP_EMAIL:-}" ]]; then
        echo "$message" | mail -s "Healthcare Portal Backup $status" "$BACKUP_EMAIL"
    fi
    
    # Slack notification (if configured)
    if [[ -n "${SLACK_WEBHOOK:-}" ]]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"Healthcare Portal Backup $status: $message\"}" \
            "$SLACK_WEBHOOK" > /dev/null 2>&1 || true
    fi
}

# Health check before backup
pre_backup_check() {
    log "Running pre-backup health checks..."
    
    # Check database locks
    if sqlite3 "$DATABASE_PATH" "BEGIN IMMEDIATE; ROLLBACK;" 2>/dev/null; then
        success "Database is accessible and not locked"
    else
        error "Database is locked or inaccessible"
        return 1
    fi
    
    # Check disk space
    local available_space
    available_space=$(df "$BACKUP_DIR" | tail -1 | awk '{print $4}')
    local database_size
    database_size=$(stat -c%s "$DATABASE_PATH")
    
    # Ensure at least 3x database size is available
    if [[ $available_space -lt $((database_size * 3 / 1024)) ]]; then
        error "Insufficient disk space for backup"
        return 1
    fi
    
    success "Pre-backup health checks passed"
    return 0
}

# Main backup process
main() {
    log "Starting Healthcare Portal database backup process"
    
    # Create backup directory
    create_backup_dir
    
    # Pre-backup checks
    if ! pre_backup_check; then
        error "Pre-backup checks failed"
        send_notification "FAILED" "Pre-backup health checks failed"
        exit 1
    fi
    
    # Check database files
    if ! check_database_files; then
        error "Database files check failed"
        send_notification "FAILED" "Database files not found or inaccessible"
        exit 1
    fi
    
    # Create backup
    if create_backup; then
        local latest_backup
        latest_backup=$(find "$BACKUP_DIR" -name "${BACKUP_PREFIX}_*.tar.gz*" -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-)
        
        # Verify backup
        if verify_backup "$latest_backup"; then
            # Upload to S3 if configured
            upload_to_s3 "$latest_backup"
            
            # Cleanup old backups
            cleanup_old_backups
            
            success "Backup process completed successfully"
            send_notification "SUCCESS" "Database backup completed successfully"
        else
            error "Backup verification failed"
            send_notification "FAILED" "Backup verification failed"
            exit 1
        fi
    else
        error "Backup creation failed"
        send_notification "FAILED" "Database backup creation failed"
        exit 1
    fi
    
    log "Healthcare Portal database backup process completed"
}

# Script execution
case "${1:-backup}" in
    "backup")
        main
        ;;
    "verify")
        if [[ -n "${2:-}" ]]; then
            verify_backup "$2"
        else
            error "Please specify backup file to verify"
            exit 1
        fi
        ;;
    "cleanup")
        cleanup_old_backups
        ;;
    *)
        echo "Usage: $0 {backup|verify <file>|cleanup}"
        echo ""
        echo "Commands:"
        echo "  backup         - Create encrypted database backup"
        echo "  verify <file>  - Verify backup integrity"
        echo "  cleanup        - Remove old backups"
        exit 1
        ;;
esac