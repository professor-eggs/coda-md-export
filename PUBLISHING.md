# Publishing Guide

## Quick Reference

This extension can be published to the Chrome Web Store in two ways:

### 1. Manual Publishing (Simple)

1. Run the build: `npm run build`
2. This creates `coda-md-export.zip` in the project root
3. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
4. Click on your extension
5. Click **Package** tab
6. Click **Upload New Package**
7. Select `coda-md-export.zip`
8. Update listing information if needed
9. Click **Submit for Review**

### 2. Automated Publishing via GitHub Actions

Automatically publish when you push to `main` branch.

**First-time setup required** (15 minutes):

- See [CHROME_WEB_STORE_SETUP.md](./CHROME_WEB_STORE_SETUP.md) for detailed instructions

**After setup:**

- Just push to `main` or merge a PR
- GitHub Actions will automatically:
  - Run tests
  - Build the extension
  - Upload to Chrome Web Store
  - Publish the update

## Version Management

Before publishing, update the version in **both** files:

- `package.json` - line 3: `"version": "X.Y.Z"`
- `src/manifest.json` - line 4: `"version": "X.Y.Z"`

Version numbers must follow semantic versioning:

- **Major.Minor.Patch** (e.g., `1.0.0`, `1.2.3`)
- Each new version must be higher than the previous
- Chrome Web Store will reject duplicate versions

## Pre-Publishing Checklist

- [ ] Version bumped in `package.json`
- [ ] Version bumped in `src/manifest.json`
- [ ] All tests passing: `npm test`
- [ ] Build succeeds: `npm run build`
- [ ] Extension tested locally (load unpacked from `dist/`)
- [ ] Changelog updated (if maintaining one)
- [ ] No sensitive data in code or logs

## Testing the Build Locally

1. Build the extension: `npm run build`
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked**
5. Select the `dist/` folder
6. Test all functionality

## Workflow Status

Check the status of automated publishing:

1. Go to your GitHub repository
2. Click the **Actions** tab
3. See recent workflow runs

## Troubleshooting

### Build fails locally

```bash
npm run clean
npm install
npm run build
```

### Tests fail

```bash
npm test
# Fix any failing tests before publishing
```

### GitHub Action fails

- Check the Actions tab for error details
- Common issues:
  - Tests failing
  - Version not incremented
  - Missing or expired credentials
  - Invalid zip structure

### Chrome Web Store rejects the package

- Ensure version is incremented
- Check for policy violations
- Review error message in Developer Dashboard
- Check that manifest.json is valid

## Publishing Strategy

### For Small Changes (Patches)

- Bump patch version: `1.0.0` → `1.0.1`
- Quick review, usually within hours
- Low risk

### For New Features (Minor)

- Bump minor version: `1.0.1` → `1.1.0`
- Standard review process
- May take 1-3 days

### For Breaking Changes (Major)

- Bump major version: `1.1.0` → `2.0.0`
- Consider a staged rollout
- Thorough testing recommended
- Update documentation

## Staged Rollout

For extensions with 10,000+ users, consider staged rollout:

1. Publish to 10% of users first
2. Monitor for errors/feedback
3. Gradually increase to 25%, 50%, 100%
4. Manage in Chrome Web Store Developer Dashboard

## Emergency Rollback

If you need to rollback a bad release:

1. Go to Chrome Web Store Developer Dashboard
2. Click **Package** tab
3. Find "Roll back to previous version"
4. Select the version to rollback to
5. Confirm

## Resources

- [Chrome Web Store API Setup](./CHROME_WEB_STORE_SETUP.md) - Detailed setup guide
- [Chrome Web Store Dashboard](https://chrome.google.com/webstore/devconsole)
- [Chrome Extension Documentation](https://developer.chrome.com/docs/extensions/)
