# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
import os
from datetime import datetime
from urllib.parse import urlencode

import pytz

# Module imports
from plane.authentication.adapter.oauth import OauthAdapter
from plane.license.utils.instance_value import get_configuration_value
from plane.authentication.adapter.error import (
    AUTHENTICATION_ERROR_CODES,
    AuthenticationException,
)


class SetjooOAuthProvider(OauthAdapter):
    """
    Setjoo Identity is Setjoo's own first-party OIDC provider
    (authorization_code + PKCE S256 only, no client_secret —
    token_endpoint_auth_methods_supported is ["none"]). Deliberately
    hardcoded to this one known-good issuer rather than exposing a
    generic "any OIDC provider" admin panel: Plane's own maintainers
    declined the community OIDC PR (#3341) partly over the security
    surface of a fully admin-configurable integration, and a single
    fixed first-party IdP is a much smaller surface than that.
    """

    scope = "openid profile email"
    provider = "setjoo"

    def __init__(self, request, code=None, state=None, code_challenge=None, code_verifier=None, callback=None):
        (SETJOO_IDENTITY_ISSUER, SETJOO_CLIENT_ID) = get_configuration_value(
            [
                {
                    "key": "SETJOO_IDENTITY_ISSUER",
                    "default": os.environ.get("SETJOO_IDENTITY_ISSUER"),
                },
                {
                    "key": "SETJOO_CLIENT_ID",
                    "default": os.environ.get("SETJOO_CLIENT_ID"),
                },
            ]
        )

        if not (SETJOO_IDENTITY_ISSUER and SETJOO_CLIENT_ID):
            raise AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["SETJOO_NOT_CONFIGURED"],
                error_message="SETJOO_NOT_CONFIGURED",
            )

        issuer = SETJOO_IDENTITY_ISSUER.rstrip("/")
        client_id = SETJOO_CLIENT_ID

        # Setjoo Identity computes the only redirect_uri it will accept for
        # a given client as "{origin}/oauth/callback" server-side, with no
        # per-app override and no trailing slash (setjoo repo's
        # server/config.ts registeredRedirectUris()) — unlike every other
        # provider in this file, this exact path is not this codebase's
        # choice to make, so it is NOT the conventional
        # /auth/setjoo/callback/ every sibling provider uses. See the
        # matching top-level route added in plane/urls.py.
        redirect_uri = f"""{"https" if request.is_secure() else "http"}://{request.get_host()}/oauth/callback"""

        url_params = {
            "client_id": client_id,
            "scope": self.scope,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "state": state,
        }
        if code_challenge:
            url_params["code_challenge"] = code_challenge
            url_params["code_challenge_method"] = "S256"
        auth_url = f"{issuer}/oauth/authorize?{urlencode(url_params)}"

        super().__init__(
            request,
            self.provider,
            client_id,
            self.scope,
            redirect_uri,
            auth_url,
            f"{issuer}/oauth/token",
            f"{issuer}/oauth/userinfo",
            None,  # no client_secret: Setjoo Identity is a public-client-only PKCE provider
            code,
            callback=callback,
        )
        self.code_verifier = code_verifier

    def set_token_data(self):
        data = {
            "code": self.code,
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "grant_type": "authorization_code",
        }
        if self.code_verifier:
            data["code_verifier"] = self.code_verifier
        token_response = self.get_user_token(data=data)
        super().set_token_data(
            {
                "access_token": token_response.get("access_token"),
                "refresh_token": token_response.get("refresh_token", None),
                "access_token_expired_at": (
                    datetime.fromtimestamp(token_response.get("expires_in"), tz=pytz.utc)
                    if isinstance(token_response.get("expires_in"), (int, float))
                    else None
                ),
                "refresh_token_expired_at": None,
                "id_token": token_response.get("id_token", ""),
            }
        )

    def set_user_data(self):
        user_info_response = self.get_user_response()
        # Setjoo Identity's /oauth/userinfo does not expose an
        # email_verified claim (unlike Google's userinfo, which this
        # codebase explicitly gates on). That's acceptable here, not an
        # oversight: Setjoo Identity's `users` table is the same
        # authoritative, already-verified identity source every other
        # Setjoo app (including Setjoo's own @setjoo.com mailbox) already
        # trusts directly — it is not a third-party IdP where a spoofed
        # claim is a meaningful risk.
        user_data = {
            "email": user_info_response.get("email"),
            "user": {
                "avatar": user_info_response.get("picture"),
                "first_name": user_info_response.get("name") or "",
                "last_name": "",
                "provider_id": user_info_response.get("sub"),
                "is_password_autoset": True,
            },
        }
        super().set_user_data(user_data)
