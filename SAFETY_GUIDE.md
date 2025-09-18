# 🛡️ AirBoard Safety & Backup Guide

## ⚠️ Critical Safety Measures

### Pre-Push Backup System
**Automatic backups are now created before every git push:**
- Location: `~/Documents/airboard-backups/YYYYMMDD_HHMMSS/`
- Contains: Complete project copy (excluding .git and temp files)
- Triggered: Every `git push` command

### Manual Backup Commands
```bash
# Create immediate backup
rsync -av --exclude='.git' --exclude='node_modules' --exclude='dist/*.zxp' ~/Documents/airboard-plugin/ ~/Documents/airboard-backups/manual_$(date +%Y%m%d_%H%M%S)/

# List all backups
ls -la ~/Documents/airboard-backups/
```

### Development Environment Safety
```bash
# Check symlink status (should point to actual project)
ls -la ~/Library/Application\ Support/Adobe/CEP/extensions/airboard-dev

# Recreate symlink if needed
rm ~/Library/Application\ Support/Adobe/CEP/extensions/airboard-dev
ln -sf ~/Documents/airboard-plugin ~/Library/Application\ Support/Adobe/CEP/extensions/airboard-dev
```

## 🚨 If Files Disappear Again

### Immediate Recovery Steps:
1. **Check latest backup:**
   ```bash
   ls -la ~/Documents/airboard-backups/
   cd ~/Documents/airboard-backups/[LATEST_FOLDER]
   ```

2. **Restore from backup:**
   ```bash
   cp -r ~/Documents/airboard-backups/[LATEST_FOLDER]/* ~/Documents/airboard-plugin/
   ```

3. **Alternative: Clone from GitHub:**
   ```bash
   cd ~/Documents
   git clone https://github.com/jonasnaimark/AirBoard.git airboard-plugin-recovery
   ```

### Investigation Commands:
```bash
# Check if files moved elsewhere
find /Users/jonas_naimark -name "main.jsx" 2>/dev/null

# Check git status
cd ~/Documents/airboard-plugin && git status

# Check system logs for file operations
log show --predicate 'eventMessage contains "airboard"' --last 1h
```

## 🔍 Root Cause Analysis

### Potential Causes Identified:
1. **Development Symlink**: May have caused unexpected file operations
2. **Build Process**: `build-latest.sh` creates/removes temp directories
3. **System-Level Issue**: macOS file system or permissions

### Prevention Measures Implemented:
- ✅ Automatic pre-push backups
- ✅ Safety documentation
- ✅ Recovery procedures
- ✅ Investigation commands

## 📞 Emergency Contacts
- **GitHub Repository**: https://github.com/jonasnaimark/AirBoard
- **All commits are safely stored** in git history
- **Backups are created automatically** before each push

---
**Remember: Your work is never truly lost as long as it's committed to git!**