# Submissions

To submit a rig bundle for openrig.dev/rigs, open a pull request that adds one file here, `<your-team>.yaml`, with
exactly these three fields:

```yaml
repository: https://github.com/<owner>/<repo>
folder: rigs/my-team   # the folder holding rig.yaml; "." for the repository root
ref: main              # a branch, tag or commit
```

The registry check accepts it and says "Submission received". A maintainer then pins your link to an exact commit,
reviews the bundle, writes the full entry in `registry/`, and removes this file. If it isn't listed, you get a short
reply saying why.
