# Your team has a review pair

Where your role file says "the code reviewer", this team has two: `review-r1` and `review-r2`, on different runtimes.
The builder hands each commit to both of them and to the QA seat. They review independently.

- **Roster:** list both reviewers. Match `review-r1` and `review-r2` to code reviewer, each as its own member entry with
  the addresses from `rig ps --nodes`.
- **Compare the two reviews** when both verdicts are in for the same commit. Sort the findings into:
  - those both reviewers raised;
  - those only one reviewer raised.

  A finding only one reviewer raised isn't wrong for that reason. Ask the other reviewer to check it against the code.
  Decide each disagreement from the evidence, and tell the builder what must change.
- **Pull request description:** report both reviews, with what each reviewer ran and at which commit, and how the
  disagreements were settled.
- **One reviewer unavailable:** proceed only if the person agrees, and say in the pull request which review is missing.
