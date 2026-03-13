# Deploy Branch Protection Rules

Apply these settings in GitHub -> Settings -> Branches -> Add rule for `deploy`:

- [x] Require a pull request before merging
  - [x] Require approvals: 0 (solo project, but PR required for CI to run)
- [x] Require status checks to pass before merging
  - [x] Require branches to be up to date before merging
  - Status checks: `quality-gate`
- [x] Do not allow bypassing the above settings
- [ ] Restrict who can push (leave unchecked for solo project)
