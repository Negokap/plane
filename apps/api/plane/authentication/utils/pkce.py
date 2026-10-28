# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import base64
import hashlib
import secrets


def generate_pkce_pair():
    """
    Generate an RFC 7636 PKCE (S256) verifier/challenge pair. Setjoo
    Identity is a public-client-only OIDC provider (no client secret) that
    mandatorily rejects any authorize request whose code_challenge_method
    isn't S256 — PKCE is how it keeps a public client's authorization code
    unusable if intercepted.
    """
    # 64 random bytes -> 86-char urlsafe string, well within RFC 7636's
    # required 43-128 character range for a code_verifier.
    code_verifier = secrets.token_urlsafe(64)
    digest = hashlib.sha256(code_verifier.encode("ascii")).digest()
    code_challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")
    return code_verifier, code_challenge
