# 🌐 Healthcare Portal - ngrok Demo Guide

## 🚀 Quick Start (5 Minutes)

### 1. Run Demo Setup
```bash
# Option A: PowerShell (Recommended)
./demo-setup.ps1

# Option B: Command Prompt  
demo-setup.bat
```

### 2. Install ngrok
- Download: https://ngrok.com/download
- Extract to any folder (e.g., `C:\ngrok\`)
- No installation needed - it's a single executable

### 3. Setup ngrok Account
```bash
# Sign up at https://ngrok.com (free)
# Get your authtoken from dashboard
ngrok config add-authtoken YOUR_AUTH_TOKEN_HERE
```

### 4. Start Tunnel
```bash
ngrok http 3001
```

### 5. Share Demo URL
Copy the `https://xxx.ngrok-free.app` URL and share with your demo attendee.

## 🎬 Demo Day Checklist

### Before the Demo (10 minutes)
- [ ] Run `./demo-setup.ps1`
- [ ] Verify local access: http://localhost:3001
- [ ] Start ngrok: `ngrok http 3001`
- [ ] Test external access with the ngrok URL
- [ ] Prepare demo credentials (see below)

### During the Demo
- [ ] Share the ngrok URL with attendee
- [ ] Walk through key features
- [ ] Use demo accounts for login
- [ ] Demonstrate file uploads
- [ ] Show admin portal features

### After the Demo
- [ ] Stop ngrok (Ctrl+C)
- [ ] Stop Docker: `docker-compose down`

## 🔐 Demo Accounts

### Admin Account
- **Email**: `admin@healthcare.com`
- **Password**: `admin123`
- **Access**: Full admin portal, user management, reports

### Regular User Account  
- **Email**: `user@healthcare.com`
- **Password**: `user123`
- **Access**: Service log entry, basic features

### Demo Patients
Pre-populated with realistic healthcare demo data including:
- Patient records with various demographics
- Service log entries across different categories
- Sample file uploads and documentation

## 📱 Demo Features to Showcase

### 1. User Authentication
- Secure login with JWT tokens
- Role-based access control
- Password strength requirements

### 2. Service Log Management
- Create new service entries
- Real-time form validation
- File upload capabilities
- Service history tracking

### 3. Admin Portal
- User management dashboard
- System analytics and metrics
- Audit trail viewing
- Export functionality

### 4. Reporting & Analytics
- Generate service reports
- Export to CSV/PDF
- Performance metrics dashboard
- Data visualization charts

### 5. HIPAA Compliance Features
- Audit logging demonstration
- Data encryption indicators
- Access control examples
- Privacy protection measures

## 🔧 Troubleshooting

### ngrok Not Working?
```bash
# Check if ngrok is running
netstat -an | findstr :3001

# Restart your app
docker-compose restart

# Try different port
ngrok http 3001
```

### CORS Errors?
- Verify the ngrok URL includes `ngrok-free.app` or `ngrok.io`
- Check browser developer console for specific errors
- Ensure app is running on port 3001

### App Not Loading?
```bash
# Check Docker status
docker-compose ps

# Check app health
curl http://localhost:3001/api/health/basic

# View logs
docker-compose logs healthcare-portal-backend
```

### Demo Data Missing?
```bash
# Seed demo data
docker-compose exec healthcare-portal-backend npm run db:seed

# Or restart with fresh data
docker-compose down -v
./demo-setup.ps1
```

## 💡 Pro Tips for Demo

### 1. Prepare Your Story
- Start with the problem: "Healthcare providers need efficient service logging"
- Show the solution: "Our portal streamlines the entire workflow"
- Highlight key benefits: "HIPAA compliant, user-friendly, comprehensive reporting"

### 2. Demo Flow Suggestion
1. **Login** - Show secure authentication
2. **Dashboard** - Overview of system capabilities  
3. **Create Service Log** - Walk through the main workflow
4. **File Upload** - Demonstrate document management
5. **Admin Portal** - Show management capabilities
6. **Reports** - Display analytics and insights
7. **Security Features** - Highlight compliance aspects

### 3. Handle Questions
- **Performance**: "Optimized for healthcare workflows with <2s load times"
- **Security**: "HIPAA compliant with audit logging and encryption"
- **Scalability**: "Built on modern architecture, handles growing practices"
- **Integration**: "RESTful APIs ready for EHR integration"

## 📞 Emergency Backup Plan

If ngrok fails during demo:
1. **Screen Share**: Use video call screen sharing as backup
2. **Mobile Hotspot**: Switch to phone internet if WiFi fails
3. **Screenshots**: Have key screenshots ready as presentation slides
4. **Local Demo**: Demo directly on your machine with screen sharing

## 🔒 Security Notes

- ngrok free tier shows a warning page (click "Visit Site")
- All traffic is encrypted via HTTPS
- Close ngrok tunnel after demo for security
- Demo accounts use simple passwords (not for production)

## 📋 Post-Demo Actions

- [ ] Follow up with attendee within 24 hours
- [ ] Share relevant documentation
- [ ] Schedule technical deep-dive if interested
- [ ] Provide pricing and timeline information
- [ ] Stop all services to free up system resources

---

**Ready for your demo? Run `./demo-setup.ps1` and you're good to go! 🚀**