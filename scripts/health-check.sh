#!/bin/bash

# Healthcare Service Log Portal - Comprehensive Health Check Script
# Production monitoring and health verification

set -euo pipefail

# Configuration
HEALTH_CHECK_URL="${HEALTH_CHECK_URL:-http://localhost:3001}"
TIMEOUT=30
RETRIES=3
LOG_FILE="/var/log/healthcare-health-check.log"
ALERT_THRESHOLD=5
ALERT_EMAIL="${ALERT_EMAIL:-}"
SLACK_WEBHOOK="${SLACK_WEBHOOK:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# Health check functions
check_basic_health() {
    local url="$HEALTH_CHECK_URL/api/health/basic"
    
    log "Checking basic application health: $url"
    
    if curl -sf --max-time "$TIMEOUT" "$url" > /dev/null; then
        success "Basic health check passed"
        return 0
    else
        error "Basic health check failed"
        return 1
    fi
}

check_database_health() {
    local url="$HEALTH_CHECK_URL/api/health/database"
    
    log "Checking database health: $url"
    
    local response
    response=$(curl -sf --max-time "$TIMEOUT" "$url" 2>/dev/null || echo "")
    
    if [[ -n "$response" ]]; then
        local connected
        connected=$(echo "$response" | jq -r '.data.connected // false' 2>/dev/null || echo "false")
        
        if [[ "$connected" == "true" ]]; then
            success "Database health check passed"
            return 0
        else
            error "Database is not connected"
            return 1
        fi
    else
        error "Database health check failed - no response"
        return 1
    fi
}

check_detailed_health() {
    local url="$HEALTH_CHECK_URL/api/health/detailed"
    
    log "Checking detailed system health: $url"
    
    local response
    response=$(curl -sf --max-time "$TIMEOUT" "$url" 2>/dev/null || echo "")
    
    if [[ -n "$response" ]]; then
        # Parse response
        local status
        status=$(echo "$response" | jq -r '.status // "unknown"' 2>/dev/null || echo "unknown")
        
        if [[ "$status" == "healthy" ]]; then
            success "Detailed health check passed"
            
            # Log additional metrics
            local uptime
            uptime=$(echo "$response" | jq -r '.data.uptime // "unknown"' 2>/dev/null || echo "unknown")
            log "System uptime: $uptime"
            
            local memory
            memory=$(echo "$response" | jq -r '.data.memory.usage // "unknown"' 2>/dev/null || echo "unknown")
            log "Memory usage: $memory"
            
            return 0
        else
            error "Detailed health check failed - status: $status"
            return 1
        fi
    else
        error "Detailed health check failed - no response"
        return 1
    fi
}

check_authentication() {
    local url="$HEALTH_CHECK_URL/api/auth/health"
    
    log "Checking authentication service"
    
    if curl -sf --max-time "$TIMEOUT" "$url" > /dev/null 2>&1; then
        success "Authentication service is healthy"
        return 0
    else
        warning "Authentication service check failed (may be expected if endpoint doesn't exist)"
        return 0  # Don't fail overall health check for this
    fi
}

check_api_endpoints() {
    log "Checking critical API endpoints"
    
    local endpoints=(
        "/api/health/basic"
        "/api/health/database" 
        "/api/health/detailed"
    )
    
    local failed_count=0
    
    for endpoint in "${endpoints[@]}"; do
        local url="$HEALTH_CHECK_URL$endpoint"
        
        if curl -sf --max-time "$TIMEOUT" "$url" > /dev/null; then
            success "Endpoint $endpoint is responding"
        else
            error "Endpoint $endpoint is not responding"
            ((failed_count++))
        fi
    done
    
    if [[ $failed_count -eq 0 ]]; then
        success "All API endpoints are healthy"
        return 0
    else
        error "$failed_count API endpoints failed health check"
        return 1
    fi
}

check_ssl_certificate() {
    if [[ "$HEALTH_CHECK_URL" == https://* ]]; then
        log "Checking SSL certificate"
        
        local domain
        domain=$(echo "$HEALTH_CHECK_URL" | sed 's|https://||' | sed 's|/.*||')
        
        local cert_info
        cert_info=$(openssl s_client -servername "$domain" -connect "$domain:443" </dev/null 2>/dev/null | openssl x509 -noout -dates 2>/dev/null || echo "")
        
        if [[ -n "$cert_info" ]]; then
            local expiry_date
            expiry_date=$(echo "$cert_info" | grep "notAfter" | cut -d= -f2)
            
            local expiry_epoch
            expiry_epoch=$(date -d "$expiry_date" +%s 2>/dev/null || echo "0")
            
            local current_epoch
            current_epoch=$(date +%s)
            
            local days_until_expiry
            days_until_expiry=$(( (expiry_epoch - current_epoch) / 86400 ))
            
            if [[ $days_until_expiry -gt 30 ]]; then
                success "SSL certificate is valid (expires in $days_until_expiry days)"
                return 0
            elif [[ $days_until_expiry -gt 7 ]]; then
                warning "SSL certificate expires in $days_until_expiry days"
                return 0
            else
                error "SSL certificate expires in $days_until_expiry days"
                return 1
            fi
        else
            error "Could not retrieve SSL certificate information"
            return 1
        fi
    else
        log "Skipping SSL certificate check (HTTP endpoint)"
        return 0
    fi
}

check_performance_metrics() {
    local url="$HEALTH_CHECK_URL/api/monitoring/metrics"
    
    log "Checking performance metrics"
    
    local response
    response=$(curl -sf --max-time "$TIMEOUT" "$url" 2>/dev/null || echo "")
    
    if [[ -n "$response" ]]; then
        success "Performance metrics endpoint is responding"
        
        # Check for high response times
        local avg_response_time
        avg_response_time=$(echo "$response" | grep "http_request_duration_seconds" | head -1 | awk '{print $2}' 2>/dev/null || echo "0")
        
        if (( $(echo "$avg_response_time > 2.0" | bc -l) )); then
            warning "High average response time: ${avg_response_time}s"
        else
            log "Average response time: ${avg_response_time}s"
        fi
        
        return 0
    else
        warning "Performance metrics endpoint is not responding"
        return 0  # Don't fail overall health check for this
    fi
}

# Send alert notification
send_alert() {
    local message="$1"
    local timestamp
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    # Email alert
    if [[ -n "$ALERT_EMAIL" ]] && command -v mail &> /dev/null; then
        echo "Healthcare Portal health check alert at $timestamp: $message" | \
            mail -s "Healthcare Portal Alert" "$ALERT_EMAIL"
    fi
    
    # Slack alert
    if [[ -n "$SLACK_WEBHOOK" ]]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"🚨 Healthcare Portal Alert: $message\"}" \
            "$SLACK_WEBHOOK" > /dev/null 2>&1 || true
    fi
    
    # Log alert
    error "ALERT SENT: $message"
}

# Main health check function
run_health_check() {
    log "Starting comprehensive health check for Healthcare Portal"
    
    local checks_passed=0
    local total_checks=7
    local critical_failures=0
    
    # Basic health check (critical)
    if check_basic_health; then
        ((checks_passed++))
    else
        ((critical_failures++))
    fi
    
    # Database health check (critical)
    if check_database_health; then
        ((checks_passed++))
    else
        ((critical_failures++))
    fi
    
    # Detailed health check
    if check_detailed_health; then
        ((checks_passed++))
    fi
    
    # Authentication check
    if check_authentication; then
        ((checks_passed++))
    fi
    
    # API endpoints check
    if check_api_endpoints; then
        ((checks_passed++))
    fi
    
    # SSL certificate check
    if check_ssl_certificate; then
        ((checks_passed++))
    fi
    
    # Performance metrics check
    if check_performance_metrics; then
        ((checks_passed++))
    fi
    
    # Summary
    local health_percentage
    health_percentage=$(( checks_passed * 100 / total_checks ))
    
    log "Health check completed: $checks_passed/$total_checks checks passed ($health_percentage%)"
    
    # Determine overall status
    if [[ $critical_failures -eq 0 && $health_percentage -ge 80 ]]; then
        success "Healthcare Portal is HEALTHY"
        return 0
    elif [[ $critical_failures -eq 0 && $health_percentage -ge 60 ]]; then
        warning "Healthcare Portal has MINOR ISSUES ($health_percentage% healthy)"
        return 1
    else
        error "Healthcare Portal is UNHEALTHY ($critical_failures critical failures, $health_percentage% healthy)"
        send_alert "System is unhealthy: $critical_failures critical failures, $health_percentage% of checks passed"
        return 2
    fi
}

# Continuous monitoring mode
continuous_monitor() {
    local interval="${1:-300}"  # Default 5 minutes
    local failure_count=0
    
    log "Starting continuous monitoring mode (interval: ${interval}s)"
    
    while true; do
        if run_health_check; then
            failure_count=0
        else
            ((failure_count++))
            
            if [[ $failure_count -ge $ALERT_THRESHOLD ]]; then
                send_alert "Health check has failed $failure_count consecutive times"
                failure_count=0  # Reset to avoid spam
            fi
        fi
        
        log "Next health check in ${interval} seconds"
        sleep "$interval"
    done
}

# Retry mechanism
run_with_retry() {
    local attempt=1
    
    while [[ $attempt -le $RETRIES ]]; do
        log "Health check attempt $attempt/$RETRIES"
        
        if run_health_check; then
            return 0
        fi
        
        if [[ $attempt -lt $RETRIES ]]; then
            log "Retrying in 10 seconds..."
            sleep 10
        fi
        
        ((attempt++))
    done
    
    error "All health check attempts failed"
    return 1
}

# Usage information
show_usage() {
    echo "Healthcare Portal Health Check Script"
    echo ""
    echo "Usage: $0 [OPTIONS] [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  check                     - Run single health check (default)"
    echo "  monitor [interval]        - Run continuous monitoring"
    echo "  retry                     - Run health check with retry logic"
    echo ""
    echo "Options:"
    echo "  -u, --url URL            - Health check base URL (default: http://localhost:3001)"
    echo "  -t, --timeout SECONDS    - Request timeout (default: 30)"
    echo "  -r, --retries COUNT      - Number of retries (default: 3)"
    echo "  -e, --email EMAIL        - Alert email address"
    echo "  -s, --slack-webhook URL  - Slack webhook URL for alerts"
    echo "  -h, --help               - Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 check"
    echo "  $0 monitor 60"
    echo "  $0 -u https://healthcare-portal.com -e admin@company.com check"
    echo "  $0 retry"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -u|--url)
            HEALTH_CHECK_URL="$2"
            shift 2
            ;;
        -t|--timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        -r|--retries)
            RETRIES="$2"
            shift 2
            ;;
        -e|--email)
            ALERT_EMAIL="$2"
            shift 2
            ;;
        -s|--slack-webhook)
            SLACK_WEBHOOK="$2"
            shift 2
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        check)
            COMMAND="check"
            shift
            ;;
        monitor)
            COMMAND="monitor"
            INTERVAL="${2:-300}"
            shift
            if [[ $# -gt 0 && "$1" =~ ^[0-9]+$ ]]; then
                shift
            fi
            ;;
        retry)
            COMMAND="retry"
            shift
            ;;
        *)
            error "Unknown option or command: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Set default command
COMMAND="${COMMAND:-check}"

# Create log file directory if it doesn't exist
mkdir -p "$(dirname "$LOG_FILE")"

# Check dependencies
if ! command -v curl &> /dev/null; then
    error "curl is required but not installed"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    warning "jq is not installed - some health checks may not work properly"
fi

# Execute command
case "$COMMAND" in
    "check")
        run_health_check
        exit $?
        ;;
    "monitor")
        continuous_monitor "$INTERVAL"
        ;;
    "retry")
        run_with_retry
        exit $?
        ;;
    *)
        error "Unknown command: $COMMAND"
        show_usage
        exit 1
        ;;
esac