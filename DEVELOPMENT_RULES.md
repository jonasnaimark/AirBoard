# Development Rules - AirBoard Plugin

## Purpose
This document defines the core development practices for the AirBoard After Effects plugin. All contributors and AI assistants must follow these rules to maintain code quality and prevent drift.

## Git Workflow Rules

### Branch Management

#### Branch Naming Convention
```
feature/    → New functionality
fix/        → Bug fixes
refactor/   → Code improvements (requires approval)
docs/       → Documentation only
test/       → Testing additions
hotfix/     → Urgent production fixes
```

#### Examples
- `feature/android-device-support`
- `fix/gesture-timing-issue`
- `docs/update-installation-guide`
- `refactor/simplify-effect-system`
- `hotfix/critical-crash-fix`

### Branch Creation Rules

1. **Always branch from main**
```bash
git checkout main
git pull origin main
git checkout -b feature/your-feature-name
```

2. **One feature per branch**
   - Never combine unrelated changes
   - Keep branches focused and small

3. **Update before merging**
```bash
git checkout main
git pull origin main
git checkout feature/your-branch
git merge main  # Resolve conflicts locally
```

4. **Delete after merge**
   - Branches should be deleted after successful merge
   - Keep repository clean

## Commit Standards

### Commit Message Format
```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

### Commit Types
| Type | Usage | Example |
|------|-------|---------|
| `feat` | New feature | `feat(device): add iPad support` |
| `fix` | Bug fix | `fix(gesture): correct tap timing` |
| `docs` | Documentation | `docs(readme): update install steps` |
| `style` | Formatting only | `style(jsx): fix indentation` |
| `refactor` | Code restructuring | `refactor(effects): simplify logic` |
| `test` | Adding tests | `test(device): add unit tests` |
| `chore` | Maintenance | `chore(deps): update packages` |
| `perf` | Performance | `perf(render): optimize shape creation` |

### Commit Rules

1. **Atomic Commits**
   - One logical change per commit
   - Easy to revert if needed

2. **Present Tense**
   - "add feature" not "added feature"
   - "fix bug" not "fixed bug"

3. **Subject Line Limits**
   - Maximum 50 characters
   - No period at the end

4. **Body Guidelines** (when needed)
   - Wrap at 72 characters
   - Explain what and why, not how
   - Reference issue numbers

### Good vs Bad Examples

✅ **Good:**
```
feat(device): add Samsung Galaxy S24 preset

- Add 2x, 3x, 4x scale options
- Include rounded corners and camera cutout
- Closes #45
```

❌ **Bad:**
```
Updated some stuff and fixed things
```

## Pull Request Rules

### PR Size Guidelines
- **Small:** < 100 lines changed (preferred)
- **Medium:** 100-500 lines (acceptable)
- **Large:** > 500 lines (needs justification)

### PR Checklist
Before creating a PR, ensure:
- [ ] Code runs without errors
- [ ] All tests pass
- [ ] No unrelated files changed
- [ ] Commits are properly formatted
- [ ] Branch is up-to-date with main
- [ ] Documentation updated if needed

### PR Review Process
1. Create PR with descriptive title
2. Fill out PR template completely
3. Request review from team
4. Address feedback promptly
5. Squash commits if requested
6. Delete branch after merge

## Code Modification Rules

### Protected Files
These files require explicit approval to modify:

```
NEVER MODIFY WITHOUT APPROVAL:
├── CSXS/manifest.xml           # Core configuration
├── build/build.sh              # Build process
├── .gitignore                  # Repository settings
├── package.json                # Dependencies
└── jsx/main.jsx               # Core functionality (append only)
```

### Safe Modification Zones
```
SAFE TO MODIFY:
├── jsx/modules/                # Feature modules
├── client/js/modules/          # UI modules
├── assets/presets/             # New presets
├── docs/                       # Documentation
└── tests/                      # Test files
```

## Testing Requirements

### Before Every Commit
1. Test in After Effects CC 2020 minimum
2. Verify existing features still work
3. Check for console errors
4. Test edge cases

### Before Every PR
1. Test in multiple AE versions
2. Test on clean installation
3. Verify all gestures/effects work
4. Document any breaking changes

## AI Assistant Protocol

### Session Start Requirements
When working with AI assistants, provide:

1. **Current branch name**
2. **Specific task description**
3. **Files that need modification**
4. **Any constraints or requirements**

### Collaborative Git Workflow with AI

#### AI Git Responsibilities
- ✅ **Ask before major commits** - "Should I commit these changes?"
- ✅ **Commit logical chunks** - Each feature/fix as separate commits
- ✅ **Use descriptive commit messages** with progress details
- ✅ **Work on main branch** for single-developer projects
- ✅ **Push regularly** to maintain GitHub backup

#### User Control Points
- 🎯 **Tell AI when to commit** - "Let's commit this feature"
- 🎯 **Request specific commit messages** - "Commit this as 'Fixed button alignment'"
- 🎯 **Ask for status checks** - "What changes haven't been committed?"
- 🎯 **Request GitHub pushes** - "Push everything to GitHub"

#### Commit Triggers
**AI should suggest committing after:**
1. **Completing features** - UI improvements, new functionality
2. **Before major changes** - "Commit current work before trying new approach"
3. **Reaching stable milestones** - Working ZXP packages
4. **Multiple related fixes** - Series of bug fixes or refinements

#### Commit Message Format for AI
```
<action>: <brief description>

- Specific change 1
- Specific change 2
- Result/impact

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

## Release Management Protocol

### Mandatory Release Steps
Every time a version is pushed to GitHub, the AI MUST complete both:

#### 1. Update CHANGELOG.md
- **Format**: Follow [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) format
- **Content**: Include version, date, and categorized changes
- **Categories**: Added ✨, Fixed 🔧, Changed 🎯, Removed ❌, Technical Details
- **Emojis**: Use consistent emoji system for visual clarity
- **Milestones**: Mark major versions with 🏆 for easy reference

#### 2. Create GitHub Release
- **Tag**: Use semantic versioning (e.g., v2.1.2)
- **Title**: "Version X.X.X - [Main Feature]"
- **Description**: Copy formatted changelog content for that version
- **Assets**: Attach corresponding ZXP file for easy downloads
- **Timing**: Create release immediately after git push

### Release Content Template
```markdown
## [X.X.X] - YYYY-MM-DD
### Added
- ✨ **Major Feature**: Description of main addition
- 🎯 Enhancement: Specific improvement details

### Fixed
- 🔧 Bug Fix: What was broken and how it was fixed

### Technical Details
- Implementation specifics
- Integration notes
- Breaking changes (if any)

### Notes
- 🔖 Reference information for future development
- 🔄 Reusable patterns or solutions
```

### Version Significance Markers
- 🏆 **Major Milestone**: Versions that solve significant problems
- 🎯 **Feature Addition**: New functionality
- 🔧 **Bug Fix**: Problem resolution
- 📚 **Documentation**: Major doc updates
- 🔖 **Reference Version**: Important for future development

### Example Release Process
1. **Code Changes**: Complete feature development
2. **Version Bump**: Update manifest.xml version
3. **Package ZXP**: Create new distribution file
4. **Update CHANGELOG.md**: Add new version entry
5. **Git Commit**: Commit with descriptive message
6. **Git Push**: Push to GitHub
7. **GitHub Release**: Create release with ZXP attachment

### AI Must Never
- Refactor working code without permission
- Modify protected files without approval
- Combine multiple features in one change
- Remove existing functionality
- Add unnecessary dependencies
- Change file structure without discussion

### AI Must Always
- Ask for clarification when uncertain
- Preserve existing code patterns
- Make atomic, focused changes
- Follow naming conventions
- Document complex logic
- State which files are being modified
- **Update CHANGELOG.md and create GitHub Release for every version push**

## Error Prevention

### Common Pitfalls to Avoid
1. **Feature Creep:** Stay focused on the assigned task
2. **Over-Engineering:** Keep solutions simple
3. **Breaking Changes:** Maintain backward compatibility
4. **Scope Expansion:** Don't add "nice to have" features
5. **Style Changes:** Don't reformat unrelated code

### Red Flags
Stop and reassess if:
- Changing more than 5 files for a simple feature
- Modifying core functionality for a new feature
- Unable to clearly explain the change
- Breaking existing functionality
- Adding external dependencies

## Enforcement

These rules are mandatory for:
- All human developers
- All AI assistants
- All code reviews
- All merges to main

Non-compliance will result in:
- PR rejection
- Code reversion
- Additional review requirements

---

*Last Updated: [Current Date]*
*Version: 1.0.0*
