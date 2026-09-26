# G-code systems A / B / C (Fanuc lathe)

Status: UNVERIFIED — could not reach an authoritative FANUC lathe operator's manual. Tried, in
order: `WebSearch` (session's web-search budget was already exhausted, 200/200 calls used before
this task started, so no query could be issued); `WebFetch` on DuckDuckGo (`html.duckduckgo.com`
and `lite.duckduckgo.com`) — both served a CAPTCHA ("select all squares containing a duck")
instead of results; `WebFetch` on `www.google.com/search` — redirected to a `consent.google.com`
interstitial with no results reachable past it; `WebFetch` on `www.bing.com/search` — returned
either an empty "no results" shell for specific queries or, for a generic control query
("fanuc 0i td lathe manual pdf"), a page of unrelated Greek banking links (`ebanking.eurobank.gr`),
indicating the fetch path for that host is not returning real Bing results in this environment;
`WebFetch` on `archive.org/advancedsearch.php` (JSON API, no rendering involved) — zero hits for
"fanuc lathe operator's manual" and for "fanuc 0i lathe"; `WebFetch` on `www.ecosia.org/search` —
HTTP 403; `WebFetch` on `search.marginalia.nu` / `marginalia-search.com` — page loaded but with no
result listing in the fetched content. No PDF of a FANUC Series 0i (or other) lathe operator's
manual "G code list" chapter was reached. Per the task brief, the plan's table and code are kept
unchanged pending verification in a later session with working web access.

## Task 12b sweep (this session)

Per the brief, fetched `https://www.helmancnc.com/fanuc-g-codes-list/` (helmancnc, secondary) to
check for a systems A/B/C comparison table. The page loaded but is a flat G-code reference list,
**not** a systems A/B/C table: it lists G90 and G20 under turning-cycle-related entries, G92, G78,
and G76 under thread-related entries, and G94 under facing — with no column or heading comparing
systems A/B/C, and no statement about U/W absolute/incremental addressing per system. This is not
usable as confirming or contradicting evidence for the table below (it is a different kind of
document than what would settle the question), so the A/B/C mapping table stays **UNVERIFIED**.
No other reachable source (cnccookbook.com, gcodetutor.com — neither carries a systems A/B/C page)
addressed this either. The U/W-incremental-in-B/C question also stays **UNVERIFIED**: no source
mentioned it.

The viewer works in system A. Systems B and C are mapped to A before interpretation:

| Function | A | B | C |
|---|---|---|---|
| Turning cycle (box) | G90 | G77 | G20 |
| Thread cycle (box) | G92 | G78 | G21 |
| Facing cycle (box) | G94 | G79 | G24 |
| Coordinate setting / max spindle speed | G50 | G92 | G92 |
| Feed per minute / per rev | G98 / G99 | G94 / G95 | G94 / G95 |
| Absolute / incremental | X,Z / U,W | G90 / G91 | G90 / G91 |
| Inch / metric | G20 / G21 | G20 / G21 | G70 / G71 |
| Finishing / G71 / G72 / G73 / G74 / G75 / G76 | G70–G76 | G70–G76 | G72–G78 |
| Canned-cycle return level (not used by the viewer) | – | G98 / G99 | G98 / G99 |

Open question to settle from the manual: are U/W still incremental addresses in systems B/C?
Not settled — no authoritative source was reached in this session. The viewer keeps U/W
incremental in all systems until the manual says otherwise.
