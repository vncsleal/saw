# Detector Samples Corpus

Purpose: Provide repeatable sample texts for exercising `detectCanaries` and mapping logic.

## File Naming
- `sample-<n>-<label>.txt`
  - `none` = no tokens
  - `single` = one token once
  - `repeat` = one token multiple times
  - `multi` = multiple distinct tokens
  - `noise` = tokens near punctuation / unicode

## Ground Truth JSON
`ground-truth.json` pairs each sample file with expected unique count & classification.

## Usage
Harness extension (future): iterate files, run detector, compare to ground truth, accumulate accuracy.

## Expansion Guidelines
Include adversarial near-miss patterns like `c-abc123` (too short) to ensure regex does not over-match; store those in a `near-miss` classification if added.
