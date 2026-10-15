# Benchmark results

Setup: 1000 games per bot, seeds 1..1000, default scoring, 43-piece catalogue, cap of 20 000 moves per game.
Run with `npm run bench -- --bot <name>` on a 6-core / 12-thread laptop CPU (worker-thread pool).

| Bot | Mean score | p10 | Median | p90 | Max | Mean moves | Wall time |
|---|---|---|---|---|---|---|---|
| random | 76 | 42 | 56 | 136 | 399 | 15 | <1 s |
| greedy (hand-picked weights) | 2 701 | 524 | 1 888 | 6 095 | 18 245 | 225 | 4 s |
| greedy (tuned weights) | 3 740 | 588 | 2 731 | 8 242 | 26 858 | 303 | 6 s |
| beam search (hand-picked weights) | ≥ 61 374 | 6 929 | 42 763 | 138 176 | ≥ 252 080 | 4 923 | 14 min |
| beam search (tuned weights) | **≥ 122 996** | 15 966 | **100 951** | ≥ 251 251 | ≥ 253 757 | 9 799 | 29 min |

"≥": some games reached the 20 000-move cap and were stopped while still alive (20 games with hand-picked
weights, 200 with tuned weights), so these numbers are lower bounds.

## Observations
- **Planning the whole tray is the biggest win (~23×).** Most greedy deaths come from placing one piece in a way
  that leaves no room for the next piece of the same tray. Beam search over every order and position of the
  remaining pieces avoids this. It keeps the best 10 partial plans per depth and merges identical boards reached
  by different orders.
- **Tuning generalizes, with a visible gap.** The (1+λ)-ES in `bench/tune.ts` ran 30 generations, λ = 12,
  about 7 minutes. On its 200 training seeds (100001..100200) it raised the greedy mean from 2 732 to 4 801 (+76%).
  On the held-out seeds 1..1000 the gain is +38% (2 701 → 3 740). The difference is overfitting to the
  training seeds, which is why every benchmark uses seeds the tuner never saw.
- **Weights tuned on the cheap bot transfer to the expensive one.** Weights tuned with greedy (≈0.1 ms/move)
  double the beam-search score (≈1 ms/move): mean 61k → 123k+, median 43k → 101k.
- **What tuning changed:** smaller penalties for isolated holes (−15 → −5.7) and for losing room for big shapes
  (−10 → −3.5). Larger penalties for filled cells (−1 → −2) and for ragged edges (−2 → −3.3). The tuned bot
  keeps the board clean and flat instead of fearing every single hole.
- Spread is large for every bot (p10 vs p90 differ by 10–15×): a few unlucky trays decide most games.
