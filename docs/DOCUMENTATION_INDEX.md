# AirBoard Documentation Index - v4.16.52

*All documentation has been organized in the `/docs` folder for better project structure*

## Core Documentation Files

### 1. **../README.md** (Project Root)
- Project overview and main entry point
- Installation instructions
- Download links to latest version
- Quick feature overview

### 2. **CHANGELOG.md**
- Complete version history
- Detailed change log for each release
- Feature additions and bug fixes

### 3. **KEYFRAME_SYSTEM_SUMMARY.md**
- Deep technical documentation of keyframe manipulation system
- Challenges solved and solutions implemented
- Critical reference for delay, duration, and position nudging
- Trimmed vs natural layer handling

### 4. **DEVELOPMENT.md** (Consolidated)
- Environment setup and configuration
- Development workflow and daily processes
- Debugging system and techniques
- Version management and control
- *Combines: DEV_ENVIRONMENT_SETUP, DEVELOPMENT_GUIDE, DEBUG, VERSION_GUIDE*

### 5. **TECHNICAL_DOCS.md** (Consolidated)
- UI patterns and component development
- CSS to After Effects easing conversion
- Keyframe easing preservation techniques
- *Combines: UI_PATTERNS, CSS_TO_AE_EASING_GUIDE, EASING_PRESERVATION_DEEP_DIVE*

### 6. **PRODUCTION_BUILD.md**
- Step-by-step production release process
- Version numbering conventions
- ZXP build and GitHub push procedures
- Common issues and solutions

### 7. **SAFETY_GUIDE.md**
- Backup systems and safety protocols
- Git push safety features
- Recovery procedures
- Best practices for code safety

### 8. **CLAUDE_CONTEXT.md**
- AI assistant context and guidelines
- Project-specific instructions for Claude
- Development patterns to follow

## Quick Reference

| Task | Document |
|------|----------|
| Setting up development environment | docs/DEVELOPMENT.md → Environment Setup |
| Adding new UI components | docs/TECHNICAL_DOCS.md → UI Patterns |
| Debugging issues | docs/DEVELOPMENT.md → Debugging |
| Understanding keyframe operations | docs/KEYFRAME_SYSTEM_SUMMARY.md |
| Creating a new release | docs/PRODUCTION_BUILD.md |
| Converting CSS easing to AE | docs/TECHNICAL_DOCS.md → Easing Systems |
| Checking what changed in versions | docs/CHANGELOG.md |
| Safety and backup procedures | docs/SAFETY_GUIDE.md |

## Benefits of Documentation Organization

- **Cleaner project root** - Only essential files at top level
- **Centralized documentation** - All guides in `/docs` folder
- **Better structure** - Related content grouped logically
- **Easier navigation** - Clear hierarchy and paths
- **Reduced clutter** - Development files separated from docs

## Documentation Folder Structure

```
/docs/
├── DOCUMENTATION_INDEX.md     # This file - complete guide to all docs
├── CHANGELOG.md              # Version history and release notes
├── DEVELOPMENT.md            # Development environment and workflow
├── TECHNICAL_DOCS.md         # UI patterns and technical implementation
├── KEYFRAME_SYSTEM_SUMMARY.md # Deep dive into keyframe manipulation
├── PRODUCTION_BUILD.md       # Release process and ZXP building
├── SAFETY_GUIDE.md          # Backup and safety protocols
├── CLAUDE_CONTEXT.md        # AI assistant guidelines
└── claude-code-context.md   # Claude Code context file
```

---

*Last Updated: September 2024*
*This index helps navigate the organized documentation structure*