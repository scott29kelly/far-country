"""Anthropic-backed `JudgeCaller` for citation verification.

The keyword-overlap heuristic in `citation_check.py` catches invented
citations and gross paraphrase-bloat, but a descriptor can pass the
keyword check and still misrepresent the verse (or fail it and still be
a fine paraphrase). The LLM judge reads both the descriptor's claim and
the cited passage text, then returns one of `pass | partial | fail`
with a one-sentence rationale.

This module is the *implementation* of the `JudgeCaller` protocol;
`citation_check.verify_descriptor` calls it through the protocol so the
verification layer stays SDK-agnostic.

Required env: `ANTHROPIC_API_KEY`.
"""

from __future__ import annotations

import json
import re
from typing import TYPE_CHECKING, Final

if TYPE_CHECKING:
    from far_country.verify.citation_check import JudgeCaller, VerificationStatus

DEFAULT_JUDGE_MODEL: Final = "claude-sonnet-4-6"
DEFAULT_MAX_TOKENS: Final = 400

_JSON_FENCE = re.compile(r"^\s*```(?:json)?\s*\n?(.*?)\n?\s*```\s*$", re.DOTALL)

JUDGE_SYSTEM_PROMPT: Final = """\
You are auditing whether a curator's claim about heaven is substantively \
supported by the cited Scripture passage. You are not assessing whether \
the claim is theologically interesting, well-written, or symbolic — only \
whether the passage substantively supports it.

Reading rules:
- The claim does not need to repeat the passage's vocabulary; faithful \
paraphrase is supported.
- The claim may not invent content the passage does not contain or imply.
- The claim may not overreach: drawing a broad conclusion the passage \
does not warrant is overreach.
- Symbolic claims with a stated referent are supported if the passage \
plausibly bears the referent given conservative-Protestant, \
literal-where-possible hermeneutic with symbolism flagged when text \
genre signals it (apocalyptic vision, prophetic vision, poetry).
- Wrong-verse claims (cited passage does not address the claim's \
subject at all) are unsupported.

Output a single JSON object on one line:
{"status": "pass" | "partial" | "fail", "rationale": "<one sentence>"}

- "pass": the passage substantively supports the claim.
- "partial": the passage touches the claim but the claim overreaches, \
paraphrases beyond what's defensible, or relies on a verse range that \
only partly addresses the subject.
- "fail": the passage does not support the claim (hallucination, wrong \
verse, or invention).

Output nothing except the JSON object. No prose, no fences, no markdown.\
"""


class LLMJudgeError(RuntimeError):
    """Raised when the Anthropic response cannot be parsed."""


def make_anthropic_judge(
    client: object,
    *,
    model: str = DEFAULT_JUDGE_MODEL,
    max_tokens: int = DEFAULT_MAX_TOKENS,
) -> JudgeCaller:
    """Wrap an `anthropic.Anthropic` client into a `JudgeCaller`.

    Accepts an object rather than the SDK type so this module imports
    cleanly even if `anthropic` isn't installed. Mirrors the pattern in
    `extract.extractor.make_anthropic_caller`.
    """

    def judge(statement: str, source_text: str) -> tuple[VerificationStatus, str]:
        user = (
            f"PASSAGE TEXT:\n{source_text.strip()}\n\n"
            f"CLAIM ABOUT HEAVEN:\n{statement.strip()}\n\n"
            "Return the JSON object now."
        )
        message = client.messages.create(  # type: ignore[attr-defined]
            model=model,
            max_tokens=max_tokens,
            system=JUDGE_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user}],
        )
        stop_reason = getattr(message, "stop_reason", None)
        if stop_reason == "max_tokens":
            raise LLMJudgeError(
                f"Judge response was truncated (stop_reason='max_tokens', "
                f"max_tokens={max_tokens}); increase max_tokens or shorten input."
            )
        text: str | None = None
        for block in message.content:
            block_text = getattr(block, "text", None)
            if block_text is not None:
                text = block_text
                break
        if text is None:
            raise LLMJudgeError("Judge response contained no text block")
        return _parse_judge_payload(text)

    return judge


def _parse_judge_payload(raw: str) -> tuple[VerificationStatus, str]:
    cleaned = _strip_json_fence(raw)
    try:
        payload = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise LLMJudgeError(f"Judge response was not valid JSON: {raw!r}") from exc
    if not isinstance(payload, dict):
        raise LLMJudgeError(f"Judge response was not a JSON object: {raw!r}")
    status = payload.get("status")
    rationale = payload.get("rationale")
    if status not in {"pass", "partial", "fail"}:
        raise LLMJudgeError(
            f"Judge response had invalid status {status!r}; expected pass|partial|fail"
        )
    if not isinstance(rationale, str) or not rationale.strip():
        raise LLMJudgeError(f"Judge response had empty rationale: {raw!r}")
    return status, rationale.strip()


def _strip_json_fence(text: str) -> str:
    stripped = text.strip()
    match = _JSON_FENCE.match(stripped)
    return match.group(1).strip() if match else stripped
