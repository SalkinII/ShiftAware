# Release Guide: v1.0.0

**Follow these steps to release v1.0.0 and deploy to Docker Hub**

---

## Step 1: Finalize All Changes

All Phase 3 work is complete. Stage and commit all remaining changes:

```powershell
# Stage all changes
git add .

# Commit with release message
git commit -m "chore: prepare v1.0.0 release - Phase 3 complete"
```

---

## Step 2: Merge to Main

```powershell
# Switch to main branch
git checkout main

# Pull latest changes (if any)
git pull origin main

# Merge release branch
git merge iteration/v0.4.0 --no-ff -m "chore: release v1.0.0 - Production-ready shift management system"

# Push to remote
git push origin main
```

---

## Step 3: Create Git Tag

```powershell
# Create annotated tag
git tag -a v1.0.0 -m "Release v1.0.0: Production-ready shift management system

- Security audit complete
- Browser compatibility verified
- Performance optimizations implemented
- Critical technical debt addressed
- Mobile navigation fixed
- Code splitting for bundle optimization"

# Push tag to remote
git push origin v1.0.0
```

---

## Step 4: Build and Push to Docker Hub

**Replace `YOUR_DOCKERHUB_USERNAME` with your actual Docker Hub username.**

```powershell
# Login to Docker Hub (if not already logged in)
docker login

# Build production image with version tag
docker build -t YOUR_DOCKERHUB_USERNAME/shiftaware:1.0.0 .

# Also tag as latest
docker tag YOUR_DOCKERHUB_USERNAME/shiftaware:1.0.0 YOUR_DOCKERHUB_USERNAME/shiftaware:latest

# Push both tags to Docker Hub
docker push YOUR_DOCKERHUB_USERNAME/shiftaware:1.0.0
docker push YOUR_DOCKERHUB_USERNAME/shiftaware:latest
```

**Example:**
```powershell
docker build -t chris/shiftaware:1.0.0 .
docker tag chris/shiftaware:1.0.0 chris/shiftaware:latest
docker push chris/shiftaware:1.0.0
docker push chris/shiftaware:latest
```

---

## Step 5: Create v1.1 Development Branch

```powershell
# Create and checkout v1.1 branch from main
git checkout -b iteration/v1.1

# Push branch to remote
git push -u origin iteration/v1.1
```

---

## Step 6: Verify Release

### Verify Git
```powershell
# Check tags
git tag -l

# Verify main branch
git checkout main
git log --oneline -5
```

### Verify Docker Hub
Visit: `https://hub.docker.com/r/YOUR_DOCKERHUB_USERNAME/shiftaware/tags`

You should see:
- `1.0.0` tag
- `latest` tag

### Test Docker Pull
```powershell
# Test pulling the image
docker pull YOUR_DOCKERHUB_USERNAME/shiftaware:1.0.0
```

---

## Step 7: Update Documentation (Optional)

After release, you may want to update:
- `README.md` with Docker Hub pull instructions
- `DEPLOYMENT.md` with production image reference

---

## Quick Reference Commands

```powershell
# Complete release workflow (replace YOUR_DOCKERHUB_USERNAME)
git add .
git commit -m "chore: prepare v1.0.0 release"
git checkout main
git merge iteration/v0.4.0 --no-ff -m "chore: release v1.0.0"
git push origin main
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
docker build -t YOUR_DOCKERHUB_USERNAME/shiftaware:1.0.0 .
docker tag YOUR_DOCKERHUB_USERNAME/shiftaware:1.0.0 YOUR_DOCKERHUB_USERNAME/shiftaware:latest
docker push YOUR_DOCKERHUB_USERNAME/shiftaware:1.0.0
docker push YOUR_DOCKERHUB_USERNAME/shiftaware:latest
git checkout -b iteration/v1.1
git push -u origin iteration/v1.1
```

---

## Troubleshooting

### If merge conflicts occur:
```powershell
# Resolve conflicts, then:
git add .
git commit -m "chore: resolve merge conflicts for v1.0.0"
```

### If Docker Hub push fails:
- Verify you're logged in: `docker login`
- Check image name format: `username/repository:tag`
- Ensure repository exists on Docker Hub (create it if needed)

---

**Ready to proceed?** Run the commands above, replacing `YOUR_DOCKERHUB_USERNAME` with your actual Docker Hub username.
