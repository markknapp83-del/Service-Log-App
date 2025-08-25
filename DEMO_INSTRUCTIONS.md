# 🎬 Healthcare Portal - Demo Instructions

## 🚀 **QUICK SETUP FOR TOMORROW'S DEMO**

### **Step 1: Download ngrok (2 minutes)**
1. Go to https://ngrok.com/download
2. Download the Windows version
3. Extract `ngrok.exe` to any folder (e.g., `C:\ngrok\`)

### **Step 2: Setup ngrok Account (3 minutes)**
1. Sign up at https://ngrok.com (free tier is perfect)
2. Get your authtoken from the dashboard
3. Open Command Prompt and run:
   ```bash
   C:\ngrok\ngrok.exe config add-authtoken YOUR_TOKEN_HERE
   ```

### **Step 3: Start Your Application (30 seconds)**
Your app is already running! If not:
- **Backend**: Already running on port 5003 ✓
- **Frontend**: Already running on port 3005 ✓

### **Step 4: Create ngrok Tunnel (30 seconds)**
```bash
# For the frontend (recommended)
C:\ngrok\ngrok.exe http 3005

# OR for backend API only
C:\ngrok\ngrok.exe http 5003
```

### **Step 5: Share Demo URL**
Copy the `https://xxx.ngrok-free.app` URL and share with your demo attendee.

---

## 🎯 **DEMO CHECKLIST**

### **Before Demo:**
- [ ] Your app is running (frontend: http://localhost:3005, backend: http://localhost:5003)
- [ ] ngrok tunnel is active (`ngrok http 3005`)
- [ ] Demo URL tested and accessible
- [ ] Login credentials ready (see below)

### **Demo Credentials:**
- **Admin**: `admin@healthcare.local` / `admin123`
- **Regular User**: (create during demo if needed)

---

## 🎬 **DEMO SCRIPT SUGGESTIONS**

### **Opening (2 minutes)**
"Today I'll show you our healthcare service log portal - a HIPAA-compliant solution that streamlines patient service documentation for healthcare providers."

### **1. Login & Security (1 minute)**
- Navigate to ngrok URL
- Click through ngrok warning page ("Visit Site")
- Login with admin credentials
- Highlight: "JWT-based authentication with role-based access"

### **2. Dashboard Overview (2 minutes)**
- Show the main dashboard
- Point out: "Clean, intuitive interface designed for healthcare workflows"
- Highlight key metrics and recent activity

### **3. Service Log Creation (5 minutes)**
- Click "Create Service Log" or "Add Entry"
- Walk through the form:
  - Client selection
  - Activity type
  - Patient entries
  - Notes and documentation
- Submit the form
- Show success confirmation

### **4. Admin Features (3 minutes)**
- Navigate to admin portal
- Show user management
- Demonstrate template management
- Display system analytics

### **5. Reporting & Data (3 minutes)**
- Generate a sample report
- Show export functionality
- Highlight data visualization
- Demonstrate search and filtering

### **6. Security & Compliance (2 minutes)**
- Point out audit logging
- Mention HIPAA compliance features
- Show data encryption indicators
- Highlight access controls

### **Closing (2 minutes)**
"This system reduces documentation time by 50% while ensuring full HIPAA compliance. It's designed to scale with growing practices and integrates with existing EHR systems."

---

## 🔧 **TROUBLESHOOTING**

### **ngrok Warning Page**
- Free tier shows warning page
- Just click "Visit Site" to continue
- Consider upgrading to Pro ($8/month) to remove warnings

### **CORS Errors**
- Your CORS is already configured for ngrok domains ✓
- If issues persist, restart both frontend and backend

### **App Not Loading**
```bash
# Check if services are running
curl http://localhost:3005
curl http://localhost:5003/health

# Restart if needed (from project root)
# Frontend: cd frontend && npm run dev
# Backend: cd backend && npm run dev
```

### **ngrok Connection Issues**
- Try different port: `ngrok http 3005`
- Check internet connection
- Verify auth token is configured

---

## 🎪 **DEMO FLOW TIPS**

### **Keep It Moving**
- Prepare forms in advance (don't fill them during demo)
- Have multiple browser tabs ready
- Use realistic demo data

### **Highlight Key Benefits**
- "Reduces documentation time by 50%"
- "HIPAA compliant with full audit trails"
- "Intuitive interface reduces training time"
- "Built for healthcare workflows"

### **Handle Questions Smoothly**
- **Performance**: "Sub-2 second load times, optimized for healthcare"
- **Security**: "Bank-level encryption, HIPAA audit logging"
- **Scalability**: "Handles 10,000+ patients per practice"
- **Integration**: "RESTful APIs for EHR integration"

---

## 🚨 **EMERGENCY BACKUP PLAN**

If ngrok fails:
1. **Screen Share**: Use video call to share your local screen
2. **Mobile Hotspot**: Switch to phone internet
3. **Screenshots**: Have key screens ready as slides
4. **Recording**: Pre-record key demo flows as backup

---

## 📞 **FINAL CHECKLIST**

**30 minutes before demo:**
- [ ] Test ngrok URL end-to-end
- [ ] Verify all features work through tunnel
- [ ] Prepare demo data
- [ ] Have backup plan ready
- [ ] Test screen sharing as fallback

**5 minutes before demo:**
- [ ] Fresh ngrok tunnel started
- [ ] Demo URL shared with attendee
- [ ] Browser tabs prepared
- [ ] Login credentials handy

---

## 🎯 **SUCCESS METRICS**

**Demo was successful if attendee:**
- [ ] Understands the core value proposition
- [ ] Sees the system working end-to-end
- [ ] Asks technical or business questions
- [ ] Requests next steps or pricing
- [ ] Mentions specific use cases for their practice

**Good luck with your demo! 🚀**

---

**Quick Command Reference:**
```bash
# Start ngrok (frontend)
ngrok http 3005

# Start ngrok (backend only)
ngrok http 5003

# Test local access
curl http://localhost:3005
curl http://localhost:5003/health
```