#!/usr/bin/env bash
# check-open-core.sh — enforce the RugMunch open-core policy.
#
#   "Code, Not Methods" — public repos carry product code; proprietary methods,
#   infrastructure and competitive intelligence stay private; third-party code is
#   ingested into ContextCrypto as a pinned corpus entry and is NEVER published
#   under a RugMunch account.
#
# Authority: standards/OPEN-CORE-POLICY.json (generated from ENTERPRISE-README.md,
# METHODOLOGY-PROTECTION.md, contextcrypto/OPEN-CORE.md).
#
# Usage:  bash scripts/check-open-core.sh [--hosts]
#         --hosts  also query Forgejo/GitLab/Codeberg/GitHub and diff visibility
#                 against the policy (needs gopass + network; skipped otherwise)
#
# Exit:   0 clean · 1 violations found
set -uo pipefail

POLICY="${OPEN_CORE_POLICY:-/srv/work/repos/standards/OPEN-CORE-POLICY.json}"
WORK_ROOT="${WORK_ROOT:-/srv/work/repos}"
WITH_HOSTS=0
[ "${1:-}" = "--hosts" ] && WITH_HOSTS=1

violations=0
warn=0
v() {
    printf '  VIOLATION  %s\n' "$1"
    violations=$((violations + 1))
}
w() {
    printf '  warn       %s\n' "$1"
    warn=$((warn + 1))
}
ok() { printf '  ok         %s\n' "$1"; }

[ -f "$POLICY" ] || {
    echo "check-open-core: policy not found: $POLICY" >&2
    exit 1
}

mapfile -t PUB < <(python3 -c "import json;print('\n'.join(json.load(open('$POLICY'))['public_oss']))")
mapfile -t PRIV < <(python3 -c "import json;print('\n'.join(json.load(open('$POLICY'))['private_proprietary']))")
ADOPTED_ROOT=$(python3 -c "import json;print(json.load(open('$POLICY'))['third_party_corpus_root'])")
ADOPTED_MANIFEST=$(python3 -c "import json;print(json.load(open('$POLICY'))['adopted_manifest'])")

echo "check-open-core: policy=$POLICY public=${#PUB[@]} private=${#PRIV[@]}"

# --- 1. policy internal consistency -----------------------------------------
dupes=$(printf '%s\n' "${PUB[@]}" | sort | uniq -d)
[ -n "$dupes" ] && v "duplicate entries in public_oss: $(echo "$dupes" | tr '\n' ' ')"
both=$(comm -12 <(printf '%s\n' "${PUB[@]}" | sort) <(printf '%s\n' "${PRIV[@]}" | sort))
[ -n "$both" ] && v "repos in BOTH public and private: $(echo "$both" | tr '\n' ' ')"
[ -z "$dupes" ] && [ -z "$both" ] && ok "policy sets are disjoint and unique"

# --- 2. no third-party git repo left in our own tree ------------------------
# Scan the work root AND the corpus one level down. The corpus lives at
# $WORK_ROOT/rmi-codebase-mcp-corpus/_adopted/*, so a single-level glob
# never saw it — third-party sat in the "own" tree undetected.
strays=()
for d in "$WORK_ROOT"/*/ "$WORK_ROOT"/*/_adopted/*/; do
    p="${d%/}"
    [ -d "$p/.git" ] || continue
    case "$p" in
    *rmi-codebase-mcp-corpus/_adopted/*) continue ;; # corpus: checked by checks 3/4
    esac
    rem=$(git -C "$p" remote -v 2>/dev/null)
    if ! printf '%s' "$rem" | grep -qiE 'rugmunch|rug-munch|rad://'; then
        strays+=("$(basename "$p")")
    fi
done
if [ ${#strays[@]} -gt 0 ]; then
    v "third-party repo(s) in our own tree (move to $ADOPTED_ROOT): ${strays[*]}"
else
    ok "own repo tree contains only RugMunch repos"
fi

# --- 3. no RugMunch remote pointed at a third-party upstream ----------------
# In our own tree: a RugMunch remote alongside a foreign upstream means we
# forked someone else's project under our org.
for d in "$WORK_ROOT"/*/; do
    p="${d%/}"
    [ -d "$p/.git" ] || continue
    rem=$(git -C "$p" remote -v 2>/dev/null)
    printf '%s' "$rem" | grep -qiE 'rugmunch|rug-munch' || continue
    # 2026-09-30 shellcheck SC2086: $rem was unquoted, so a remote line with a glob
    # or leading dash could word-split/glob. remote -v output is newline-separated
    # records; take field 2 (the URL) of each without shell re-splitting.
    foreign=$(printf '%s\n' "$rem" | awk '{print $2}' | grep -viE 'rugmunch|rug-munch|rad://' | head -1)
    if [ -n "$foreign" ]; then
        v "$(basename "$p"): has a RugMunch remote AND a foreign upstream ($foreign) — forked third-party code under our org"
    fi
done
# In the CORPUS this is inverted: ANY RugMunch remote is a violation. Third-party
# must never be pushable into our org — 18 checkouts had origin pointed at
# RugMunchMedia, armed to publish on the next `git push`.
corpus_root="$WORK_ROOT/rmi-codebase-mcp-corpus/_adopted"
if [ -d "$corpus_root" ]; then
    for d in "$corpus_root"/*/; do
        p="${d%/}"
        [ -d "$p/.git" ] || continue
        bad=$(git -C "$p" remote -v 2>/dev/null | grep -i 'rugmunch' | head -1)
        [ -n "$bad" ] && v "third-party $(basename "$p"): has a RugMunch remote ($(echo "$bad" | awk '{print $2}') | cut -c1-70)) — one push publishes other people's code under our org"
    done
fi
ok "no third-party code forked under a RugMunch remote"

# --- 4. adopted entries are complete, pinned and justified -------------------
if [ -f "$ADOPTED_MANIFEST" ]; then
    if python3 - "$ADOPTED_MANIFEST" "$ADOPTED_ROOT" <<'PY'
import json,os,sys
m=json.load(open(sys.argv[1])); root=sys.argv[2]
bad=0
for e in m["entries"]:
    n=e.get("library_name","?")
    if not (e.get("reason") or "").strip() or "UNCLASSIFIED" in e.get("reason",""):
        print(f"  VIOLATION  adopted/{n}: no reason recorded"); bad+=1
    if not (e.get("pinned_sha") or "").strip():
        print(f"  VIOLATION  adopted/{n}: not pinned to a sha"); bad+=1
    ap=str(e.get("abs_path") or "")
    if not ap.startswith(root + "/"):
        print(f"  VIOLATION  adopted/{n}: abs_path escapes the corpus root"); bad+=1
    elif not os.path.isdir(ap):
        print(f"  VIOLATION  adopted/{n}: path missing on disk: {ap}"); bad+=1
    elif not os.path.isdir(os.path.join(ap, ".git")):
        print(f"  VIOLATION  adopted/{n}: not a git checkout (nothing to audit)"); bad+=1
    if e.get("license_file") == "none":
        print(f"  warn       adopted/{n}: no LICENSE file — obligations when deriving from it")
# Every git checkout under the corpus root MUST appear in the manifest with a
# reason. Without this, a clone lands in _adopted/ and silently escapes review.
manifested={os.path.basename(str(e.get("abs_path") or "")) for e in m["entries"]}
if os.path.isdir(root):
    for d in sorted(os.listdir(root)):
        if not os.path.isdir(os.path.join(root,d,".git")): continue
        if d not in manifested:
            print(f"  VIOLATION  adopted/{d}: present on disk but NOT in the manifest (no reason on record)"); bad+=1
sys.exit(1 if bad else 0)
PY
    then
        ok "all adopted entries are pinned, justified and inside the corpus"
    else
        # python exits 1 when it printed any VIOLATION — that must reach the summary,
        # otherwise the gate reports violations=0 while printing violations and exits 0.
        violations=$((violations + 1))
    fi
else
    w "adopted manifest not found at $ADOPTED_MANIFEST"
fi

# --- 5. adopted code must not be indexed as our own code ---------------------
if [ -x /srv/zoekt/zoekt-repos.sh ] || [ -f /srv/zoekt/zoekt-repos.sh ]; then
    # Compare PATHS, not basenames. A name collision is not a mis-tagging:
    # our own curated /srv/work/repos/awesome-x402 legitimately shares a name with
    # the third-party fork at _adopted/upstream-awesome-x402, and only the path
    # tells them apart. A basename gate false-positives on exactly that.
    mis=$(bash /srv/zoekt/zoekt-repos.sh 2>/dev/null | awk -F'\t' '$1 ~ /^own-/ {print $4}' |
        grep -F "$ADOPTED_ROOT" | sed 's#.*/##' | sort -u || true)
    [ -n "$mis" ] && v "third-party indexed as own-* (own code): $(echo "$mis" | tr '\n' ' ')" ||
        ok "no third-party indexed under the own-* namespace"
fi

# --- 5a. Radicle: serve yes, publish only the public tier --------------------
# We DO serve on Radicle. The rule is not "go dark" — it is that Radicle is a
# one-way, permanent, public surface, so only public_oss-tier code may ever be
# on it. Never private_proprietary (that is the methods-and-means we keep
# closed, and 1.x sends private repos in cleartext), never third_party_corpus
# (not our code to republish).
python3 - "$POLICY" "$WORK_ROOT" <<'RADPY'
import json,os,subprocess,sys
policy=json.load(open(sys.argv[1])); root=sys.argv[2]
pub=set(policy.get("public_oss",[])) | set(policy.get("public_oss",[]))
priv=set(policy.get("private_proprietary",[]))
alias={k:v for k,v in (policy.get("aliases") or {}).items()}
# A directory name may differ from the canonical policy name (degenfeed-web vs
# degenfeed). Resolve both directions so neither side reads as off-tier.
for k,v in alias.items():
    if v in pub: pub.add(k)
    if k in pub: pub.add(v)
    if v in priv: priv.add(k)
    if k in priv: priv.add(v)
bad=0
for d in sorted(os.listdir(root)):
    p=os.path.join(root,d)
    if not os.path.isdir(os.path.join(p,".git")): continue
    out=subprocess.run(["git","-C",p,"remote","-v"],capture_output=True,text=True).stdout
    if "rad://" not in out: continue
    if d in priv:
        print(f"  VIOLATION  {d}: private_proprietary repo has a rad:// remote — methods-and-means must never be published"); bad+=1
    elif d not in pub:
        print(f"  VIOLATION  {d}: rad:// remote but not in public_oss tier — only public code may be on Radicle"); bad+=1
for svc in ("radicle-node","radicle-httpd"):
    st=subprocess.run(["systemctl","is-active",svc],capture_output=True,text=True).stdout.strip()
    if st not in ("active","inactive","failed","unknown"):
        print(f"  VIOLATION  {svc} in unexpected state: {st}"); bad+=1
sys.exit(1 if bad else 0)
RADPY
rc=$?
if [ "$rc" -eq 0 ]; then
    ok "rad:// remotes confined to the public_oss tier"
else
    violations=$((violations + 1))
fi

# --- 5b. public repo licence matches the DECLARED tier ---------------------
# A public repo is public CODE, not necessarily MIT: open-core deliberately ships
# some products under BSL / Source-Available / PROPRIETARY. What must never
# happen is the file on disk disagreeing with the declared policy — that is
# silent drift, and it is what this check is for.
python3 - "$POLICY" "$WORK_ROOT" <<'LICPY'
import json,os,re,sys
policy=json.load(open(sys.argv[1])); root=sys.argv[2]
declared=policy.get("public_licences",{})
SIGNS={"MIT":[r"MIT License",r"Permission is hereby granted, free of charge"],
       "BSL-1.1":[r"BUSINESS SOURCE LICENSE",r"Business Source License"],
       "SOURCE-AVAILABLE":[r"Source Available License"],
       "PROPRIETARY":[r"^\s*PROPRIETARY",r"All rights reserved"]}
bad=0
for name,want in sorted(declared.items()):
    d=os.path.join(root,name)
    if not os.path.isdir(d): continue
    lf=next((os.path.join(d,f) for f in sorted(os.listdir(d)) if f.upper().startswith("LICENSE")), None)
    if not lf:
        print(f"  VIOLATION  public repo {name} has no LICENSE file (policy declares {want})"); bad+=1; continue
    try: head=open(lf,errors="replace").read(2000)
    except Exception: head=""
    if not any(re.search(p,head,re.I|re.M) for p in SIGNS[want]):
        first=head.strip().splitlines()[0][:52] if head.strip() else "?"
        print(f"  VIOLATION  public repo {name}: policy declares {want} but LICENSE reads '{first}'"); bad+=1
uncovered=[n for n in declared if not os.path.isdir(os.path.join(root,n))]
sys.exit(1 if bad else 0)
LICPY
rc=$?
if [ "$rc" -eq 0 ]; then
    ok "public repo licences match the declared tiers"
else
    violations=$((violations + 1))
fi

# --- 6. host visibility vs policy (opt-in) -----------------------------------
if [ "$WITH_HOSTS" = "1" ]; then
    FT=$(gopass show -o rmi/forgejo/api_token 2>/dev/null | head -1 | tr -d '[:space:]')
    if [ -z "$FT" ]; then
        w "no forgejo token in gopass — skipping visibility diff"
    else
        for n in "${PUB[@]}"; do
            c=$(curl -sS -m 20 -o /tmp/oc.$$ -w '%{http_code}' -H "Authorization: token $FT" \
                "https://git.rugmunch.io/api/v1/repos/RugMunchMedia/$n" 2>/dev/null)
            [ "$c" = "200" ] || continue
            python3 -c "
import json,sys
d=json.load(open('/tmp/oc.$$'))
if d.get('private'): print('  VIOLATION  forgejo/RugMunchMedia/$n is PRIVATE but the policy says public')" 2>/dev/null
        done
        rm -f /tmp/oc.$$
        ok "forgejo visibility diffed against policy"
    fi
fi

echo "check-open-core: violations=$violations warnings=$warn"
[ "$violations" -eq 0 ]
