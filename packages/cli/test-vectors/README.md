Unified test vectors (canonicalization + signature + raw fixture corpus subset) for the minimal package.

Files:
- canonicalization.json (authoritative canonicalization vectors w/ expected sha256)
- signature-golden.json (feed subset + signature + public key)
- fixtures.json (lightweight raw inputs; can be promoted to full canonical vectors if needed)

Expansion:
Add new raw cases to fixtures.json or full cases to canonicalization.json. Keep each focused and <2KB.

Note: Legacy root folders `canonicalization-fixtures/` and `test-vectors/` were folded into this directory.
